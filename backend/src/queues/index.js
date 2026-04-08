const { Queue } = require('bullmq');
const { getRedisConnection } = require('../config/redis');

const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 200 },
};

const connection = getRedisConnection();

const outreachQueue = new Queue('outreach', { connection, defaultJobOptions });
const followupQueue = new Queue('followup', { connection, defaultJobOptions });
const qualificationQueue = new Queue('qualification', { connection, defaultJobOptions });
const schedulingQueue = new Queue('scheduling', { connection, defaultJobOptions });

// ── Producer helpers ─────────────────────────────────────────────────────────

/**
 * Enqueue a new outreach job for a lead.
 */
async function addOutreachJob(leadId, options = {}) {
  return outreachQueue.add('send-outreach', { leadId }, options);
}

/**
 * Enqueue a follow-up job with an optional delay (default: 3 days).
 */
async function addFollowupJob(leadId, delayMs) {
  return followupQueue.add(
    'send-followup',
    { leadId },
    { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
  );
}

/**
 * Enqueue a qualification job after a reply is received.
 */
async function addQualificationJob(leadId, replyMessageId) {
  return qualificationQueue.add('qualify-lead', { leadId, replyMessageId });
}

/**
 * Enqueue a scheduling job for a qualified lead.
 */
async function addSchedulingJob(leadId) {
  return schedulingQueue.add('schedule-meeting', { leadId });
}

module.exports = {
  outreachQueue,
  followupQueue,
  qualificationQueue,
  schedulingQueue,
  addOutreachJob,
  addFollowupJob,
  addQualificationJob,
  addSchedulingJob,
};
