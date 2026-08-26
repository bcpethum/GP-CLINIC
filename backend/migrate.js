const db = require('./db');
const fs = require('fs');
const path = require('path');

const MIGRATION_FILES = [
  '001_add_auth.sql',
  '002_add_settings.sql',
  '002_doctor_data_isolation.sql',
  'add_shared_documents.sql',
  '003_ensure_schema.sql'
];

async function runMigrations() {
  console.log('🔄 Checking and applying database migrations...');
  const migrationsDir = path.join(__dirname, 'migrations');

  for (const file of MIGRATION_FILES) {
    const filePath = path.join(migrationsDir, file);
    if (!fs.existsSync(filePath)) continue;

    try {
      const sql = fs.readFileSync(filePath, 'utf8');
      await db.query(sql);
      console.log(`✅ Migration applied successfully: ${file}`);
    } catch (err) {
      console.warn(`⚠️ Migration notice for ${file}:`, err.message);
    }
  }
  console.log('✅ Database migration check completed.');
}

module.exports = runMigrations;
