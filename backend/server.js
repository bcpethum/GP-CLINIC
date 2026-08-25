const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend accessibility (Next.js client)
// Strips trailing slashes so env var typos don't break it
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : null,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, Render health checks)
    if (!origin) return callback(null, true);
    // Strip trailing slash from incoming origin before comparing
    const cleanOrigin = origin.replace(/\/$/, '');
    // Allow any vercel.app preview URL for this project
    const isVercel = cleanOrigin.endsWith('.vercel.app');
    if (isVercel || allowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked origin: ${origin}`);
    callback(new Error(`CORS: Origin ${origin} not allowed`));
  },
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Normalize double/duplicate leading slashes in URLs (e.g. //api/documents -> /api/documents)
app.use((req, res, next) => {
  if (req.url && req.url.startsWith('//')) {
    req.url = req.url.replace(/^\/+/, '/');
  }
  next();
});

// Parse incoming request JSON payloads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Auto-create uploads directory if it does not exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve diagnostic images statically
app.use('/uploads', express.static(uploadsDir));

// ─────────────────────────────────────────────────────────────────────────────
// Import routes
// ─────────────────────────────────────────────────────────────────────────────
const authRouter = require('./routes/auth');
const patientsRouter = require('./routes/patients');
const queueRouter = require('./routes/queue');
const drugsRouter = require('./routes/drugs');
const expendituresRouter = require('./routes/expenditures');
const assistantsRouter = require('./routes/assistants');
const settingsRouter = require('./routes/settings');
const smsRouter = require('./routes/sms');
const documentsRouter = require('./routes/documents');

// ─────────────────────────────────────────────────────────────────────────────
// Mount routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);           // Public: login endpoints
app.use('/api/assistants', assistantsRouter); // Protected: assistant management
app.use('/api/settings', settingsRouter);   // Protected: clinic & prescription settings
app.use('/api/patients', patientsRouter);
app.use('/api/queue', queueRouter);
app.use('/api/drugs', drugsRouter);
app.use('/api/expenditures', expendituresRouter);
app.use('/api/sms', smsRouter);             // Protected: SMS proxy (credentials never exposed)
app.use('/api/documents', documentsRouter); // Mixed: share doc (protected POST, public GET)

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', time: new Date() });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Run database migrations on start
const runMigrations = require('./migrate');
runMigrations().catch(err => console.error('Migration initialization error:', err));

app.listen(PORT, () => {
  console.log(`GP Clinic (DocWallet) backend server running on port ${PORT}`);
});
