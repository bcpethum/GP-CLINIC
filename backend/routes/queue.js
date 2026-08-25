const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');

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

// 1. Get today's queue (Pending & Active visits) — scoped to doctor
router.get('/', authenticateToken, requirePermission('queue'), async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    const doctorId = await getDoctorId(req);
    const queryText = `
      SELECT v.*, p.name, p.age, p.telephone, p.allergies, p.weight, p.height
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      WHERE v.visit_date = $1
        AND v.status IN ('Pending', 'Active')
        AND v.doctor_id = $2
      ORDER BY v.queue_number ASC
    `;
    const result = await db.query(queryText, [targetDate, doctorId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error retrieving daily queue' });
  }
});

// 2. Add a patient to today's queue — scoped to doctor
router.post('/', authenticateToken, requirePermission('queue'), async (req, res) => {
  const { patient_id, date } = req.body;
  if (!patient_id) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }

  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    const doctorId = await getDoctorId(req);

    // 1. Check patient exists and belongs to this doctor
    const patientCheck = await db.query(
      'SELECT id FROM patients WHERE id = $1 AND doctor_id = $2',
      [parseInt(patient_id), doctorId]
    );
    if (patientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // 2. Check if patient already in today's queue for this doctor
    const activeCheck = await db.query(
      `SELECT id FROM visits WHERE patient_id = $1 AND visit_date = $2 AND doctor_id = $3 AND status IN ('Pending', 'Active')`,
      [parseInt(patient_id), targetDate, doctorId]
    );
    if (activeCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Patient is already in the queue for today' });
    }

    // 3. Compute next queue number for this doctor's queue today
    const queueResult = await db.query(
      'SELECT COALESCE(MAX(queue_number), 0) + 1 AS next_num FROM visits WHERE visit_date = $1 AND doctor_id = $2',
      [targetDate, doctorId]
    );
    const nextQueueNumber = queueResult.rows[0].next_num;

    // 4. Create visit tagged with doctor_id
    const insertQuery = `
      INSERT INTO visits (patient_id, visit_date, queue_number, status, doctor_id)
      VALUES ($1, $2, $3, 'Pending', $4)
      RETURNING *
    `;
    const newVisitResult = await db.query(insertQuery, [
      parseInt(patient_id), targetDate, nextQueueNumber, doctorId
    ]);

    // Retrieve full details with patient info
    const detailQuery = `
      SELECT v.*, p.name, p.age, p.telephone, p.allergies, p.weight, p.height
      FROM visits v
      JOIN patients p ON v.patient_id = p.id
      WHERE v.id = $1
    `;
    const detailResult = await db.query(detailQuery, [newVisitResult.rows[0].id]);

    res.status(201).json(detailResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error adding patient to queue' });
  }
});

