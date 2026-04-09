const { Worker } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { runDMAgent } = require('../agents/dmAgent');
const supervisor = require('../middleware/supervisor');
const logger = require('../config/logger');

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

worker.on('failed', async (job, err) => {
  logger.error('DM job failed', {
    jobId: job?.id,
    platform: job?.data?.platform,
    error: err.message,
    attemptsMade: job?.attemptsMade,
  });
  if (job) await supervisor.logJobFailed(job, 'dm', err);
});

worker.on('stalled', (jobId) => {
  logger.warn('DM job stalled', { jobId });
});

logger.info('DM worker started');

module.exports = worker;
