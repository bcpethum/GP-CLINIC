const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// All patient routes require authentication and 'patients' permission
router.use(authenticateToken, requirePermission('patients'));

// ─────────────────────────────────────────────────────────────────────────────
// Helper: resolve the owning doctor_id from the authenticated user.
//   - If the user is a doctor  → their own userId
//   - If the user is assistant → look up their doctor_id from users table
// ─────────────────────────────────────────────────────────────────────────────
async function getDoctorId(req) {
  if (req.user.role === 'doctor') return req.user.userId;
  const result = await db.query('SELECT doctor_id FROM users WHERE id = $1', [req.user.userId]);
  if (result.rows.length === 0 || !result.rows[0].doctor_id) {
    throw new Error('Assistant is not linked to a doctor.');
  }
  return result.rows[0].doctor_id;
}

// Configure Multer for In-Memory Storage (Stores directly in PostgreSQL DB as Base64 Data URI)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB max file size
});

// 1. Search patients by telephone or name — scoped to the doctor
router.get('/', async (req, res) => {
  const { search } = req.query;
  try {
    const doctorId = await getDoctorId(req);
    let queryText, params;

    const lastVisitSubquery = `(
      SELECT visit_date FROM visits
      WHERE patient_id = p.id AND doctor_id = $1
      ORDER BY visit_date DESC LIMIT 1
    ) AS last_visit_date`;

    if (search) {
      queryText = `SELECT p.*, ${lastVisitSubquery} FROM patients p WHERE p.doctor_id = $1 AND (p.name ILIKE $2 OR p.telephone ILIKE $2) ORDER BY p.name ASC`;
      params = [doctorId, `%${search}%`];
    } else {
      queryText = `SELECT p.*, ${lastVisitSubquery} FROM patients p WHERE p.doctor_id = $1 ORDER BY p.name ASC`;
      params = [doctorId];
    }

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error searching patients' });
  }
});

// ── GET /api/patients/active ───────────────────────────────────────────────
// Returns ALL patients who had at least one visit within the last N months.
// Query params:
//   ?months=1   → patients who visited in the last 1 month
//   ?months=3   → patients who visited in the last 3 months
//   (no param)  → all patients who ever visited
router.get('/active', async (req, res) => {
  try {
    const doctorId = await getDoctorId(req);
    const { months } = req.query;

    let queryText;
    let params;

    if (months) {
      queryText = `
        SELECT DISTINCT ON (p.id)
          p.id,
          p.name        AS patient_name,
          p.telephone   AS tel_no,
          p.age,
          v.visit_date,
          v.next_visit_date,
          v.next_visit_plan AS visit_plan
        FROM visits v
        JOIN patients p ON p.id = v.patient_id
        WHERE v.doctor_id = $1
          AND v.visit_date >= CURRENT_DATE - ($2 || ' months')::INTERVAL
        ORDER BY p.id, v.visit_date DESC
      `;
      params = [doctorId, parseInt(months)];
    } else {
      // All patients ever seen by this doctor
      queryText = `
        SELECT DISTINCT ON (p.id)
          p.id,
          p.name        AS patient_name,
          p.telephone   AS tel_no,
          p.age,
          v.visit_date,
          v.next_visit_date,
          v.next_visit_plan AS visit_plan
        FROM visits v
        JOIN patients p ON p.id = v.patient_id
        WHERE v.doctor_id = $1
        ORDER BY p.id, v.visit_date DESC
      `;
      params = [doctorId];
    }

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[active-patients]', err);
    res.status(500).json({ error: 'Database error loading active patients' });
  }
});

