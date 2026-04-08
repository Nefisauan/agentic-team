const { Worker } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { runFollowupAgent } = require('../agents/followupAgent');
const supervisor = require('../middleware/supervisor');
const logger = require('../config/logger');

const worker = new Worker(
  'followup',
  async (job) => {
    logger.info('Follow-up job started', { jobId: job.id, leadId: job.data.leadId });
    await supervisor.logJobStart(job, 'followup');

    const result = await runFollowupAgent(job.data.leadId);

    await supervisor.logJobComplete(job, 'followup', result);
    return result;
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
  }
);

worker.on('failed', async (job, err) => {
  logger.error('Follow-up job failed', {
    jobId: job?.id,
    leadId: job?.data?.leadId,
    error: err.message,
  });
  if (job) await supervisor.logJobFailed(job, 'followup', err);
});

worker.on('stalled', (jobId) => {
  logger.warn('Follow-up job stalled', { jobId });
});

logger.info('Follow-up worker started');

module.exports = worker;
