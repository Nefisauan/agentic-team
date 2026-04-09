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

  // Social media (optional — DM sending mocked in dev)
  INSTAGRAM_ACCESS_TOKEN: process.env.INSTAGRAM_ACCESS_TOKEN || '',
  INSTAGRAM_BUSINESS_ID: process.env.INSTAGRAM_BUSINESS_ID || '',
  LINKEDIN_ACCESS_TOKEN: process.env.LINKEDIN_ACCESS_TOKEN || '',
  LINKEDIN_ORG_ID: process.env.LINKEDIN_ORG_ID || '',

  // Content schedule
  CONTENT_POSTS_PER_WEEK: parseInt(process.env.CONTENT_POSTS_PER_WEEK || '4', 10),
  CONTENT_CRON_SCHEDULE: process.env.CONTENT_CRON_SCHEDULE || '0 9 * * 1', // Mondays 9am
  CLIENT_FINDING_CRON_SCHEDULE: process.env.CLIENT_FINDING_CRON_SCHEDULE || '0 8 * * *', // Daily 8am
  DM_BATCH_CRON_SCHEDULE: process.env.DM_BATCH_CRON_SCHEDULE || '0 10 * * *', // Daily 10am
  DAILY_PROSPECT_COUNT: parseInt(process.env.DAILY_PROSPECT_COUNT || '20', 10),
  DM_BATCH_LIMIT: parseInt(process.env.DM_BATCH_LIMIT || '20', 10),

  // Agency partnership outreach
  AGENCY_PARTNER_CRON_SCHEDULE: process.env.AGENCY_PARTNER_CRON_SCHEDULE || '0 9 * * *', // Daily 9am
  DAILY_AGENCY_COUNT: parseInt(process.env.DAILY_AGENCY_COUNT || '15', 10),
};
