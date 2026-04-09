const { Worker, Queue } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { runClientFindingAgent } = require('../agents/clientFindingAgent');
const supervisor = require('../middleware/supervisor');
const { CLIENT_FINDING_CRON_SCHEDULE, DAILY_PROSPECT_COUNT } = require('../config/env');
const logger = require('../config/logger');

const clientFindingQueue = new Queue('client-finding', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 60000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// Schedule daily prospect research
async function scheduleClientFindingJob() {
  const repeatableJobs = await clientFindingQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await clientFindingQueue.removeRepeatableByKey(job.key);
  }

  await clientFindingQueue.add(
    'daily-prospect-research',
    {
      count: DAILY_PROSPECT_COUNT,
      autoConvert: true,
      autoDM: true,
    },
    {
      repeat: { pattern: CLIENT_FINDING_CRON_SCHEDULE },
    }
  );

  logger.info('Client-finding job scheduled', { cron: CLIENT_FINDING_CRON_SCHEDULE, count: DAILY_PROSPECT_COUNT });
}

const worker = new Worker(
  'client-finding',
  async (job) => {
    logger.info('Client-finding job started', { jobId: job.id });
    await supervisor.logJobStart(job, 'client-finding');

    const result = await runClientFindingAgent(job.data);

    await supervisor.logJobComplete(job, 'client-finding', result);
    return result;
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
  }
);

worker.on('failed', async (job, err) => {
  logger.error('Client-finding job failed', {
    jobId: job?.id,
    error: err.message,
    attemptsMade: job?.attemptsMade,
  });
  if (job) await supervisor.logJobFailed(job, 'client-finding', err);
});

worker.on('stalled', (jobId) => {
  logger.warn('Client-finding job stalled', { jobId });
});

logger.info('Client-finding worker started');

module.exports = { clientFindingWorker: worker, scheduleClientFindingJob, clientFindingQueue };
