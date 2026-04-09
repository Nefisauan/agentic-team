/**
 * Worker process — run separately from the API server.
 * Start with: npm run workers
 *
 * Runs 8 agents:
 * - outreach, followup, qualification, scheduling (email pipeline)
 * - content (weekly IG/LI post generation)
 * - dm + dm-schedule (daily DM batches to 20 prospects)
 * - client-finding (daily prospect research — 20/day)
 * - analytics (daily snapshot)
 */
require('../config/env').validateEnv();

const logger = require('../config/logger');

// Boot email pipeline workers
require('./outreachWorker');
require('./followupWorker');
require('./qualificationWorker');
require('./schedulingWorker');
require('./contentWorker');

// Boot social + client-finding workers (with daily cron schedules)
const { dmWorker, scheduleDMBatchJobs } = require('./dmWorker');
const { clientFindingWorker, scheduleClientFindingJob } = require('./clientFindingWorker');
const { analyticsWorker, scheduleAnalyticsJob } = require('./analyticsWorker');

// Schedule all cron jobs
Promise.all([
  scheduleAnalyticsJob(),
  scheduleClientFindingJob(),
  scheduleDMBatchJobs(),
]).then(() => {
  logger.info('All cron jobs scheduled (analytics daily, client-finding daily, DM batches daily)');
}).catch((err) => {
  logger.error('Failed to schedule cron jobs', { error: err.message });
});

logger.info('All workers started: email pipeline + social content + DM outreach + client-finding');

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down workers...`);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
