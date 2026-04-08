const { Worker } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { runOutreachAgent } = require('../agents/outreachAgent');
const supervisor = require('../middleware/supervisor');
const logger = require('../config/logger');

const worker = new Worker(
  'outreach',
  async (job) => {
    logger.info('Outreach job started', { jobId: job.id, leadId: job.data.leadId });
    await supervisor.logJobStart(job, 'outreach');

    const result = await runOutreachAgent(job.data.leadId);

    await supervisor.logJobComplete(job, 'outreach', result);
    return result;
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
  }
);

worker.on('failed', async (job, err) => {
  logger.error('Outreach job failed', {
    jobId: job?.id,
    leadId: job?.data?.leadId,
    error: err.message,
    attemptsMade: job?.attemptsMade,
  });
  if (job) await supervisor.logJobFailed(job, 'outreach', err);
});

worker.on('stalled', (jobId) => {
  logger.warn('Outreach job stalled', { jobId });
});

logger.info('Outreach worker started');

module.exports = worker;
