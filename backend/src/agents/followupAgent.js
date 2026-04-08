const { query } = require('../config/database');
const { sendEmail } = require('../services/emailService');
const { generateFollowUpEmail } = require('../services/claudeService');
const { addFollowupJob } = require('../queues/index');
const { FOLLOWUP_DELAY_DAYS } = require('../config/env');
const logger = require('../config/logger');

const MAX_FOLLOWUPS = 3;

/**
 * Follow-up Agent — triggered by follow_up_due event.
 *
 * 1. Fetch lead; skip if already replied or disqualified
 * 2. Count previous follow-up messages
 * 3. If under max follow-ups: generate + send follow-up, save, reschedule
 * 4. If at max: mark lead for review (optional nurture)
 */
async function runFollowupAgent(leadId) {
  // 1. Fetch lead
  const leadResult = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
  if (leadResult.rowCount === 0) {
    throw new Error(`Lead ${leadId} not found`);
  }
  const lead = leadResult.rows[0];

  // Skip if lead has replied or is in a terminal state
  const skipStatuses = ['replied', 'qualified', 'booked', 'disqualified'];
  if (skipStatuses.includes(lead.status)) {
    logger.info('Follow-up skipped — lead already advanced', {
      leadId,
      status: lead.status,
    });
    return { skipped: true, reason: 'already_advanced', status: lead.status };
  }

  // 2. Count previous follow-ups
  const countResult = await query(
    `SELECT COUNT(*) as count FROM messages WHERE lead_id = $1 AND type = 'follow_up'`,
    [leadId]
  );
  const followupCount = parseInt(countResult.rows[0].count, 10);

  if (followupCount >= MAX_FOLLOWUPS) {
    logger.info('Follow-up limit reached', { leadId, followupCount });
    // Optionally mark lead as cold
    await query(
      `UPDATE leads SET status = 'disqualified', updated_at = NOW() WHERE id = $1 AND status = 'contacted'`,
      [leadId]
    );
    return { skipped: true, reason: 'max_followups_reached', followupCount };
  }

  // 3. Generate and send follow-up
  const email = await generateFollowUpEmail(lead, followupCount);

  await sendEmail({
    to: lead.email,
    subject: email.subject,
    text: email.body,
  });

  const now = new Date();

  // Save message
  await query(
    `INSERT INTO messages (lead_id, type, direction, subject, content, sent_at)
     VALUES ($1, 'follow_up', 'outbound', $2, $3, $4)`,
    [leadId, email.subject, email.body, now]
  );

  // Update last_contacted_at
  await query(
    `UPDATE leads SET last_contacted_at = $1, updated_at = $1 WHERE id = $2`,
    [now, leadId]
  );

  // Create event record
  await query(
    `INSERT INTO events (type, lead_id, payload) VALUES ('follow_up_due', $1, $2)`,
    [leadId, JSON.stringify({ followupNumber: followupCount + 1, sentAt: now })]
  );

  // Reschedule next follow-up (if still under limit)
  if (followupCount + 1 < MAX_FOLLOWUPS) {
    const delayMs = FOLLOWUP_DELAY_DAYS * 24 * 60 * 60 * 1000;
    await addFollowupJob(leadId, delayMs);
    logger.info('Next follow-up scheduled', { leadId, followupNumber: followupCount + 2 });
  }

  logger.info('Follow-up agent completed', {
    leadId,
    followupNumber: followupCount + 1,
  });
  return { success: true, leadId, followupNumber: followupCount + 1 };
}

module.exports = { runFollowupAgent };
