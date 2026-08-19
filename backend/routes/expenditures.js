const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// All expenditure routes require authentication and 'dashboard' permission
router.use(authenticateToken, requirePermission('dashboard'));

// ─────────────────────────────────────────────────────────────────────────────
// Helper: resolve the owning doctor_id from the authenticated user.
// ─────────────────────────────────────────────────────────────────────────────
async function getDoctorId(req) {
  if (req.user.role === 'doctor') return req.user.userId;
  const result = await db.query('SELECT doctor_id FROM users WHERE id = $1', [req.user.userId]);
  if (result.rows.length === 0 || !result.rows[0].doctor_id) {
    throw new Error('Assistant is not linked to a doctor.');
  }
  return result.rows[0].doctor_id;
}

// 1. Get expenditures — scoped to doctor (filtered by date, or all)
router.get('/', async (req, res) => {
  const { date } = req.query;
  try {
    const doctorId = await getDoctorId(req);
    let queryText, params;

    if (date) {
      queryText = 'SELECT * FROM expenditures WHERE doctor_id = $1 AND exp_date = $2 ORDER BY id DESC';
      params = [doctorId, date];
    } else {
      queryText = 'SELECT * FROM expenditures WHERE doctor_id = $1 ORDER BY exp_date DESC, id DESC';
      params = [doctorId];
    }

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error retrieving expenditures' });
  }
});

// 2. Add a new expenditure record — tagged with doctor_id
router.post('/', async (req, res) => {
  const { amount, description, category, exp_date } = req.body;

  if (!amount || !description) {
    return res.status(400).json({ error: 'Amount and description are required' });
  }

  const targetDate = exp_date || new Date().toISOString().split('T')[0];

  try {
    const doctorId = await getDoctorId(req);
    const queryText = `
      INSERT INTO expenditures (amount, description, category, exp_date, doctor_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await db.query(queryText, [
      parseFloat(amount),
      description,
      category || 'Supplies',
      targetDate,
      doctorId
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error adding expenditure' });
  }
});

// 3. Delete an expenditure record — scoped to doctor
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const doctorId = await getDoctorId(req);
    const result = await db.query(
      'DELETE FROM expenditures WHERE id = $1 AND doctor_id = $2 RETURNING *',
      [parseInt(id), doctorId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expenditure record not found' });
    }
    res.json({ message: 'Expenditure record deleted', expenditure: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error deleting expenditure' });
  }
});

module.exports = router;
