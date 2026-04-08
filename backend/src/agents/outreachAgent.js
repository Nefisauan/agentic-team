const { query } = require('../config/database');
const { sendEmail } = require('../services/emailService');
const { generateOutreachEmail } = require('../services/claudeService');
const { addFollowupJob } = require('../queues/index');
const { FOLLOWUP_DELAY_DAYS } = require('../config/env');
const logger = require('../config/logger');

/**
 * Outreach Agent — triggered by new_lead event.
 *
 * 1. Fetch lead from DB
 * 2. Generate personalized email via OpenAI
 * 3. Send email via SendGrid
 * 4. Save message in DB
 * 5. Update lead status → contacted
 * 6. Schedule follow-up job (delay: N days)
 * 7. Create event record
 */
async function runOutreachAgent(leadId) {
  // 1. Fetch lead
  const leadResult = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
  if (leadResult.rowCount === 0) {
    throw new Error(`Lead ${leadId} not found`);
  }
  const lead = leadResult.rows[0];

  if (lead.status !== 'new') {
    logger.info('Outreach skipped — lead already processed', { leadId, status: lead.status });
    return { skipped: true, reason: 'already_processed' };
  }

  // 2. Generate email
  const email = await generateOutreachEmail(lead);

  // 3. Send email
  await sendEmail({
    to: lead.email,
    subject: email.subject,
    text: email.body,
  });

  const now = new Date();

  // 4. Save message
  await query(
    `INSERT INTO messages (lead_id, type, direction, subject, content, sent_at)
     VALUES ($1, 'outreach', 'outbound', $2, $3, $4)`,
    [leadId, email.subject, email.body, now]
  );

  // 5. Update lead status
  await query(
    `UPDATE leads SET status = 'contacted', last_contacted_at = $1, updated_at = $1 WHERE id = $2`,
    [now, leadId]
  );

  // 6. Schedule follow-up
  const delayMs = FOLLOWUP_DELAY_DAYS * 24 * 60 * 60 * 1000;
  await addFollowupJob(leadId, delayMs);

  // 7. Create event
  await query(
    `INSERT INTO events (type, lead_id, payload) VALUES ('new_lead', $1, $2)`,
    [leadId, JSON.stringify({ status: 'processed', sentAt: now })]
  );

  logger.info('Outreach agent completed', { leadId, email: lead.email });
  return { success: true, leadId, email: lead.email };
}

module.exports = { runOutreachAgent };
