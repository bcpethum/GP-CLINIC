const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: resolve doctor_id from the authenticated user
// ─────────────────────────────────────────────────────────────────────────────
async function getDoctorId(req) {
  if (req.user.role === 'doctor') return req.user.userId;
  const result = await db.query('SELECT doctor_id FROM users WHERE id = $1', [req.user.userId]);
  if (result.rows.length === 0 || !result.rows[0].doctor_id) {
    throw new Error('Assistant is not linked to a doctor.');
  }
  return result.rows[0].doctor_id;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/documents/share  (protected)
// Body: { html, doc_type, patient_name, expiry_hours? }
// Returns: { token, url, expires_at }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/share', authenticateToken, async (req, res) => {
  const { html, doc_type = 'document', patient_name = '', expiry_hours = 48 } = req.body;

  if (!html || typeof html !== 'string') {
    return res.status(400).json({ error: 'html is required' });
  }

  try {
    const doctorId = await getDoctorId(req);

    // Sanitize expiry: minimum 1 hour, maximum 30 days (720 hours)
    const hours = Math.min(Math.max(parseInt(expiry_hours) || 48, 1), 720);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const result = await db.query(
      `INSERT INTO shared_documents (doctor_id, doc_type, patient_name, html_content, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING token, expires_at`,
      [doctorId, doc_type, patient_name, html, expiresAt]
    );

    const { token, expires_at } = result.rows[0];

    // Build the public URL — uses the backend server's own origin (strip any trailing slashes)
    const rawBaseUrl = process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`;
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');
    const url = `${baseUrl}/documents/share/${token}`;

    res.json({ token, url, expires_at });
  } catch (err) {
    console.error('[documents/share POST]', err);
    res.status(500).json({ error: 'Failed to create shareable link' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/documents/share/:token  (PUBLIC — no auth required)
// Returns the stored HTML document directly so patients can view in browser
// ─────────────────────────────────────────────────────────────────────────────
router.get('/share/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const result = await db.query(
      'SELECT * FROM shared_documents WHERE token = $1',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(buildErrorPage('Document Not Found', 'This link is invalid or has been removed.'));
    }

    const doc = result.rows[0];

    // Check expiry
    if (new Date() > new Date(doc.expires_at)) {
      return res.status(410).send(buildErrorPage('Link Expired', `This document link expired on ${new Date(doc.expires_at).toLocaleString()}. Please ask your doctor to generate a new link.`));
    }

    // Increment view count (fire-and-forget)
    db.query('UPDATE shared_documents SET view_count = view_count + 1 WHERE token = $1', [token]).catch(() => { });

    // Strip the auto-print onload so it just renders (patient views, not auto-prints)
    const safeHtml = doc.html_content.replace(/(<body)[^>]*(>)/i, '$1$2');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.send(safeHtml);
  } catch (err) {
    console.error('[documents/share GET]', err);
    res.status(500).send(buildErrorPage('Server Error', 'An error occurred while loading this document. Please try again.'));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/documents/shared  (protected — list doctor's shared links)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/shared', authenticateToken, async (req, res) => {
  try {
    const doctorId = await getDoctorId(req);
    const result = await db.query(
      `SELECT id, token, doc_type, patient_name, created_at, expires_at, view_count
       FROM shared_documents
       WHERE doctor_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [doctorId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[documents/shared GET]', err);
    res.status(500).json({ error: 'Failed to load shared documents' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/documents/share/:token  (protected — revoke a link)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/share/:token', authenticateToken, async (req, res) => {
  const { token } = req.params;
  try {
    const doctorId = await getDoctorId(req);
    const result = await db.query(
      'DELETE FROM shared_documents WHERE token = $1 AND doctor_id = $2 RETURNING id',
      [token, doctorId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Link not found or not authorized' });
    }
    res.json({ message: 'Link revoked successfully' });
  } catch (err) {
    console.error('[documents/share DELETE]', err);
    res.status(500).json({ error: 'Failed to revoke link' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build a clean error HTML page for expired/invalid links
// ─────────────────────────────────────────────────────────────────────────────
function buildErrorPage(title, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — GP Clinic</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 48px 40px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .icon { font-size: 3rem; margin-bottom: 20px; }
    h1 { font-size: 1.4rem; color: #0f172a; font-weight: 700; margin-bottom: 12px; }
    p { font-size: 0.95rem; color: #64748b; line-height: 1.6; }
    .badge {
      display: inline-block;
      margin-top: 20px;
      font-size: 0.78rem;
      color: #0284c7;
      background: #e0f2fe;
      padding: 4px 14px;
      border-radius: 20px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${title === 'Link Expired' ? '⏰' : '🔍'}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <span class="badge">GP Clinic — DocWallet</span>
  </div>
</body>
</html>`;
}

module.exports = router;
