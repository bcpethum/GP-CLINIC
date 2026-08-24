const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend accessibility (Next.js client)
// Allow Authorization header for JWT Bearer tokens
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

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

app.listen(PORT, () => {
  console.log(`GP Clinic (DocWallet) backend server running on port ${PORT}`);
});
