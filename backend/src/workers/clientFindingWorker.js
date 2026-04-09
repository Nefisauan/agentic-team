const { Worker } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { runClientFindingAgent } = require('../agents/clientFindingAgent');
const supervisor = require('../middleware/supervisor');
const logger = require('../config/logger');

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
    concurrency: 1, // Research is heavy on API calls
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

module.exports = worker;
