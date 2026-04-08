const { query } = require('../config/database');
const { qualifyReply } = require('../services/claudeService');
const { addSchedulingJob } = require('../queues/index');
const { QUALIFICATION_SCORE_THRESHOLD } = require('../config/env');
const logger = require('../config/logger');

/**
 * Qualification Agent — triggered by lead_replied event.
 *
 * 1. Fetch lead and their latest reply message
 * 2. Use OpenAI to score the reply (0–100)
 * 3. Save score to lead
 * 4. If score ≥ threshold → qualified → trigger scheduling
 * 5. Else → mark for nurturing (optional)
 */
async function runQualificationAgent(leadId, replyMessageId) {
  // 1. Fetch lead
  const leadResult = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
  if (leadResult.rowCount === 0) {
    throw new Error(`Lead ${leadId} not found`);
  }
  const lead = leadResult.rows[0];

  if (lead.status === 'qualified' || lead.status === 'booked') {
    logger.info('Qualification skipped — lead already qualified', { leadId });
    return { skipped: true, reason: 'already_qualified' };
  }

  // Fetch the reply message
  let replyText;
  if (replyMessageId) {
    const msgResult = await query('SELECT content FROM messages WHERE id = $1', [replyMessageId]);
    replyText = msgResult.rows[0]?.content;
  }

  // Fall back to most recent inbound message
  if (!replyText) {
    const msgResult = await query(
      `SELECT content FROM messages WHERE lead_id = $1 AND direction = 'inbound'
       ORDER BY sent_at DESC LIMIT 1`,
      [leadId]
    );
    replyText = msgResult.rows[0]?.content;
  }

  if (!replyText) {
    throw new Error(`No reply content found for lead ${leadId}`);
  }

  // 2. Qualify with OpenAI
  const qualification = await qualifyReply(replyText, lead.name);

  // 3. Save score
  await query(
    `UPDATE leads SET score = $1, updated_at = NOW() WHERE id = $2`,
    [qualification.score, leadId]
  );

  // 4. Route based on score
  if (qualification.score >= QUALIFICATION_SCORE_THRESHOLD) {
    await query(
      `UPDATE leads SET status = 'qualified', updated_at = NOW() WHERE id = $1`,
      [leadId]
    );

    await query(
      `INSERT INTO events (type, lead_id, payload) VALUES ('lead_qualified', $1, $2)`,
      [
        leadId,
        JSON.stringify({
          score: qualification.score,
          intent: qualification.intent,
          reasoning: qualification.reasoning,
        }),
      ]
    );

    // Trigger scheduling
    await addSchedulingJob(leadId);

    logger.info('Lead qualified', {
      leadId,
      score: qualification.score,
      intent: qualification.intent,
    });
    return { success: true, leadId, qualified: true, score: qualification.score };
  } else {
    await query(
      `INSERT INTO events (type, lead_id, payload) VALUES ('lead_disqualified', $1, $2)`,
      [
        leadId,
        JSON.stringify({
          score: qualification.score,
          intent: qualification.intent,
          reasoning: qualification.reasoning,
        }),
      ]
    );

    logger.info('Lead below qualification threshold', {
      leadId,
      score: qualification.score,
      threshold: QUALIFICATION_SCORE_THRESHOLD,
    });
    return {
      success: true,
      leadId,
      qualified: false,
      score: qualification.score,
      reason: 'below_threshold',
    };
  }
}

module.exports = { runQualificationAgent };
