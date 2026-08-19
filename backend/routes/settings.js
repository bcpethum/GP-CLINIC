const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// All settings routes require a valid JWT token
router.use(authenticateToken);

// Helper to determine the owning doctor ID
async function getDoctorId(req) {
  if (req.user.role === 'doctor') {
    return req.user.userId;
  }
  const res = await db.query('SELECT doctor_id FROM users WHERE id = $1', [req.user.userId]);
  return res.rows[0]?.doctor_id || null;
}

// Auto-ensure table exists on first run
let tableEnsured = false;
async function ensureSettingsTable() {
  if (tableEnsured) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS clinic_settings (
        id SERIAL PRIMARY KEY,
        doctor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        setting_key VARCHAR(100) NOT NULL,
        setting_value JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_doctor_setting UNIQUE (doctor_id, setting_key)
      );
    `);
    tableEnsured = true;
  } catch (err) {
    console.error('Error ensuring clinic_settings table:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings — fetch all settings for current clinic / doctor
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    await ensureSettingsTable();
    const doctorId = await getDoctorId(req);
    if (!doctorId) {
      return res.status(403).json({ error: 'Clinic account not found.' });
    }

    const result = await db.query(
      'SELECT setting_key, setting_value FROM clinic_settings WHERE doctor_id = $1',
      [doctorId]
    );

    const settingsMap = {};
    result.rows.forEach(row => {
      settingsMap[row.setting_key] = row.setting_value;
    });

    res.json(settingsMap);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Database error fetching clinic settings.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/settings/:key — fetch specific setting key
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:key', async (req, res) => {
  try {
    await ensureSettingsTable();
    const doctorId = await getDoctorId(req);
    if (!doctorId) {
      return res.status(403).json({ error: 'Clinic account not found.' });
    }

    const result = await db.query(
      'SELECT setting_value FROM clinic_settings WHERE doctor_id = $1 AND setting_key = $2',
      [doctorId, req.params.key]
    );

    if (result.rows.length === 0) {
      return res.json({ value: null });
    }

    res.json({ value: result.rows[0].setting_value });
  } catch (err) {
    console.error('Error fetching setting:', err);
    res.status(500).json({ error: 'Database error fetching setting.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/settings/:key — save or update a setting
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:key', async (req, res) => {
  try {
    await ensureSettingsTable();
    const doctorId = await getDoctorId(req);
    if (!doctorId) {
      return res.status(403).json({ error: 'Clinic account not found.' });
    }

    const key = req.params.key;
    const value = req.body;

    const query = `
      INSERT INTO clinic_settings (doctor_id, setting_key, setting_value, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (doctor_id, setting_key)
      DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
      RETURNING setting_key, setting_value;
    `;

    const result = await db.query(query, [doctorId, key, JSON.stringify(value)]);
    res.json({ success: true, setting: result.rows[0] });
  } catch (err) {
    console.error('Error saving setting:', err);
    res.status(500).json({ error: 'Database error saving setting.' });
  }
});

module.exports = router;
