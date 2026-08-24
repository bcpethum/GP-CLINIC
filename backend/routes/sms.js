const express = require('express');
const https = require('https');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

/* ── Helper: get doctor ID from the logged-in user ── */
async function getDoctorId(req) {
  if (req.user.role === 'doctor') return req.user.userId;
  const res = await db.query('SELECT doctor_id FROM users WHERE id = $1', [req.user.userId]);
  return res.rows[0]?.doctor_id || null;
}

/* ── Helper: ensure sms_credentials table exists ── */
let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS sms_credentials (
      id          SERIAL PRIMARY KEY,
      doctor_id   INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      user_id     TEXT NOT NULL DEFAULT '',
      api_key     TEXT NOT NULL DEFAULT '',
      sender_id   TEXT NOT NULL DEFAULT 'SMSlenzDEMO',
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  tableReady = true;
}

/* ── Helper: resolve credentials for a doctor ── */
async function resolveCreds(doctorId) {
  await ensureTable();

  // 1. Try per-doctor DB record
  if (doctorId) {
    const res = await db.query(
      'SELECT user_id, api_key, sender_id FROM sms_credentials WHERE doctor_id = $1',
      [doctorId]
    );
    if (res.rows.length && res.rows[0].user_id && res.rows[0].api_key) {
      return res.rows[0];
    }
  }

  // 2. Fall back to .env
  const envUserId = process.env.SMSLENZ_USER_ID;
  const envApiKey = process.env.SMSLENZ_API_KEY;
  const envSenderId = process.env.SMSLENZ_SENDER_ID || 'SMSlenzDEMO';
  if (envUserId && envApiKey) {
    return { user_id: envUserId, api_key: envApiKey, sender_id: envSenderId };
  }

  return null;
}

/* ── HTTP POST helper using Node's built-in https ── */
function smsPost(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: 'smslenz.lk',
      path: `/api${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`SMSlenz returned non-JSON response: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('SMSlenz request timed out')); });
    req.write(payload);
    req.end();
  });
}

/* ────────────────────────────────────────────────
   GET  /api/sms/credentials
   Returns stored credential info (api_key masked)
   ──────────────────────────────────────────────── */
router.get('/credentials', async (req, res) => {
  try {
    const doctorId = await getDoctorId(req);
    await ensureTable();

    if (doctorId) {
      const dbRes = await db.query(
        `SELECT user_id, sender_id,
                CASE WHEN api_key != '' THEN LEFT(api_key,4) || '****' ELSE '' END as api_key_masked,
                updated_at
         FROM sms_credentials WHERE doctor_id = $1`,
        [doctorId]
      );
      if (dbRes.rows.length) {
        return res.json({ source: 'database', ...dbRes.rows[0] });
      }
    }

    const envUserId = process.env.SMSLENZ_USER_ID;
    const envSenderId = process.env.SMSLENZ_SENDER_ID || 'SMSlenzDEMO';
    if (envUserId) {
      return res.json({ source: 'env', user_id: envUserId, sender_id: envSenderId, api_key_masked: '****' });
    }
    res.json({ source: 'none' });
  } catch (err) {
    console.error('[SMS] credentials GET error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ────────────────────────────────────────────────
   POST /api/sms/credentials
   Save per-doctor credentials to DB
   ──────────────────────────────────────────────── */
router.post('/credentials', async (req, res) => {
  try {
    const doctorId = await getDoctorId(req);
    if (!doctorId) return res.status(400).json({ error: 'Could not determine doctor account' });
    const { user_id, api_key, sender_id = 'SMSlenzDEMO' } = req.body;
    if (!user_id || !api_key) return res.status(400).json({ error: 'user_id and api_key are required' });

    await ensureTable();
    await db.query(`
      INSERT INTO sms_credentials (doctor_id, user_id, api_key, sender_id, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (doctor_id) DO UPDATE
        SET user_id = $2, api_key = $3, sender_id = $4, updated_at = NOW()
    `, [doctorId, user_id, api_key, sender_id]);

    res.json({ success: true, message: 'SMS credentials saved' });
  } catch (err) {
    console.error('[SMS] credentials POST error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ────────────────────────────────────────────────
   DELETE /api/sms/credentials
   Remove per-doctor credentials
   ──────────────────────────────────────────────── */
router.delete('/credentials', async (req, res) => {
  try {
    const doctorId = await getDoctorId(req);
    await ensureTable();
    await db.query('DELETE FROM sms_credentials WHERE doctor_id = $1', [doctorId]);
    res.json({ success: true, message: 'Credentials removed. Will use system .env defaults.' });
  } catch (err) {
    console.error('[SMS] credentials DELETE error:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ────────────────────────────────────────────────
   POST /api/sms/status
   Check SMSlenz account balance
   ──────────────────────────────────────────────── */
router.post('/status', async (req, res) => {
  try {
    const doctorId = await getDoctorId(req);
    const creds = await resolveCreds(doctorId);
    if (!creds) {
      return res.status(400).json({ success: false, message: 'SMS credentials not configured. Add SMSLENZ_USER_ID and SMSLENZ_API_KEY to backend/.env' });
    }

    console.log(`[SMS] Checking status for user_id=${creds.user_id}`);
    const data = await smsPost('/account-status', {
      user_id: creds.user_id,
      api_key: creds.api_key,
    });
    console.log('[SMS] Status response:', JSON.stringify(data));
    res.json(data);
  } catch (err) {
    console.error('[SMS] status error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ────────────────────────────────────────────────
   POST /api/sms/send
   Send single SMS
   Body: { contact, message }
   ──────────────────────────────────────────────── */
router.post('/send', async (req, res) => {
  try {
    const doctorId = await getDoctorId(req);
    const creds = await resolveCreds(doctorId);
    if (!creds) {
      return res.status(400).json({ success: false, message: 'SMS credentials not configured. Add SMSLENZ_USER_ID and SMSLENZ_API_KEY to backend/.env' });
    }

    const { contact, message } = req.body;
    if (!contact || !message) return res.status(400).json({ error: 'contact and message are required' });

    console.log(`[SMS] Sending to ${contact} using sender_id=${creds.sender_id}`);
    const data = await smsPost('/send-sms', {
      user_id: creds.user_id,
      api_key: creds.api_key,
      sender_id: creds.sender_id,
      contact,
      message,
    });
    console.log('[SMS] Send response:', JSON.stringify(data));
    res.json(data);
  } catch (err) {
    console.error('[SMS] send error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ────────────────────────────────────────────────
   POST /api/sms/send-bulk
   Send bulk SMS
   Body: { contacts: string[], message: string }
   ──────────────────────────────────────────────── */
router.post('/send-bulk', async (req, res) => {
  try {
    const doctorId = await getDoctorId(req);
    const creds = await resolveCreds(doctorId);
    if (!creds) {
      return res.status(400).json({ success: false, message: 'SMS credentials not configured. Add SMSLENZ_USER_ID and SMSLENZ_API_KEY to backend/.env' });
    }

    const { contacts, message } = req.body;
    if (!Array.isArray(contacts) || contacts.length === 0 || !message) {
      return res.status(400).json({ error: 'contacts (array) and message are required' });
    }

    console.log(`[SMS] Bulk sending to ${contacts.length} contacts`);
    const data = await smsPost('/send-bulk-sms', {
      user_id: creds.user_id,
      api_key: creds.api_key,
      sender_id: creds.sender_id,
      contacts,
      message,
    });
    console.log('[SMS] Bulk send response:', JSON.stringify(data));
    res.json(data);
  } catch (err) {
    console.error('[SMS] bulk send error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
