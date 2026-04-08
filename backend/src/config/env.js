require('dotenv').config();

const required = [
  'DATABASE_URL',
  'REDIS_URL',
  'ANTHROPIC_API_KEY',
  'SENDGRID_API_KEY',
  'SENDGRID_FROM_EMAIL',
];

function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = {
  validateEnv,
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',

  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,

  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',

  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL,
  SENDGRID_INBOUND_WEBHOOK_SECRET: process.env.SENDGRID_INBOUND_WEBHOOK_SECRET || '',

  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER,

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID || 'primary',

  CALENDLY_LINK: process.env.CALENDLY_LINK || '',

  QUALIFICATION_SCORE_THRESHOLD: parseInt(process.env.QUALIFICATION_SCORE_THRESHOLD || '60', 10),
  FOLLOWUP_DELAY_DAYS: parseInt(process.env.FOLLOWUP_DELAY_DAYS || '3', 10),
  ANALYTICS_CRON_SCHEDULE: process.env.ANALYTICS_CRON_SCHEDULE || '0 8 * * *',

  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
};
