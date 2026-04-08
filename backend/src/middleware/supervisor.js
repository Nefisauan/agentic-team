const { query } = require('../config/database');
const logger = require('../config/logger');

/**
 * Supervisor — tracks all job executions, prevents duplicate sends.
 */

async function logJobStart(job, queueName) {
  try {
    await query(
      `INSERT INTO job_logs (queue, job_id, job_name, status, lead_id)
       VALUES ($1, $2, $3, 'started', $4)`,
      [queueName, job.id, job.name, job.data?.leadId || null]
    );
  } catch (err) {
    logger.warn('Failed to log job start', { error: err.message });
  }
}

async function logJobComplete(job, queueName, result) {
  try {
    const duration = Date.now() - job.timestamp;
    await query(
      `INSERT INTO job_logs (queue, job_id, job_name, status, lead_id, duration_ms)
       VALUES ($1, $2, $3, 'completed', $4, $5)`,
      [queueName, job.id, job.name, job.data?.leadId || null, duration]
    );
  } catch (err) {
    logger.warn('Failed to log job complete', { error: err.message });
  }
}

async function logJobFailed(job, queueName, error) {
  try {
    await query(
      `INSERT INTO job_logs (queue, job_id, job_name, status, lead_id, error)
       VALUES ($1, $2, $3, 'failed', $4, $5)`,
      [queueName, job.id, job.name, job.data?.leadId || null, error.message]
    );
  } catch (err) {
    logger.warn('Failed to log job failure', { error: err.message });
  }
}

/**
 * Check if a lead has already received a message of a given type in the last N hours.
 * Prevents duplicate sends on job retries.
 */
async function hasRecentMessage(leadId, messageType, withinHours = 1) {
  const result = await query(
    `SELECT id FROM messages
     WHERE lead_id = $1 AND type = $2 AND sent_at > NOW() - ($3 || ' hours')::INTERVAL
     LIMIT 1`,
    [leadId, messageType, withinHours]
  );
  return result.rowCount > 0;
}

/**
 * Get recent job logs for the activity feed.
 */
async function getRecentJobLogs(limit = 50) {
  const result = await query(
    `SELECT jl.*, l.name as lead_name, l.email as lead_email
     FROM job_logs jl
     LEFT JOIN leads l ON jl.lead_id = l.id
     ORDER BY jl.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

module.exports = { logJobStart, logJobComplete, logJobFailed, hasRecentMessage, getRecentJobLogs };
