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

// Split a SQL file into individual statements, handling DO $$ blocks correctly
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inDollarBlock = false;

  const lines = sql.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip pure comment lines and empty lines when not building a statement
    if (!inDollarBlock && (trimmed.startsWith('--') || trimmed === '')) {
      continue;
    }

    current += line + '\n';

    // Track $$ dollar-quote blocks (used in DO $$ ... $$ statements)
    const dollarMatches = (line.match(/\$\$/g) || []).length;
    if (dollarMatches % 2 !== 0) {
      inDollarBlock = !inDollarBlock;
    }

    // A statement ends at semicolon when not inside a $$ block
    if (!inDollarBlock && trimmed.endsWith(';')) {
      const stmt = current.trim();
      if (stmt && stmt !== ';') {
        statements.push(stmt);
      }
      current = '';
    }
  }

  // Push any remaining content
  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

async function runMigrations() {
  console.log('🔄 Checking and applying database migrations...');
  const migrationsDir = path.join(__dirname, 'migrations');

  for (const file of MIGRATION_FILES) {
    const filePath = path.join(migrationsDir, file);
    if (!fs.existsSync(filePath)) continue;

    console.log(`📄 Running migration: ${file}`);
    const sql = fs.readFileSync(filePath, 'utf8');
    const statements = splitSqlStatements(sql);
    let successCount = 0;
    let warnCount = 0;

    for (const stmt of statements) {
      try {
        await db.query(stmt);
        successCount++;
      } catch (err) {
        // Ignore "already exists" type errors — those are expected on re-runs
        const isExpected = err.message.includes('already exists') ||
                           err.code === '42701' || // duplicate_column
                           err.code === '42P07' || // duplicate_table
                           err.code === '42710';   // duplicate_object
        if (isExpected) {
          // silently skip
        } else {
          console.warn(`  ⚠️  [${file}] Statement warning: ${err.message}`);
          console.warn(`     Statement: ${stmt.substring(0, 120).replace(/\s+/g, ' ')}...`);
          warnCount++;
        }
      }
    }
    console.log(`  ✅ ${file}: ${successCount} ok, ${warnCount} warnings`);
  }
  console.log('✅ Database migration check completed.');
}

module.exports = runMigrations;
