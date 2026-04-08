const { Pool } = require('pg');
const { DATABASE_URL, NODE_ENV } = require('./env');
const logger = require('./logger');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

/**
 * Execute a parameterized query.
 * @param {string} text - SQL query
 * @param {any[]} [params] - Query parameters
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('DB query', { text: text.slice(0, 80), duration, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('DB query error', { text: text.slice(0, 80), error: err.message });
    throw err;
  }
}

async function getClient() {
  return pool.connect();
}

async function testConnection() {
  const res = await query('SELECT NOW() as now');
  logger.info('Database connected', { time: res.rows[0].now });
}

module.exports = { query, getClient, testConnection, pool };
