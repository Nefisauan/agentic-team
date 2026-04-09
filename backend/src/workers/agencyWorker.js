const { Worker, Queue } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { runAgencyPartnerAgent } = require('../agents/agencyPartnerAgent');
const supervisor = require('../middleware/supervisor');
const logger = require('../config/logger');

const AGENCY_CRON = process.env.AGENCY_PARTNER_CRON_SCHEDULE || '0 9 * * *'; // Daily 9am

const agencyScheduleQueue = new Queue('agency-schedule', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 60000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

// Schedule daily agency outreach: research + pitch + follow-up
async function scheduleAgencyJob() {
  const repeatableJobs = await agencyScheduleQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await agencyScheduleQueue.removeRepeatableByKey(job.key);
  }

  await agencyScheduleQueue.add(
    'daily-agency-pipeline',
    {
      mode: 'batch_pitch',
      options: {
        count: 15,
        pitchEmail: true,
        pitchDM: true,
      },
    },
    { repeat: { pattern: AGENCY_CRON } }
  );

  logger.info('Agency partnership job scheduled', { cron: AGENCY_CRON });
}

// Worker for scheduled daily runs
const scheduleWorker = new Worker(
  'agency-schedule',
  async (job) => {
    logger.info('Scheduled agency pipeline started', { jobId: job.id });
    await supervisor.logJobStart(job, 'agency-schedule');

    const result = await runAgencyPartnerAgent(job.data);

    await supervisor.logJobComplete(job, 'agency-schedule', result);
    return result;
  },
  {
    connection: getRedisConnection(),
    concurrency: 1,
  }
);

// Worker for on-demand agency jobs
const agencyQueue = new Queue('agency', {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  },
});

const worker = new Worker(
  'agency',
  async (job) => {
    logger.info('Agency job started', { jobId: job.id, mode: job.data.mode });
    await supervisor.logJobStart(job, 'agency');

    const result = await runAgencyPartnerAgent(job.data);

    await supervisor.logJobComplete(job, 'agency', result);
    return result;
  },
  {
    connection: getRedisConnection(),
    concurrency: 2,
  }
);

worker.on('failed', async (job, err) => {
  logger.error('Agency job failed', { jobId: job?.id, error: err.message });
  if (job) await supervisor.logJobFailed(job, 'agency', err);
});

scheduleWorker.on('failed', async (job, err) => {
  logger.error('Scheduled agency job failed', { jobId: job?.id, error: err.message });
  if (job) await supervisor.logJobFailed(job, 'agency-schedule', err);
});

logger.info('Agency partnership worker started (on-demand + daily cron)');

module.exports = { agencyWorker: worker, scheduleAgencyJob, agencyQueue, agencyScheduleQueue };
