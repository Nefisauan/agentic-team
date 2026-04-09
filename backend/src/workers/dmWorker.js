const { Worker, Queue } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { runDMAgent } = require('../agents/dmAgent');
const supervisor = require('../middleware/supervisor');
const { DM_BATCH_CRON_SCHEDULE } = require('../config/env');
const logger = require('../config/logger');

const dmScheduleQueue = new Queue('dm-schedule', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 60000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// Schedule daily DM batches — sends to both platforms every day
async function scheduleDMBatchJobs() {
  const repeatableJobs = await dmScheduleQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await dmScheduleQueue.removeRepeatableByKey(job.key);
  }

  // IG batch at 10am, LI batch at 10:30am
  await dmScheduleQueue.add(
    'daily-ig-dm-batch',
    { mode: 'batch', platform: 'instagram' },
    { repeat: { pattern: DM_BATCH_CRON_SCHEDULE } }
  );

  await dmScheduleQueue.add(
    'daily-li-dm-batch',
    { mode: 'batch', platform: 'linkedin' },
    { repeat: { pattern: DM_BATCH_CRON_SCHEDULE.replace('0 10', '30 10') } }
  );

  logger.info('DM batch jobs scheduled', { cron: DM_BATCH_CRON_SCHEDULE });
}

// Worker for on-demand DMs (single sends, follow-ups)
const worker = new Worker(
  'dm',
  async (job) => {
    logger.info('DM job started', { jobId: job.id, mode: job.data.mode, platform: job.data.platform });
    await supervisor.logJobStart(job, 'dm');

    const result = await runDMAgent(job.data);

    await supervisor.logJobComplete(job, 'dm', result);
    return result;
  },
  {
    connection: getRedisConnection(),
    concurrency: 3,
  }
);

// Worker for scheduled batch DMs
const batchWorker = new Worker(
  'dm-schedule',
  async (job) => {
    logger.info('Scheduled DM batch started', { jobId: job.id, platform: job.data.platform });
    await supervisor.logJobStart(job, 'dm-schedule');

    const result = await runDMAgent(job.data);

    await supervisor.logJobComplete(job, 'dm-schedule', result);
    return result;
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
  }
);

worker.on('failed', async (job, err) => {
  logger.error('DM job failed', {
    jobId: job?.id,
    platform: job?.data?.platform,
    error: err.message,
    attemptsMade: job?.attemptsMade,
  });
  if (job) await supervisor.logJobFailed(job, 'dm', err);
});

batchWorker.on('failed', async (job, err) => {
  logger.error('DM batch job failed', {
    jobId: job?.id,
    platform: job?.data?.platform,
    error: err.message,
  });
  if (job) await supervisor.logJobFailed(job, 'dm-schedule', err);
});

worker.on('stalled', (jobId) => logger.warn('DM job stalled', { jobId }));
batchWorker.on('stalled', (jobId) => logger.warn('DM batch job stalled', { jobId }));

logger.info('DM worker started (on-demand + daily batch)');

module.exports = { dmWorker: worker, dmBatchWorker: batchWorker, scheduleDMBatchJobs, dmScheduleQueue };
