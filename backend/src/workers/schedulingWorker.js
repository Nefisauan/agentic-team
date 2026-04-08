const { Worker } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { runSchedulingAgent } = require('../agents/schedulingAgent');
const supervisor = require('../middleware/supervisor');
const logger = require('../config/logger');

const worker = new Worker(
  'scheduling',
  async (job) => {
    logger.info('Scheduling job started', { jobId: job.id, leadId: job.data.leadId });
    await supervisor.logJobStart(job, 'scheduling');

    const result = await runSchedulingAgent(job.data.leadId);

    await supervisor.logJobComplete(job, 'scheduling', result);
    return result;
  },
  {
    connection: getRedisConnection(),
    concurrency: 3,
  }
);

worker.on('failed', async (job, err) => {
  logger.error('Scheduling job failed', {
    jobId: job?.id,
    leadId: job?.data?.leadId,
    error: err.message,
  });
  if (job) await supervisor.logJobFailed(job, 'scheduling', err);
});

logger.info('Scheduling worker started');

module.exports = worker;