// ── GET /api/patients/next-visits ─────────────────────────────────────────
// Returns patients who have a scheduled next visit date.
// Query params:
//   ?date=YYYY-MM-DD   → only patients with next_visit_date = that date
//   (no param)         → all patients with any future or past next_visit_date
router.get('/next-visits', async (req, res) => {
  try {
    const doctorId = await getDoctorId(req);
    const { date } = req.query;

    let queryText;
    let params;

    if (date) {
      // Filter by specific date (today / tomorrow)
      queryText = `
        SELECT DISTINCT ON (p.id)
          p.id,
          p.name          AS patient_name,
          p.telephone     AS tel_no,
          p.age,
          v.next_visit_date,
          v.next_visit_plan AS visit_plan,
          v.visit_date
        FROM visits v
        JOIN patients p ON p.id = v.patient_id
        WHERE v.doctor_id = $1
          AND v.next_visit_date = $2::date
          AND v.next_visit_date IS NOT NULL
        ORDER BY p.id, v.next_visit_date ASC
      `;
      params = [doctorId, date];
    } else {
      // All patients with any next_visit_date set
      queryText = `
        SELECT DISTINCT ON (p.id)
          p.id,
          p.name          AS patient_name,
          p.telephone     AS tel_no,
          p.age,
          v.next_visit_date,
          v.next_visit_plan AS visit_plan,
          v.visit_date
        FROM visits v
        JOIN patients p ON p.id = v.patient_id
        WHERE v.doctor_id = $1
          AND v.next_visit_date IS NOT NULL
        ORDER BY p.id, v.next_visit_date ASC
      `;
      params = [doctorId];
    }

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[next-visits]', err);
    res.status(500).json({ error: 'Database error loading next visits' });
  }
});

// 10. Delete a patient and all associated records
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const doctorId = await getDoctorId(req);

    // Verify ownership
    const check = await db.query(
      'SELECT id FROM patients WHERE id = $1 AND doctor_id = $2',
      [parseInt(id), doctorId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Delete cascade: prescriptions → visits → investigations → images → patient
    await db.query('DELETE FROM prescriptions WHERE visit_id IN (SELECT id FROM visits WHERE patient_id = $1)', [parseInt(id)]);
    await db.query('DELETE FROM visits WHERE patient_id = $1', [parseInt(id)]);
    await db.query('DELETE FROM investigations WHERE patient_id = $1', [parseInt(id)]);
    await db.query('DELETE FROM diagnostic_images WHERE patient_id = $1', [parseInt(id)]);
    await db.query('DELETE FROM patients WHERE id = $1 AND doctor_id = $2', [parseInt(id), doctorId]);

    res.json({ message: 'Patient and all associated records deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error deleting patient' });
  }
});

