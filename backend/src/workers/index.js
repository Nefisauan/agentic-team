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
const { agencyWorker, scheduleAgencyJob } = require('./agencyWorker');

// Schedule all cron jobs
Promise.all([
  scheduleAnalyticsJob(),
  scheduleClientFindingJob(),
  scheduleDMBatchJobs(),
  scheduleAgencyJob(),
]).then(() => {
  logger.info('All cron jobs scheduled (analytics, client-finding, DM batches, agency outreach — all daily)');
}).catch((err) => {
  logger.error('Failed to schedule cron jobs', { error: err.message });
});

logger.info('All workers started: email + social + client-finding + agency partnerships');

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`Received ${signal}, shutting down workers...`);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
