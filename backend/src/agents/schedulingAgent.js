const { query } = require('../config/database');
const { sendEmail } = require('../services/emailService');
const { generateSchedulingEmail } = require('../services/claudeService');
const { getBookingLink } = require('../services/calendarService');
const logger = require('../config/logger');

/**
 * Scheduling Agent — triggered by lead_qualified event.
 *
 * 1. Fetch lead
 * 2. Get booking link (Calendly or Google Calendar slots)
 * 3. Generate scheduling email
 * 4. Send email
 * 5. Save message
 * 6. Create event record
 * Note: Status → booked happens via webhook when meeting is confirmed
 */
async function runSchedulingAgent(leadId) {
  // 1. Fetch lead
  const leadResult = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
  if (leadResult.rowCount === 0) {
    throw new Error(`Lead ${leadId} not found`);
  }
  const lead = leadResult.rows[0];

  if (lead.status === 'booked') {
    logger.info('Scheduling skipped — meeting already booked', { leadId });
    return { skipped: true, reason: 'already_booked' };
  }

  // 2. Get booking link
  const booking = await getBookingLink();

  let bookingText;
  if (booking.type === 'link') {
    bookingText = booking.url;
  } else if (booking.type === 'slots' && booking.slots.length > 0) {
    const slotList = booking.slots
      .slice(0, 3)
      .map((s) => `• ${new Date(s.start).toUTCString()}`)
      .join('\n');
    bookingText = `one of these times:\n${slotList}\n\nJust reply with your preferred time.`;
  } else {
    bookingText = 'a time that works for you — just reply to this email!';
  }

  // 3. Generate scheduling email
  const email = await generateSchedulingEmail(lead, bookingText);

  // 4. Send email
  await sendEmail({
    to: lead.email,
    subject: email.subject,
    text: email.body,
  });

  const now = new Date();

  // 5. Save message
  await query(
    `INSERT INTO messages (lead_id, type, direction, subject, content, sent_at, metadata)
     VALUES ($1, 'scheduling', 'outbound', $2, $3, $4, $5)`,
    [
      leadId,
      email.subject,
      email.body,
      now,
      JSON.stringify({ bookingType: booking.type, bookingData: booking }),
    ]
  );

  // 6. Create event
  await query(
    `INSERT INTO events (type, lead_id, payload) VALUES ('lead_qualified', $1, $2)`,
    [leadId, JSON.stringify({ schedulingEmailSent: true, sentAt: now })]
  );

  logger.info('Scheduling agent completed', { leadId, bookingType: booking.type });
  return { success: true, leadId, bookingType: booking.type };
}

module.exports = { runSchedulingAgent };
