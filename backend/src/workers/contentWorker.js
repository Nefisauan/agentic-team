const { Worker } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { runContentAgent } = require('../agents/contentAgent');
const supervisor = require('../middleware/supervisor');
const logger = require('../config/logger');

const worker = new Worker(
  'content',
  async (job) => {
    logger.info('Content job started', { jobId: job.id, mode: job.data.mode });
    await supervisor.logJobStart(job, 'content');

    const result = await runContentAgent(job.data);

    await supervisor.logJobComplete(job, 'content', result);
    return result;
  },
  {
    connection: getRedisConnection(),
    concurrency: 2,
  }
);

worker.on('failed', async (job, err) => {
  logger.error('Content job failed', {
    jobId: job?.id,
    error: err.message,
    attemptsMade: job?.attemptsMade,
  });
  if (job) await supervisor.logJobFailed(job, 'content', err);
});

worker.on('stalled', (jobId) => {
  logger.warn('Content job stalled', { jobId });
});

logger.info('Content worker started');

module.exports = worker;
