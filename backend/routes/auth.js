const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Generate JWT
// ─────────────────────────────────────────────────────────────────────────────
function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/doctor/login
// ─────────────────────────────────────────────────────────────────────────────
router.post('/doctor/login', async (req, res) => {
  const { email, password } = req.body;

  // Validate input presence
  if (!email || !password) {
    return res.status(422).json({ error: 'Email and password are required.' });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(422).json({ error: 'Please enter a valid email address.' });
  }

  try {
    // Find doctor account
    const result = await db.query(
      'SELECT id, name, email, password_hash, role, is_active FROM users WHERE email = $1 AND role = $2',
      [email.toLowerCase().trim(), 'doctor']
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Your account has been deactivated.' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT — NEVER include password_hash
    const token = generateToken({
      userId: user.id,
      role: user.role,
      email: user.email
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: null // doctors have full access, no permission object needed
      }
    });
  } catch (err) {
    console.error('Doctor login error:', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/assistant/login
// ─────────────────────────────────────────────────────────────────────────────
router.post('/assistant/login', async (req, res) => {
  const { email, passcode } = req.body;

  if (!email || !passcode) {
    return res.status(422).json({ error: 'Email and passcode are required.' });
  }

  // Validate 4-digit numeric passcode
  if (!/^\d{4}$/.test(String(passcode))) {
    return res.status(422).json({ error: 'Passcode must be exactly 4 numeric digits.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(422).json({ error: 'Please enter a valid email address.' });
  }

  try {
    // Find assistant account
    const result = await db.query(
      'SELECT id, name, email, password_hash, role, is_active, doctor_id FROM users WHERE email = $1 AND role = $2',
      [email.toLowerCase().trim(), 'assistant']
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or passcode.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Your account has been deactivated. Please contact your doctor.' });
    }

    // Verify passcode (stored as bcrypt hash)
    const passcodeMatch = await bcrypt.compare(String(passcode), user.password_hash);
    if (!passcodeMatch) {
      return res.status(401).json({ error: 'Invalid email or passcode.' });
    }

    // Fetch permissions
    const permResult = await db.query(
      'SELECT dashboard, patients, drugs, expenditures, queue, sms, assistant, doctor, settings FROM assistant_permissions WHERE assistant_id = $1',
      [user.id]
    );

    const permissions = permResult.rows[0] || {
      dashboard: false, patients: true, drugs: false, expenditures: false,
      queue: true, sms: false, assistant: true, doctor: false, settings: false
    };

    // Generate JWT
    const token = generateToken({
      userId: user.id,
      role: user.role,
      email: user.email
    });

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        doctor_id: user.doctor_id,
        permissions
      }
    });
  } catch (err) {
    console.error('Assistant login error:', err);
    return res.status(500).json({ error: 'Server error during login.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// Returns the current user based on JWT — used on page reload to restore session
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, is_active, doctor_id FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account deactivated.' });
    }

    let permissions = null;

    if (user.role === 'assistant') {
      const permResult = await db.query(
        'SELECT dashboard, patients, drugs, expenditures, queue, sms, assistant, doctor, settings FROM assistant_permissions WHERE assistant_id = $1',
        [user.id]
      );
      permissions = permResult.rows[0] || {
        dashboard: false, patients: true, drugs: false, expenditures: false,
        queue: true, sms: false, assistant: true, doctor: false, settings: false
      };
    }

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      doctor_id: user.doctor_id,
      permissions
    });
  } catch (err) {
    console.error('GET /me error:', err);
    return res.status(500).json({ error: 'Server error fetching user.' });
  }
});

module.exports = router;
