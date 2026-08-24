/**
 * GP Clinic — Doctor Account Seeder
 * ────────────────────────────────────
 * Creates the initial doctor account securely.
 *
 * Usage:
 *   node scripts/seed-doctor.js
 *
 * The script will prompt for doctor details and hash the password
 * before inserting into the database. Never stores plaintext passwords.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const readline = require('readline');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function askHidden(question) {
  // Hide password input (basic technique for Node.js CLI)
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let password = '';
    process.stdin.on('data', function handler(char) {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', handler);
        process.stdout.write('\n');
        resolve(password);
      } else if (char === '\u0003') {
        // Ctrl+C
        process.exit();
      } else if (char === '\u007F') {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else {
        password += char;
        process.stdout.write('*');
      }
    });
  });
}

async function seed() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  GP Clinic — Doctor Account Seeder      ║');
  console.log('╚══════════════════════════════════════════╝\n');

  try {
    // Check if any doctor already exists
    const existing = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'doctor'");
    const doctorCount = parseInt(existing.rows[0].count);

    if (doctorCount > 0) {
      console.log(`⚠️  Warning: ${doctorCount} doctor account(s) already exist in the database.`);
      const proceed = await ask('Do you want to create another doctor account? (yes/no): ');
      if (proceed.toLowerCase() !== 'yes') {
        console.log('\n✅ Seeding cancelled. Existing account preserved.\n');
        process.exit(0);
      }
    }

    // Collect doctor details
    const name = await ask('Doctor Full Name: ');
    const email = await ask('Doctor Email: ');

    if (!name.trim() || !email.trim()) {
      console.error('\n❌ Name and email are required.\n');
      process.exit(1);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      console.error('\n❌ Invalid email format.\n');
      process.exit(1);
    }

    // Check email uniqueness
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (emailCheck.rows.length > 0) {
      console.error('\n❌ An account with this email already exists.\n');
      process.exit(1);
    }

    const password = await askHidden('Password (min 8 chars): ');

    if (password.length < 8) {
      console.error('\n❌ Password must be at least 8 characters.\n');
      process.exit(1);
    }

    const confirmPassword = await askHidden('Confirm Password: ');

    if (password !== confirmPassword) {
      console.error('\n❌ Passwords do not match.\n');
      process.exit(1);
    }

    // Hash password
    console.log('\n🔐 Hashing password...');
    const SALT_ROUNDS = 12;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Insert doctor
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'doctor', true)
       RETURNING id, name, email, role, created_at`,
      [name.trim(), email.toLowerCase().trim(), passwordHash]
    );

    const doctor = result.rows[0];

    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║  ✅ Doctor Account Created Successfully  ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log(`\n  ID:    ${doctor.id}`);
    console.log(`  Name:  ${doctor.name}`);
    console.log(`  Email: ${doctor.email}`);
    console.log(`  Role:  ${doctor.role}`);
    console.log(`\n  ⚠️  Keep credentials secure. Do not share passwords.`);
    console.log(`  Use these credentials to log in at the Doctor Login page.\n`);

  } catch (err) {
    if (err.message && err.message.includes('users')) {
      console.error('\n❌ Error: The "users" table does not exist.');
      console.error('   Please run the database migration first:');
      console.error('   psql -d gp_clinic_db -f migrations/001_add_auth.sql\n');
    } else {
      console.error('\n❌ Seed error:', err.message, '\n');
    }
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
  }
}

seed();
