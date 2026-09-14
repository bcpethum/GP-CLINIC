const db = require('./db');

async function migrate() {
  try {
    await db.query("ALTER TABLE drugs ADD COLUMN IF NOT EXISTS default_dose_qty VARCHAR(10) NOT NULL DEFAULT '1'");
    console.log('Added default_dose_qty');
    await db.query("ALTER TABLE drugs ADD COLUMN IF NOT EXISTS default_dose_freq VARCHAR(20) NOT NULL DEFAULT 'TDS'");
    console.log('Added default_dose_freq');
    await db.query('ALTER TABLE drugs ADD COLUMN IF NOT EXISTS default_duration_days INTEGER NOT NULL DEFAULT 3');
    console.log('Added default_duration_days');
    console.log('Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
