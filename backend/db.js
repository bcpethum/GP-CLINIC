const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

// Neon and other cloud Postgres providers require SSL even in development.
// Only skip SSL if explicitly connecting to localhost.
const isLocalDb = connectionString && (
  connectionString.includes('localhost') ||
  connectionString.includes('127.0.0.1')
);

const pool = new Pool({
  connectionString: connectionString,
  ssl: isLocalDb ? false : { rejectUnauthorized: false },
});

pool.on('connect', () => {
  console.log('Connected to the PostgreSQL database successfully.');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
