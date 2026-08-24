// Run this once: node scripts/run_migration.js
const db = require('../db');
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, '../migrations/add_shared_documents.sql'), 'utf8');

db.query(sql)
  .then(() => {
    console.log('✅ Migration complete: shared_documents table created.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  });
