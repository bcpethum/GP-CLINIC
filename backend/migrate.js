const db = require('./db');
const fs = require('fs');
const path = require('path');

// full_schema.sql runs first and creates all tables correctly (IF NOT EXISTS).
// Subsequent migration files patch older databases.
const MIGRATION_FILES = [
  { file: '../full_schema.sql', dir: __dirname },          // canonical schema
  { file: 'migrations/001_add_auth.sql', dir: __dirname },
  { file: 'migrations/002_add_settings.sql', dir: __dirname },
  { file: 'migrations/002_doctor_data_isolation.sql', dir: __dirname },
  { file: 'migrations/add_shared_documents.sql', dir: __dirname },
  { file: 'migrations/003_ensure_schema.sql', dir: __dirname },
];

// Split a SQL file into individual statements, correctly handling DO $$ blocks
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inDollarBlock = false;

  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    if (!inDollarBlock && (trimmed.startsWith('--') || trimmed === '')) continue;

    current += line + '\n';

    // Track opening/closing $$ dollar-quote blocks
    const dollarCount = (line.match(/\$\$/g) || []).length;
    if (dollarCount % 2 !== 0) inDollarBlock = !inDollarBlock;

    if (!inDollarBlock && trimmed.endsWith(';')) {
      const stmt = current.trim();
      if (stmt && stmt !== ';') statements.push(stmt);
      current = '';
    }
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

async function runMigrations() {
  console.log('🔄 Checking and applying database migrations...');

  for (const { file, dir } of MIGRATION_FILES) {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) continue;

    const label = path.basename(file);
    console.log(`📄 Running: ${label}`);
    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = splitSqlStatements(sql);
    let ok = 0, warn = 0;

    for (const stmt of statements) {
      try {
        await db.query(stmt);
        ok++;
      } catch (err) {
        const expected =
          err.code === '42701' || // duplicate_column
          err.code === '42P07' || // duplicate_table
          err.code === '42710' || // duplicate_object
          err.message.includes('already exists');
        if (!expected) {
          console.warn(`  ⚠️  [${label}] ${err.message.split('\n')[0]}`);
          warn++;
        }
      }
    }
    console.log(`  ✅ ${label}: ${ok} ok${warn ? `, ${warn} warnings` : ''}`);
  }

  console.log('✅ Database setup complete.');
}

module.exports = runMigrations;
