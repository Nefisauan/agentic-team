const { query } = require('../config/database');
const logger = require('../config/logger');

/**
 * Analytics Agent — runs on a cron schedule.
 *
 * Calculates and stores:
 * - Total leads by status
 * - Response rate (replied / contacted)
 * - Qualification rate (qualified / replied)
 * - Booking rate (booked / qualified)
 */
async function runAnalyticsAgent() {
  // Fetch counts by status
  const statusResult = await query(
    `SELECT status, COUNT(*) as count FROM leads GROUP BY status`
  );

  const counts = {};
  for (const row of statusResult.rows) {
    counts[row.status] = parseInt(row.count, 10);
  }

  const totalLeads =
    (counts.new || 0) +
    (counts.contacted || 0) +
    (counts.replied || 0) +
    (counts.qualified || 0) +
    (counts.booked || 0) +
    (counts.disqualified || 0);

  const contacted = counts.contacted || 0;
  const replied = counts.replied || 0;
  const qualified = counts.qualified || 0;
  const booked = counts.booked || 0;

  // Leads that have ever been contacted (contacted + replied + qualified + booked)
  const everContacted = contacted + replied + qualified + booked;

  // Rates
  const responseRate =
    everContacted > 0 ? ((replied + qualified + booked) / everContacted) * 100 : 0;
  const qualificationRate =
    replied + qualified + booked > 0
      ? ((qualified + booked) / (replied + qualified + booked)) * 100
      : 0;
  const bookingRate =
    qualified + booked > 0 ? (booked / (qualified + booked)) * 100 : 0;

  const snapshot = {
    total_leads: totalLeads,
    contacted: everContacted,
    replied: replied + qualified + booked,
    qualified: qualified + booked,
    booked,
    response_rate: parseFloat(responseRate.toFixed(2)),
    qualification_rate: parseFloat(qualificationRate.toFixed(2)),
    booking_rate: parseFloat(bookingRate.toFixed(2)),
  };

  // Upsert today's snapshot
  await query(
    `INSERT INTO analytics_snapshots
       (snapshot_date, total_leads, contacted, replied, qualified, booked,
        response_rate, qualification_rate, booking_rate)
     VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (snapshot_date) DO UPDATE SET
       total_leads = EXCLUDED.total_leads,
       contacted = EXCLUDED.contacted,
       replied = EXCLUDED.replied,
       qualified = EXCLUDED.qualified,
       booked = EXCLUDED.booked,
       response_rate = EXCLUDED.response_rate,
       qualification_rate = EXCLUDED.qualification_rate,
       booking_rate = EXCLUDED.booking_rate,
       created_at = NOW()`,
    [
      snapshot.total_leads,
      snapshot.contacted,
      snapshot.replied,
      snapshot.qualified,
      snapshot.booked,
      snapshot.response_rate,
      snapshot.qualification_rate,
      snapshot.booking_rate,
    ]
  );

  logger.info('Analytics snapshot saved', snapshot);
  return snapshot;
}

/**
 * Fetch the latest analytics data.
 */
async function getMetrics() {
  const [snapshotResult, funnelResult, recentLeadsResult] = await Promise.all([
    query(
      `SELECT * FROM analytics_snapshots ORDER BY snapshot_date DESC LIMIT 30`
    ),
    query(`
      SELECT status, COUNT(*) as count
      FROM leads
      GROUP BY status
      ORDER BY CASE status
        WHEN 'new' THEN 1 WHEN 'contacted' THEN 2 WHEN 'replied' THEN 3
        WHEN 'qualified' THEN 4 WHEN 'booked' THEN 5 WHEN 'disqualified' THEN 6
        ELSE 7 END
    `),
    query(`
      SELECT DATE_TRUNC('day', created_at) as day, COUNT(*) as count
      FROM leads
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY day
      ORDER BY day
    `),
  ]);

  return {
    snapshots: snapshotResult.rows,
    funnel: funnelResult.rows,
    leadsByDay: recentLeadsResult.rows,
  };
}

module.exports = { runAnalyticsAgent, getMetrics };
