const jwt = require('jsonwebtoken');
const db = require('../db');

/**
 * authenticateToken
 * ─────────────────
 * Verifies the JWT from the Authorization: Bearer header.
 * On success, attaches req.user = { userId, role, email }
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { userId, role, email }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
}

/**
 * requireRole(...roles)
 * ─────────────────────
 * Middleware factory. Allows only users whose role is in the roles list.
 * Usage: requireRole('doctor') or requireRole('doctor', 'assistant')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires role: ${roles.join(' or ')}.`
      });
    }
    next();
  };
}

/**
 * requirePermission(permission)
 * ──────────────────────────────
 * Middleware factory.
 * - Doctors: always allowed (bypass).
 * - Assistants: queries assistant_permissions to check the column.
 * - Inactive assistants are always rejected.
 *
 * Usage: requirePermission('patients')
 */
function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }

    // Doctors have full access
    if (req.user.role === 'doctor') {
      return next();
    }

    // Assistants: check their permission and active status
    if (req.user.role === 'assistant') {
      try {
        const result = await db.query(
          `SELECT u.is_active, ap.${permission}
           FROM users u
           LEFT JOIN assistant_permissions ap ON ap.assistant_id = u.id
           WHERE u.id = $1`,
          [req.user.userId]
        );

        if (result.rows.length === 0) {
          return res.status(401).json({ error: 'User account not found.' });
        }

        const { is_active, [permission]: hasPermission } = result.rows[0];

        if (!is_active) {
          return res.status(403).json({ error: 'Your account has been deactivated. Please contact the doctor.' });
        }

        if (!hasPermission) {
          return res.status(403).json({
            error: `You do not have permission to access this feature. Contact your doctor to enable "${permission}" access.`
          });
        }

        return next();
      } catch (err) {
        console.error('Permission check error:', err);
        return res.status(500).json({ error: 'Internal server error during authorization.' });
      }
    }

    // Unknown role
    return res.status(403).json({ error: 'Access denied.' });
  };
}

module.exports = { authenticateToken, requireRole, requirePermission };
