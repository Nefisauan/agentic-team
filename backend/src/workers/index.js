/**
 * Worker process — run separately from the API server.
 * Start with: npm run workers
 */
require('../config/env').validateEnv();

const logger = require('../config/logger');

// Boot all workers
require('./outreachWorker');
require('./followupWorker');
require('./qualificationWorker');
require('./schedulingWorker');
require('./contentWorker');
require('./dmWorker');
require('./clientFindingWorker');

const { analyticsWorker, scheduleAnalyticsJob } = require('./analyticsWorker');

scheduleAnalyticsJob().catch((err) => {
  logger.error('Failed to schedule analytics job', { error: err.message });
});

logger.info('All 8 workers started and listening (email + social + client-finding)');

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down workers...`);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
