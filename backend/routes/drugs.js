const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// All drug routes require authentication and 'drugs' permission
router.use(authenticateToken, requirePermission('drugs'));

// ─────────────────────────────────────────────────────────────────────────────
// Helper: resolve the owning doctor_id from the authenticated user.
//   - Doctor  → their own userId
//   - Assistant → look up their linked doctor_id
// ─────────────────────────────────────────────────────────────────────────────
async function getDoctorId(req) {
  if (req.user.role === 'doctor') return req.user.userId;
  const result = await db.query('SELECT doctor_id FROM users WHERE id = $1', [req.user.userId]);
  if (result.rows.length === 0 || !result.rows[0].doctor_id) {
    throw new Error('Assistant is not linked to a doctor.');
  }
  return result.rows[0].doctor_id;
}

// 1. Get all drugs — scoped to doctor (with optional search)
router.get('/', async (req, res) => {
  const { search } = req.query;
  try {
    const doctorId = await getDoctorId(req);
    let queryText, params;

    if (search) {
      queryText = 'SELECT * FROM drugs WHERE doctor_id = $1 AND name ILIKE $2 ORDER BY name ASC';
      params = [doctorId, `%${search}%`];
    } else {
      queryText = 'SELECT * FROM drugs WHERE doctor_id = $1 ORDER BY name ASC';
      params = [doctorId];
    }

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching drug inventory' });
  }
});

// 2. Add a new drug — tagged with doctor_id
router.post('/', async (req, res) => {
  const {
    name, type, expiry_date, selling_price, buying_price,
    notify_threshold, stock,
    default_dose_qty, default_dose_freq, default_duration_days
  } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }

  try {
    const doctorId = await getDoctorId(req);
    const queryText = `
      INSERT INTO drugs (
        name, type, expiry_date, selling_price, buying_price,
        notify_threshold, stock, doctor_id,
        default_dose_qty, default_dose_freq, default_duration_days
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const result = await db.query(queryText, [
      name,
      type,
      expiry_date || null,
      selling_price ? parseFloat(selling_price) : 0.00,
      buying_price ? parseFloat(buying_price) : 0.00,
      notify_threshold ? parseInt(notify_threshold) : 10,
      stock ? parseInt(stock) : 0,
      doctorId,
      default_dose_qty || '1',
      default_dose_freq || 'TDS',
      default_duration_days ? parseInt(default_duration_days) : 3
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error adding drug' });
  }
});

// 3. Edit drug — scoped to doctor
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    name, type, expiry_date, selling_price, buying_price,
    notify_threshold, stock,
    default_dose_qty, default_dose_freq, default_duration_days
  } = req.body;

  try {
    const doctorId = await getDoctorId(req);
    const queryText = `
      UPDATE drugs
      SET name = $1,
          type = $2,
          expiry_date = $3,
          selling_price = $4,
          buying_price = $5,
          notify_threshold = $6,
          stock = $7,
          default_dose_qty = $8,
          default_dose_freq = $9,
          default_duration_days = $10
      WHERE id = $11 AND doctor_id = $12
      RETURNING *
    `;
    const result = await db.query(queryText, [
      name,
      type,
      expiry_date || null,
      selling_price ? parseFloat(selling_price) : 0.00,
      buying_price ? parseFloat(buying_price) : 0.00,
      notify_threshold ? parseInt(notify_threshold) : 10,
      stock ? parseInt(stock) : 0,
      default_dose_qty || '1',
      default_dose_freq || 'TDS',
      default_duration_days ? parseInt(default_duration_days) : 3,
      parseInt(id),
      doctorId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Drug not found in inventory' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error updating drug inventory' });
  }
});

// 4. Delete a drug — scoped to doctor
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const doctorId = await getDoctorId(req);
    const result = await db.query(
      'DELETE FROM drugs WHERE id = $1 AND doctor_id = $2 RETURNING *',
      [parseInt(id), doctorId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Drug not found' });
    }
    res.json({ message: 'Drug deleted successfully', drug: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error deleting drug' });
  }
});

module.exports = router;
