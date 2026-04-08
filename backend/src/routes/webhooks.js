const express = require('express');
const { query } = require('../config/database');
const { parseInboundEmail } = require('../services/emailService');
const { addQualificationJob } = require('../queues/index');
const logger = require('../config/logger');

const router = express.Router();

/**
 * POST /webhooks/sendgrid/inbound
 * Handles SendGrid Inbound Parse webhook for reply detection.
 * Configure SendGrid to POST to: https://yourapi.com/webhooks/sendgrid/inbound
 */
router.post('/sendgrid/inbound', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const parsed = parseInboundEmail(req.body);

    // Extract sender email — remove name if present "John Doe <john@example.com>"
    const fromRaw = parsed.from;
    const emailMatch = fromRaw.match(/<([^>]+)>/) || [null, fromRaw];
    const senderEmail = emailMatch[1].toLowerCase().trim();

    logger.info('Inbound email received', { from: senderEmail, subject: parsed.subject });

    // Look up lead by sender email
    const leadResult = await query(
      'SELECT id, name, status FROM leads WHERE email = $1',
      [senderEmail]
    );

    if (leadResult.rowCount === 0) {
      logger.warn('Inbound email from unknown sender', { email: senderEmail });
      return res.status(200).json({ ignored: true, reason: 'unknown_sender' });
    }

    const lead = leadResult.rows[0];

    // Ignore replies from already-booked or disqualified leads
    if (['booked', 'disqualified'].includes(lead.status)) {
      return res.status(200).json({ ignored: true, reason: 'terminal_status' });
    }

    // Save the reply message
    const msgResult = await query(
      `INSERT INTO messages (lead_id, type, direction, subject, content, sent_at)
       VALUES ($1, 'reply', 'inbound', $2, $3, NOW())
       RETURNING id`,
      [lead.id, parsed.subject, parsed.text || parsed.html]
    );

    const messageId = msgResult.rows[0].id;

    // Update lead status to replied
    await query(
      `UPDATE leads SET status = 'replied', updated_at = NOW() WHERE id = $1 AND status NOT IN ('qualified', 'booked')`,
      [lead.id]
    );

    // Create event record
    await query(
      `INSERT INTO events (type, lead_id, payload) VALUES ('lead_replied', $1, $2)`,
      [lead.id, JSON.stringify({ messageId, subject: parsed.subject })]
    );

    // Trigger qualification
    await addQualificationJob(lead.id, messageId);

    logger.info('Reply processed, qualification queued', { leadId: lead.id, messageId });

    // Always return 200 to SendGrid
    res.status(200).json({ success: true, leadId: lead.id, messageId });
  } catch (err) {
    logger.error('Inbound webhook error', { error: err.message });
    // Still return 200 so SendGrid doesn't retry endlessly
    res.status(200).json({ error: err.message });
  }
});

/**
 * POST /webhooks/calendly
 * Handles Calendly webhook when a meeting is booked.
 */
router.post('/calendly', express.json(), async (req, res) => {
  try {
    const { event, payload } = req.body;

    if (event !== 'invitee.created') {
      return res.status(200).json({ ignored: true });
    }

    const inviteeEmail = payload?.invitee?.email?.toLowerCase().trim();
    if (!inviteeEmail) {
      return res.status(200).json({ error: 'no invitee email' });
    }

    const leadResult = await query('SELECT id FROM leads WHERE email = $1', [inviteeEmail]);
    if (leadResult.rowCount === 0) {
      return res.status(200).json({ ignored: true, reason: 'unknown_lead' });
    }

    const leadId = leadResult.rows[0].id;

    await query(
      `UPDATE leads SET status = 'booked', updated_at = NOW() WHERE id = $1`,
      [leadId]
    );

    await query(
      `INSERT INTO events (type, lead_id, payload) VALUES ('meeting_booked', $1, $2)`,
      [leadId, JSON.stringify({ eventUri: payload?.event?.uri, inviteeUri: payload?.invitee?.uri })]
    );

    logger.info('Meeting booked via Calendly', { leadId, email: inviteeEmail });
    res.status(200).json({ success: true, leadId });
  } catch (err) {
    logger.error('Calendly webhook error', { error: err.message });
    res.status(200).json({ error: err.message });
  }
});

module.exports = router;
