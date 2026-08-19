const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// All assistant management routes require a valid JWT + settings permission (Doctors bypass automatically)
router.use(authenticateToken, requirePermission('settings'));

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get the managing doctor ID (whether called by doctor or permitted assistant)
// ─────────────────────────────────────────────────────────────────────────────
async function getDoctorId(req) {
  if (req.user.role === 'doctor') {
    return req.user.userId;
  }
  // If assistant with settings permission:
  const res = await db.query('SELECT doctor_id FROM users WHERE id = $1', [req.user.userId]);
  return res.rows[0]?.doctor_id || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: verify assistant belongs to the requesting doctor / clinic
// ─────────────────────────────────────────────────────────────────────────────
async function verifyOwnership(assistantId, doctorId, res) {
  const check = await db.query(
    'SELECT id FROM users WHERE id = $1 AND doctor_id = $2 AND role = $3',
    [parseInt(assistantId), doctorId, 'assistant']
  );
  if (check.rows.length === 0) {
    res.status(404).json({ error: 'Assistant not found or does not belong to your clinic.' });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/assistants — list all assistants belonging to the clinic
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const doctorId = await getDoctorId(req);
    if (!doctorId) {
      return res.status(403).json({ error: 'Associated clinic account not found.' });
    }

    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.is_active, u.created_at,
              ap.dashboard, ap.patients, ap.drugs, ap.expenditures,
              ap.queue, ap.sms, ap.assistant, ap.doctor, ap.settings
       FROM users u
       LEFT JOIN assistant_permissions ap ON ap.assistant_id = u.id
       WHERE u.doctor_id = $1 AND u.role = 'assistant'
       ORDER BY u.created_at ASC`,
      [doctorId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching assistants.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/assistants — create a new assistant
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { name, email, passcode } = req.body;

  // Validate required fields
  if (!name || !email || !passcode) {
    return res.status(422).json({ error: 'Name, email, and passcode are required.' });
  }

  // Validate name length
  if (name.trim().length < 2) {
    return res.status(422).json({ error: 'Name must be at least 2 characters.' });
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(422).json({ error: 'Please enter a valid email address.' });
  }

  // Validate 4-digit numeric passcode — backend enforcement
  if (!/^\d{4}$/.test(String(passcode))) {
    return res.status(422).json({ error: 'Passcode must be exactly 4 numeric digits.' });
  }

  try {
    const doctorId = await getDoctorId(req);
    if (!doctorId) {
      return res.status(403).json({ error: 'Associated clinic account not found.' });
    }

    // Check email uniqueness
    const emailCheck = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Hash the passcode — NEVER store as plaintext
    const SALT_ROUNDS = 12;
    const passcodeHash = await bcrypt.hash(String(passcode), SALT_ROUNDS);

    // Insert assistant user
    const insertResult = await db.query(
      `INSERT INTO users (name, email, password_hash, role, doctor_id, is_active)
       VALUES ($1, $2, $3, 'assistant', $4, true)
       RETURNING id, name, email, is_active, created_at`,
      [name.trim(), email.toLowerCase().trim(), passcodeHash, doctorId]
    );

    const newAssistant = insertResult.rows[0];

    // Create default permissions row
    await db.query(
      `INSERT INTO assistant_permissions
         (assistant_id, dashboard, patients, drugs, expenditures, queue, sms, assistant, doctor, settings)
       VALUES ($1, false, true, false, false, true, false, true, false, false)`,
      [newAssistant.id]
    );

    // Return assistant with permissions — never return password_hash
    const fullResult = await db.query(
      `SELECT u.id, u.name, u.email, u.is_active, u.created_at,
              ap.dashboard, ap.patients, ap.drugs, ap.expenditures,
              ap.queue, ap.sms, ap.assistant, ap.doctor, ap.settings
       FROM users u
       LEFT JOIN assistant_permissions ap ON ap.assistant_id = u.id
       WHERE u.id = $1`,
      [newAssistant.id]
    );

    res.status(201).json(fullResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error creating assistant.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/assistants/:id — get single assistant with permissions
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const doctorId = await getDoctorId(req);
  if (!doctorId) return res.status(403).json({ error: 'Associated clinic account not found.' });

  const owned = await verifyOwnership(req.params.id, doctorId, res);
  if (!owned) return;

  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.is_active, u.created_at,
              ap.dashboard, ap.patients, ap.drugs, ap.expenditures,
              ap.queue, ap.sms, ap.assistant, ap.doctor, ap.settings
       FROM users u
       LEFT JOIN assistant_permissions ap ON ap.assistant_id = u.id
       WHERE u.id = $1`,
      [parseInt(req.params.id)]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error fetching assistant.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/assistants/:id — update assistant name/email (not passcode/role)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const doctorId = await getDoctorId(req);
  if (!doctorId) return res.status(403).json({ error: 'Associated clinic account not found.' });

  const owned = await verifyOwnership(req.params.id, doctorId, res);
  if (!owned) return;

  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(422).json({ error: 'Name and email are required.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(422).json({ error: 'Please enter a valid email address.' });
  }

  try {
    // Check email uniqueness (excluding self)
    const emailCheck = await db.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email.toLowerCase().trim(), parseInt(req.params.id)]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'This email is already in use by another account.' });
    }

    const result = await db.query(
      `UPDATE users
       SET name = $1, email = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, name, email, is_active, updated_at`,
      [name.trim(), email.toLowerCase().trim(), parseInt(req.params.id)]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error updating assistant.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/assistants/:id — permanently delete assistant
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const doctorId = await getDoctorId(req);
  if (!doctorId) return res.status(403).json({ error: 'Associated clinic account not found.' });

  const owned = await verifyOwnership(req.params.id, doctorId, res);
  if (!owned) return;

  try {
    await db.query('DELETE FROM users WHERE id = $1', [parseInt(req.params.id)]);
    res.json({ message: 'Assistant account deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error deleting assistant.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/assistants/:id/permissions — update assistant page permissions
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id/permissions', async (req, res) => {
  const doctorId = await getDoctorId(req);
  if (!doctorId) return res.status(403).json({ error: 'Associated clinic account not found.' });

  const owned = await verifyOwnership(req.params.id, doctorId, res);
  if (!owned) return;

  const { dashboard, patients, drugs, expenditures, queue, sms, assistant, doctor, settings } = req.body;

  // Coerce all values to boolean — never trust frontend role/permission values
  const toBoolean = (val) => val === true || val === 'true' || val === 1;

  try {
    const result = await db.query(
      `UPDATE assistant_permissions
       SET dashboard = $1, patients = $2, drugs = $3, expenditures = $4,
           queue = $5, sms = $6, assistant = $7, doctor = $8, settings = $9,
           updated_at = CURRENT_TIMESTAMP
       WHERE assistant_id = $10
       RETURNING *`,
      [
        toBoolean(dashboard), toBoolean(patients), toBoolean(drugs),
        toBoolean(expenditures), toBoolean(queue), toBoolean(sms),
        toBoolean(assistant), toBoolean(doctor), toBoolean(settings),
        parseInt(req.params.id)
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Permissions record not found.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error updating permissions.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/assistants/:id/status — toggle active/inactive
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id/status', async (req, res) => {
  const doctorId = await getDoctorId(req);
  if (!doctorId) return res.status(403).json({ error: 'Associated clinic account not found.' });

  const owned = await verifyOwnership(req.params.id, doctorId, res);
  if (!owned) return;

  const { is_active } = req.body;

  if (typeof is_active === 'undefined') {
    return res.status(422).json({ error: 'is_active field is required.' });
  }

  try {
    const result = await db.query(
      `UPDATE users
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, email, is_active`,
      [is_active === true || is_active === 'true', parseInt(req.params.id)]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error updating assistant status.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/assistants/:id/passcode — reset assistant passcode
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id/passcode', async (req, res) => {
  const doctorId = await getDoctorId(req);
  if (!doctorId) return res.status(403).json({ error: 'Associated clinic account not found.' });

  const owned = await verifyOwnership(req.params.id, doctorId, res);
  if (!owned) return;

  const { passcode } = req.body;

  if (!passcode || !/^\d{4}$/.test(String(passcode))) {
    return res.status(422).json({ error: 'Passcode must be exactly 4 numeric digits.' });
  }

  try {
    const SALT_ROUNDS = 12;
    const passcodeHash = await bcrypt.hash(String(passcode), SALT_ROUNDS);

    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passcodeHash, parseInt(req.params.id)]
    );

    res.json({ message: 'Passcode updated successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error updating passcode.' });
  }
});

module.exports = router;