// 2. Register a new patient — linked to this doctor
router.post('/', async (req, res) => {
  const { name, age, telephone, weight, height, allergies } = req.body;

  if (!name || !age || !telephone) {
    return res.status(400).json({ error: 'Name, age, and telephone number are required' });
  }

  try {
    const doctorId = await getDoctorId(req);
    const queryText = `
      INSERT INTO patients (name, age, telephone, weight, height, allergies, doctor_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await db.query(queryText, [
      name,
      parseInt(age),
      telephone,
      weight ? parseFloat(weight) : null,
      height ? parseFloat(height) : null,
      allergies || '',
      doctorId
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error creating patient' });
  }
});

// 3. Update an existing patient — scoped to doctor
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, age, telephone, weight, height, allergies } = req.body;

  try {
    const doctorId = await getDoctorId(req);
    const queryText = `
      UPDATE patients
      SET name = $1, age = $2, telephone = $3, weight = $4, height = $5, allergies = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND doctor_id = $8
      RETURNING *
    `;
    const result = await db.query(queryText, [
      name,
      parseInt(age),
      telephone,
      weight ? parseFloat(weight) : null,
      height ? parseFloat(height) : null,
      allergies,
      parseInt(id),
      doctorId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error updating patient' });
  }
});

// 4. Get individual patient profile — scoped to doctor
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const doctorId = await getDoctorId(req);
    const result = await db.query(
      'SELECT * FROM patients WHERE id = $1 AND doctor_id = $2',
      [parseInt(id), doctorId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error retrieving patient profile' });
  }
});

// 5. Get complete visit history of a patient (including prescriptions & investigations)
router.get('/:id/history', async (req, res) => {
  const { id } = req.params;
  try {
    const doctorId = await getDoctorId(req);

    // Verify patient belongs to this doctor
    const patientCheck = await db.query(
      'SELECT id FROM patients WHERE id = $1 AND doctor_id = $2',
      [parseInt(id), doctorId]
    );
    if (patientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get all visits for this patient under this doctor
    const visitsResult = await db.query(
      'SELECT * FROM visits WHERE patient_id = $1 AND doctor_id = $2 ORDER BY visit_date DESC, id DESC',
      [parseInt(id), doctorId]
    );

    const visits = visitsResult.rows;

    // Attach prescriptions and investigations to each visit
    for (let visit of visits) {
      const rxResult = await db.query(
        'SELECT * FROM prescriptions WHERE visit_id = $1 ORDER BY id ASC',
        [visit.id]
      );
      visit.prescriptions = rxResult.rows;

      const invResult = await db.query(
        'SELECT * FROM investigations WHERE visit_id = $1',
        [visit.id]
      );
      visit.investigation = invResult.rows[0] || null;
    }

    res.json(visits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error loading patient history' });
  }
});

// 6. Record medical investigations for a patient
router.post('/:id/investigations', async (req, res) => {
  const { id } = req.params;
  const {
    visit_id, fbc, fbs, lipid_profile, ufr, crp, esr,
    dengue_ns1, influenza_ag, lft, tft, rft, test_date
  } = req.body;

  try {
    const queryText = `
      INSERT INTO investigations (
        patient_id, visit_id, test_date, fbc, fbs, lipid_profile, ufr, crp, esr,
        dengue_ns1, influenza_ag, lft, tft, rft
      )
      VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    const result = await db.query(queryText, [
      parseInt(id),
      visit_id ? parseInt(visit_id) : null,
      test_date || null,
      fbc || '', fbs || '', lipid_profile || '', ufr || '', crp || '', esr || '',
      dengue_ns1 || '', influenza_ag || '', lft || '', tft || '', rft || ''
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error recording investigations' });
  }
});

// 7. Get all historical laboratory investigations for a patient
router.get('/:id/investigations', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM investigations WHERE patient_id = $1 ORDER BY test_date DESC, id DESC',
      [parseInt(id)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error loading investigations history' });
  }
});

// 8. Upload a diagnostic image (Stored directly into PostgreSQL DB)
router.post('/:id/images', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { visit_id, caption } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'Please upload an image file' });
  }

  // Convert uploaded image buffer into a Base64 Data URI to store directly in PostgreSQL
  const mimeType = req.file.mimetype || 'image/jpeg';
  const base64Data = req.file.buffer.toString('base64');
  const imageUrl = `data:${mimeType};base64,${base64Data}`;

  try {
    const queryText = `
      INSERT INTO diagnostic_images (patient_id, visit_id, image_url, caption)
      VALUES ($1, $2, $3, $4)
      RETURNING id, patient_id, visit_id, caption, uploaded_at, image_url
    `;
    const result = await db.query(queryText, [
      parseInt(id),
      visit_id ? parseInt(visit_id) : null,
      imageUrl,
      caption || ''
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error saving uploaded image' });
  }
});

// 9. Get all uploaded diagnostic images for a patient
router.get('/:id/images', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM diagnostic_images WHERE patient_id = $1 ORDER BY uploaded_at DESC',
      [parseInt(id)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error loading patient images' });
  }
});

// 10. Delete a diagnostic image from database
router.delete('/:id/images/:imageId', async (req, res) => {
  const { id, imageId } = req.params;
  try {
    const result = await db.query(
      'DELETE FROM diagnostic_images WHERE id = $1 AND patient_id = $2 RETURNING id',
      [parseInt(imageId), parseInt(id)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }
    res.json({ message: 'Diagnostic image deleted successfully from database' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error deleting diagnostic image' });
  }
});

module.exports = router;
