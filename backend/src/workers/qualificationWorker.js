const { Worker } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { runQualificationAgent } = require('../agents/qualificationAgent');
const supervisor = require('../middleware/supervisor');
const logger = require('../config/logger');

const worker = new Worker(
  'qualification',
  async (job) => {
    logger.info('Qualification job started', { jobId: job.id, leadId: job.data.leadId });
    await supervisor.logJobStart(job, 'qualification');

    const result = await runQualificationAgent(job.data.leadId, job.data.replyMessageId);

    await supervisor.logJobComplete(job, 'qualification', result);
    return result;
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
  }
);

worker.on('failed', async (job, err) => {
  logger.error('Qualification job failed', {
    jobId: job?.id,
    leadId: job?.data?.leadId,
    error: err.message,
  });
  if (job) await supervisor.logJobFailed(job, 'qualification', err);
});

logger.info('Qualification worker started');

module.exports = worker;
