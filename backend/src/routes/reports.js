const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

// GET /reports/weekly — get weekly performance report
router.get('/weekly', async (req, res, next) => {
  try {
    const { weeks = 4 } = req.query;

    const result = await query(
      `SELECT * FROM weekly_reports ORDER BY week_start DESC LIMIT $1`,
      [parseInt(weeks, 10)]
    );

    res.json({ reports: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /reports/weekly/generate — generate a weekly report snapshot
router.post('/weekly/generate', async (req, res, next) => {
  try {
    // Calculate week boundaries (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weekStart = monday.toISOString().split('T')[0];
    const weekEnd = sunday.toISOString().split('T')[0];

    // Gather all metrics for this week
    const [
      igPostsResult,
      liPostsResult,
      igDMsResult,
      liDMsResult,
      emailsResult,
      qualifiedResult,
      bookedResult,
      prospectsResult,
    ] = await Promise.all([
      // Instagram posts this week
      query(`
        SELECT
          COUNT(*) as created,
          COALESCE(SUM((engagement->>'likes')::int), 0) as likes,
          COALESCE(SUM((engagement->>'comments')::int), 0) as comments,
          COALESCE(SUM((engagement->>'reach')::int), 0) as reach
        FROM social_posts
        WHERE platform = 'instagram' AND created_at >= $1 AND created_at <= $2
      `, [weekStart, weekEnd]),

      // LinkedIn posts this week
      query(`
        SELECT
          COUNT(*) as created,
          COALESCE(SUM((engagement->>'likes')::int), 0) as likes,
          COALESCE(SUM((engagement->>'comments')::int), 0) as comments,
          COALESCE(SUM((engagement->>'impressions')::int), 0) as impressions
        FROM social_posts
        WHERE platform = 'linkedin' AND created_at >= $1 AND created_at <= $2
      `, [weekStart, weekEnd]),

      // Instagram DMs this week
      query(`
        SELECT
          COUNT(*) FILTER (WHERE direction = 'outbound') as sent,
          COUNT(*) FILTER (WHERE status = 'replied') as replied
        FROM social_dms
        WHERE platform = 'instagram' AND created_at >= $1 AND created_at <= $2
      `, [weekStart, weekEnd]),

      // LinkedIn DMs this week
      query(`
        SELECT
          COUNT(*) FILTER (WHERE direction = 'outbound') as sent,
          COUNT(*) FILTER (WHERE status = 'replied') as replied
        FROM social_dms
        WHERE platform = 'linkedin' AND created_at >= $1 AND created_at <= $2
      `, [weekStart, weekEnd]),

      // Emails this week
      query(`
        SELECT
          COUNT(*) FILTER (WHERE type IN ('outreach', 'follow_up') AND direction = 'outbound') as sent,
          COUNT(*) FILTER (WHERE type = 'reply' AND direction = 'inbound') as replied
        FROM messages
        WHERE created_at >= $1 AND created_at <= $2
      `, [weekStart, weekEnd]),

      // Qualified leads this week
      query(`
        SELECT COUNT(*) as count FROM leads
        WHERE status IN ('qualified', 'booked')
        AND updated_at >= $1 AND updated_at <= $2
      `, [weekStart, weekEnd]),

      // Booked meetings this week
      query(`
        SELECT COUNT(*) as count FROM leads
        WHERE status = 'booked'
        AND updated_at >= $1 AND updated_at <= $2
      `, [weekStart, weekEnd]),

      // Prospects found this week
      query(`
        SELECT
          COUNT(*) as found,
          COUNT(*) FILTER (WHERE status = 'converted') as converted
        FROM prospects
        WHERE created_at >= $1 AND created_at <= $2
      `, [weekStart, weekEnd]),
    ]);

    const igPosts = igPostsResult.rows[0];
    const liPosts = liPostsResult.rows[0];
    const igDMs = igDMsResult.rows[0];
    const liDMs = liDMsResult.rows[0];
    const emails = emailsResult.rows[0];
    const qualified = qualifiedResult.rows[0];
    const booked = bookedResult.rows[0];
    const prospects = prospectsResult.rows[0];

    // Upsert weekly report
    const report = await query(
      `INSERT INTO weekly_reports (
        week_start, week_end,
        ig_posts_created, ig_total_likes, ig_total_comments, ig_total_reach,
        li_posts_created, li_total_likes, li_total_comments, li_total_impressions,
        ig_dms_sent, ig_dms_replied, li_dms_sent, li_dms_replied,
        emails_sent, emails_replied, leads_qualified, meetings_scheduled,
        prospects_found, prospects_converted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT (week_start) DO UPDATE SET
        ig_posts_created = EXCLUDED.ig_posts_created,
        ig_total_likes = EXCLUDED.ig_total_likes,
        ig_total_comments = EXCLUDED.ig_total_comments,
        ig_total_reach = EXCLUDED.ig_total_reach,
        li_posts_created = EXCLUDED.li_posts_created,
        li_total_likes = EXCLUDED.li_total_likes,
        li_total_comments = EXCLUDED.li_total_comments,
        li_total_impressions = EXCLUDED.li_total_impressions,
        ig_dms_sent = EXCLUDED.ig_dms_sent,
        ig_dms_replied = EXCLUDED.ig_dms_replied,
        li_dms_sent = EXCLUDED.li_dms_sent,
        li_dms_replied = EXCLUDED.li_dms_replied,
        emails_sent = EXCLUDED.emails_sent,
        emails_replied = EXCLUDED.emails_replied,
        leads_qualified = EXCLUDED.leads_qualified,
        meetings_scheduled = EXCLUDED.meetings_scheduled,
        prospects_found = EXCLUDED.prospects_found,
        prospects_converted = EXCLUDED.prospects_converted
      RETURNING *`,
      [
        weekStart, weekEnd,
        parseInt(igPosts.created), parseInt(igPosts.likes), parseInt(igPosts.comments), parseInt(igPosts.reach),
        parseInt(liPosts.created), parseInt(liPosts.likes), parseInt(liPosts.comments), parseInt(liPosts.impressions),
        parseInt(igDMs.sent), parseInt(igDMs.replied),
        parseInt(liDMs.sent), parseInt(liDMs.replied),
        parseInt(emails.sent), parseInt(emails.replied),
        parseInt(qualified.count), parseInt(booked.count),
        parseInt(prospects.found), parseInt(prospects.converted),
      ]
    );

    res.json({ success: true, report: report.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /reports/dashboard — aggregated dashboard data
router.get('/dashboard', async (req, res, next) => {
  try {
    const [
      totalProspects,
      totalPosts,
      totalDMs,
      totalLeads,
      pipelineFunnel,
      recentActivity,
    ] = await Promise.all([
      query('SELECT COUNT(*) as count, COUNT(*) FILTER (WHERE status = \'converted\') as converted FROM prospects'),
      query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'published') as published,
          COALESCE(SUM((engagement->>'likes')::int), 0) as total_engagement
        FROM social_posts
      `),
      query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE direction = 'outbound') as sent,
          COUNT(*) FILTER (WHERE status = 'replied') as replied
        FROM social_dms
      `),
      query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'booked') as booked,
          COUNT(*) FILTER (WHERE status = 'qualified') as qualified
        FROM leads
      `),
      query(`
        SELECT status, COUNT(*) as count FROM leads GROUP BY status
        ORDER BY CASE status
          WHEN 'new' THEN 1 WHEN 'contacted' THEN 2 WHEN 'replied' THEN 3
          WHEN 'qualified' THEN 4 WHEN 'booked' THEN 5 WHEN 'disqualified' THEN 6
        END
      `),
      query(`
        SELECT type, COUNT(*) as count, MAX(created_at) as latest
        FROM events
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY type ORDER BY latest DESC
      `),
    ]);

    res.json({
      prospects: totalProspects.rows[0],
      posts: totalPosts.rows[0],
      dms: totalDMs.rows[0],
      leads: totalLeads.rows[0],
      funnel: pipelineFunnel.rows,
      recentActivity: recentActivity.rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
