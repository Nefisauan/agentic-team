const sgMail = require('@sendgrid/mail');
const {
  SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL,
  NODE_ENV,
} = require('../config/env');
const logger = require('../config/logger');

sgMail.setApiKey(SENDGRID_API_KEY);

/**
 * Send an email via SendGrid.
 * In development without a real API key, logs the email instead.
 */
async function sendEmail({ to, subject, text, html }) {
  if (NODE_ENV === 'development' && !SENDGRID_API_KEY?.startsWith('SG.')) {
    logger.info('[DEV] Email send (mocked)', { to, subject });
    return { messageId: `mock-${Date.now()}` };
  }

  const msg = {
    to,
    from: SENDGRID_FROM_EMAIL,
    subject,
    text,
    html: html || `<p>${text}</p>`,
  };

  try {
    const [response] = await sgMail.send(msg);
    logger.info('Email sent', { to, subject, statusCode: response.statusCode });
    return { messageId: response.headers['x-message-id'] };
  } catch (err) {
    const details = err.response?.body?.errors;
    logger.error('SendGrid send failed', { to, subject, error: err.message, details });
    throw err;
  }
}

/**
 * Parse an inbound SendGrid webhook payload.
 * Returns normalized { from, to, subject, text, html }.
 */
function parseInboundEmail(body) {
  return {
    from: body.from || '',
    to: body.to || '',
    subject: body.subject || '',
    text: body.text || '',
    html: body.html || '',
    rawHeaders: body.headers || '',
  };
}

module.exports = { sendEmail, parseInboundEmail };
