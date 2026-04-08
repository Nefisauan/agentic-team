const twilio = require('twilio');
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER,
  NODE_ENV,
} = require('../config/env');
const logger = require('../config/logger');

let client;

function getClient() {
  if (!client) {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return null;
    }
    client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return client;
}

/**
 * Send an SMS message via Twilio.
 * No-ops gracefully if Twilio is not configured.
 */
async function sendSMS({ to, body }) {
  const twilioClient = getClient();

  if (!twilioClient) {
    logger.warn('Twilio not configured, SMS skipped', { to });
    return null;
  }

  if (NODE_ENV === 'development') {
    logger.info('[DEV] SMS send (mocked)', { to, body: body.slice(0, 50) });
    return { sid: `mock-sms-${Date.now()}` };
  }

  try {
    const message = await twilioClient.messages.create({
      body,
      from: TWILIO_FROM_NUMBER,
      to,
    });
    logger.info('SMS sent', { to, sid: message.sid });
    return { sid: message.sid };
  } catch (err) {
    logger.error('Twilio send failed', { to, error: err.message });
    throw err;
  }
}

module.exports = { sendSMS };