// 3. Update status of queue visit (Pending -> Active -> Completed / Cancelled)
router.put('/:id/status', authenticateToken, requirePermission('queue'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  try {
    const doctorId = await getDoctorId(req);
    const queryText = `
      UPDATE visits
      SET status = $1
      WHERE id = $2 AND doctor_id = $3
      RETURNING *
    `;
    const result = await db.query(queryText, [status, parseInt(id), doctorId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Visit record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error updating visit status' });
  }
});

// 4. Complete a visit: record diagnosis, issue prescription, deduct inventory stock
router.put('/:id/diagnose', authenticateToken, requirePermission('queue'), async (req, res) => {
  const { id } = req.params;
  const {
    diagnosis,
    next_visit_date,
    next_visit_plan,
    total_fee,
    paid_amount,
    is_foc,
    prescriptions,
    investigations
  } = req.body;

  try {
    const doctorId = await getDoctorId(req);

    await db.query('BEGIN');

    // 1. Get the visit and verify it belongs to this doctor
    const visitRes = await db.query(
      'SELECT patient_id FROM visits WHERE id = $1 AND doctor_id = $2',
      [parseInt(id), doctorId]
    );
    if (visitRes.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Visit not found' });
    }
    const patientId = visitRes.rows[0].patient_id;

    // 2. Update the visit record
    const updateVisitQuery = `
      UPDATE visits
      SET diagnosis = $1,
          next_visit_date = $2,
          next_visit_plan = $3,
          total_fee = $4,
          paid_amount = $5,
          is_foc = $6,
          status = 'Completed'
      WHERE id = $7 AND doctor_id = $8
      RETURNING *
    `;
    const visitUpdateRes = await db.query(updateVisitQuery, [
      diagnosis || '',
      next_visit_date || null,
      next_visit_plan || '',
      total_fee ? parseFloat(total_fee) : 0.00,
      paid_amount ? parseFloat(paid_amount) : 0.00,
      is_foc || false,
      parseInt(id),
      doctorId
    ]);

    // 3. Clear existing prescriptions for this visit (re-entrant support)
    await db.query('DELETE FROM prescriptions WHERE visit_id = $1', [parseInt(id)]);

    // 4. Insert prescriptions & update drug stock
    if (prescriptions && Array.isArray(prescriptions)) {
      for (const item of prescriptions) {
        if (!item.medicine_name) continue;

        await db.query(
          `INSERT INTO prescriptions (visit_id, medicine_name, dosage, duration_days, price)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            parseInt(id),
            item.medicine_name,
            item.dosage || '',
            item.duration_days ? parseInt(item.duration_days) : 3,
            item.price ? parseFloat(item.price) : 0.00
          ]
        );

        if (item.drug_id) {
          let quantityToDeduct = 0;
          const dosageStr = (item.dosage || '').trim().toLowerCase();
          const days = parseInt(item.duration_days) || 1;

          if (dosageStr.includes('-')) {
            const parts = dosageStr.split('-');
            const dailySum = parts.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
            quantityToDeduct = Math.ceil(dailySum * days);
          } else {
            let unitDose = 1;
            if (dosageStr.includes('1/4')) unitDose = 0.25;
            else if (dosageStr.includes('1/3')) unitDose = 1 / 3;
            else if (dosageStr.includes('1/2')) unitDose = 0.5;
            else if (dosageStr.includes('2/3')) unitDose = 2 / 3;
            else if (dosageStr.includes('3/4')) unitDose = 0.75;
            else {
              const matchNum = dosageStr.match(/^([\d.]+)/);
              if (matchNum) unitDose = parseFloat(matchNum[1]) || 1;
            }

            let timesPerDay = 1;
            if (dosageStr.includes('tds') || dosageStr.includes('8h')) timesPerDay = 3;
            else if (dosageStr.includes('bd')) timesPerDay = 2;
            else if (dosageStr.includes('qds') || dosageStr.includes('6h')) timesPerDay = 4;
            else if (dosageStr.includes('4h')) timesPerDay = 6;
            else if (dosageStr.includes('2h')) timesPerDay = 12;
            else if (dosageStr.includes('eod')) timesPerDay = 0.5;
            else if (dosageStr.includes('weekly')) timesPerDay = 1 / 7;
            else if (dosageStr.includes('stat')) timesPerDay = 1 / Math.max(1, days);
            else timesPerDay = 1;

            quantityToDeduct = Math.ceil(unitDose * timesPerDay * days);
          }

          await db.query(
            `UPDATE drugs SET stock = GREATEST(0, stock - $1) WHERE id = $2`,
            [quantityToDeduct, parseInt(item.drug_id)]
          );
        }
      }
    }

    // 5. Insert or update investigations if provided
    if (investigations) {
      const invCheck = await db.query(
        'SELECT id FROM investigations WHERE visit_id = $1',
        [parseInt(id)]
      );
      if (invCheck.rows.length > 0) {
        await db.query(
          `UPDATE investigations
           SET fbc=$1, fbs=$2, lipid_profile=$3, ufr=$4, crp=$5, esr=$6,
               dengue_ns1=$7, influenza_ag=$8, lft=$9, tft=$10, rft=$11
           WHERE visit_id=$12`,
          [
            investigations.fbc || '', investigations.fbs || '',
            investigations.lipid_profile || '', investigations.ufr || '',
            investigations.crp || '', investigations.esr || '',
            investigations.dengue_ns1 || '', investigations.influenza_ag || '',
            investigations.lft || '', investigations.tft || '',
            investigations.rft || '', parseInt(id)
          ]
        );
      } else {
        await db.query(
          `INSERT INTO investigations
             (patient_id, visit_id, fbc, fbs, lipid_profile, ufr, crp, esr,
              dengue_ns1, influenza_ag, lft, tft, rft)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            patientId, parseInt(id),
            investigations.fbc || '', investigations.fbs || '',
            investigations.lipid_profile || '', investigations.ufr || '',
            investigations.crp || '', investigations.esr || '',
            investigations.dengue_ns1 || '', investigations.influenza_ag || '',
            investigations.lft || '', investigations.tft || '',
            investigations.rft || ''
          ]
        );
      }
    }

    await db.query('COMMIT');
    res.json({ message: 'Visit diagnostics recorded successfully', visit: visitUpdateRes.rows[0] });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Database transaction error completing visit' });
  }
});

// 5. Retrieve daily clinic statistics — scoped to doctor
router.get('/stats', authenticateToken, requirePermission('dashboard'), async (req, res) => {
  const { date } = req.query;
  const targetDate = date || new Date().toISOString().split('T')[0];

  try {
    const doctorId = await getDoctorId(req);

    const countRes = await db.query(
      'SELECT COUNT(*) AS count FROM visits WHERE visit_date = $1 AND doctor_id = $2',
      [targetDate, doctorId]
    );
    const patientCount = parseInt(countRes.rows[0].count);

    const incomeRes = await db.query(
      'SELECT SUM(paid_amount) AS income FROM visits WHERE visit_date = $1 AND doctor_id = $2',
      [targetDate, doctorId]
    );
    const dailyIncome = parseFloat(incomeRes.rows[0].income || 0.00);

    const expenditureRes = await db.query(
      'SELECT SUM(amount) AS expenditure FROM expenditures WHERE exp_date = $1 AND (doctor_id = $2 OR doctor_id IS NULL)',
      [targetDate, doctorId]
    );
    const dailyExpenditure = parseFloat(expenditureRes.rows[0].expenditure || 0.00);

    res.json({
      date: targetDate,
      patient_count: patientCount,
      daily_income: dailyIncome,
      daily_expenditure: dailyExpenditure,
      net_income: dailyIncome - dailyExpenditure
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching dashboard statistics' });
  }
});

module.exports = router;
