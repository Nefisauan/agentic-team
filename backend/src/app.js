const express = require('express');
const cors = require('cors');
const { validateEnv, PORT, FRONTEND_URL } = require('./config/env');
const { testConnection } = require('./config/database');
const { getRedisConnection } = require('./config/redis');
const logger = require('./config/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Validate environment variables on startup
validateEnv();

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Request logger
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.url}`);
  next();
});

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  let dbStatus = 'ok';
  let redisStatus = 'ok';

  try {
    await testConnection();
  } catch {
    dbStatus = 'error';
  }

  try {
    const redis = getRedisConnection();
    await redis.ping();
  } catch {
    redisStatus = 'error';
  }

  const healthy = dbStatus === 'ok' && redisStatus === 'ok';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    db: dbStatus,
    redis: redisStatus,
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/leads', require('./routes/leads'));
app.use('/events', require('./routes/events'));
app.use('/metrics', require('./routes/metrics'));
app.use('/webhooks', require('./routes/webhooks'));

// ── Error handling ──────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ───────────────────────────────────────────────────────────────────
async function start() {
  try {
    await testConnection();

    const redis = getRedisConnection();
    await redis.connect();

    app.listen(PORT, () => {
      logger.info(`API server running on port ${PORT}`, { env: process.env.NODE_ENV });
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

start();

module.exports = app;
