const { QueueScheduler, Queue } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { runAnalyticsAgent } = require('../agents/analyticsAgent');
const { ANALYTICS_CRON_SCHEDULE } = require('../config/env');
const logger = require('../config/logger');

const analyticsQueue = new Queue('analytics', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 60000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// Schedule the recurring analytics job
async function scheduleAnalyticsJob() {
  // Remove any existing repeatable jobs to avoid duplicates
  const repeatableJobs = await analyticsQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await analyticsQueue.removeRepeatableByKey(job.key);
  }

  await analyticsQueue.add(
    'run-analytics',
    {},
    {
      repeat: { pattern: ANALYTICS_CRON_SCHEDULE },
    }
  );

  logger.info('Analytics job scheduled', { cron: ANALYTICS_CRON_SCHEDULE });
}

const { Worker } = require('bullmq');

const worker = new Worker(
  'analytics',
  async (job) => {
    logger.info('Analytics job started', { jobId: job.id });
    const result = await runAnalyticsAgent();
    logger.info('Analytics job completed', { snapshot: result });
    return result;
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
  }
);

worker.on('failed', (job, err) => {
  logger.error('Analytics job failed', { jobId: job?.id, error: err.message });
});

module.exports = { analyticsWorker: worker, scheduleAnalyticsJob, analyticsQueue };
