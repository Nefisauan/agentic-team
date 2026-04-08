const { google } = require('googleapis');
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_CALENDAR_ID,
  CALENDLY_LINK,
} = require('../config/env');
const logger = require('../config/logger');

function getOAuth2Client() {
  const auth = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
  if (GOOGLE_REFRESH_TOKEN) {
    auth.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  }
  return auth;
}

/**
 * Get available 30-minute slots over the next 5 business days.
 * Returns array of { start, end } ISO strings.
 */
async function getAvailableSlots() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_REFRESH_TOKEN) {
    logger.warn('Google Calendar not configured, returning empty slots');
    return [];
  }

  try {
    const auth = getOAuth2Client();
    const calendar = google.calendar({ version: 'v3', auth });

    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: 'UTC',
        items: [{ id: GOOGLE_CALENDAR_ID }],
      },
    });

    const busy = res.data.calendars[GOOGLE_CALENDAR_ID]?.busy || [];
    const slots = generateSlots(timeMin, timeMax, busy);
    return slots.slice(0, 6); // Return up to 6 slots
  } catch (err) {
    logger.error('Google Calendar error', { error: err.message });
    return [];
  }
}

function generateSlots(timeMinStr, timeMaxStr, busyPeriods) {
  const slots = [];
  const start = new Date(timeMinStr);
  const end = new Date(timeMaxStr);
  const slotDuration = 30 * 60 * 1000;

  // Round up to next hour
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);

  let cursor = new Date(start);
  while (cursor < end && slots.length < 10) {
    const day = cursor.getDay();
    const hour = cursor.getHours();

    // Only business hours Mon–Fri 9am–5pm UTC
    if (day >= 1 && day <= 5 && hour >= 9 && hour < 17) {
      const slotEnd = new Date(cursor.getTime() + slotDuration);
      const isBusy = busyPeriods.some(
        (b) => new Date(b.start) < slotEnd && new Date(b.end) > cursor
      );

      if (!isBusy) {
        slots.push({ start: cursor.toISOString(), end: slotEnd.toISOString() });
      }
    }

    cursor = new Date(cursor.getTime() + slotDuration);
  }

  return slots;
}

/**
 * Get the best booking link: Calendly if configured, else offer slots.
 */
async function getBookingLink() {
  if (CALENDLY_LINK) {
    return { type: 'link', url: CALENDLY_LINK };
  }
  const slots = await getAvailableSlots();
  return { type: 'slots', slots };
}

/**
 * Create a calendar event when a meeting is booked.
 */
async function createMeetingEvent({ lead, startTime, endTime }) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_REFRESH_TOKEN) {
    logger.warn('Google Calendar not configured, skipping event creation');
    return null;
  }

  try {
    const auth = getOAuth2Client();
    const calendar = google.calendar({ version: 'v3', auth });

    const event = await calendar.events.insert({
      calendarId: GOOGLE_CALENDAR_ID,
      requestBody: {
        summary: `Discovery Call with ${lead.name}`,
        description: `Lead: ${lead.email}\nCompany: ${lead.company || 'N/A'}`,
        start: { dateTime: startTime, timeZone: 'UTC' },
        end: { dateTime: endTime, timeZone: 'UTC' },
        attendees: [{ email: lead.email, displayName: lead.name }],
        reminders: {
          useDefault: false,
          overrides: [{ method: 'email', minutes: 24 * 60 }, { method: 'popup', minutes: 30 }],
        },
      },
    });

    logger.info('Calendar event created', { eventId: event.data.id, lead_id: lead.id });
    return event.data;
  } catch (err) {
    logger.error('Failed to create calendar event', { error: err.message });
    throw err;
  }
}

module.exports = { getAvailableSlots, getBookingLink, createMeetingEvent };
