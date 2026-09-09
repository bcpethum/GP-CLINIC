const db = require('./db');
const fs = require('fs');
const path = require('path');

// Single source-of-truth schema.
// All tables, columns, indexes, and patches are in schema.sql.
// No separate migration files needed.
const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

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
  console.log('🔄 Applying database schema...');

  if (!fs.existsSync(SCHEMA_FILE)) {
    console.error('❌ schema.sql not found at', SCHEMA_FILE);
    return;
  }

  const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
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
        err.message.includes('already exists') ||
        err.message.includes('does not exist');  // DROP NOT NULL on already-nullable column

      if (!expected) {
        console.warn(`  ⚠️  ${err.message.split('\n')[0]}`);
        warn++;
      }
    }
  }

  console.log(`  ✅ schema.sql: ${ok} ok${warn ? `, ${warn} warnings` : ''}`);
  console.log('✅ Database setup complete.');
}

module.exports = runMigrations;
