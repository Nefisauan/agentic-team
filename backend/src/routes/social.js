const express = require('express');
const { query } = require('../config/database');
const { addContentJob, addDMJob } = require('../queues/index');

const router = express.Router();

// ── Social Posts ──────────────────────────────────────────────────────────────

// GET /social/posts — list social media posts
router.get('/posts', async (req, res, next) => {
  try {
    const { platform, status, limit = 50, offset = 0 } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (platform) {
      params.push(platform);
      whereClause += ` AND platform = $${params.length}`;
    }
    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }

    params.push(parseInt(limit, 10));
    params.push(parseInt(offset, 10));

    const result = await query(
      `SELECT * FROM social_posts ${whereClause}
       ORDER BY COALESCE(scheduled_for, created_at) DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM social_posts ${whereClause}`,
      params.slice(0, -2)
    );

    res.json({
      posts: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    });
  } catch (err) {
    next(err);
  }
});

// GET /social/posts/:id — single post detail
router.get('/posts/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM social_posts WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ post: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /social/posts/:id — update post (edit caption, change status, add engagement)
router.patch('/posts/:id', async (req, res, next) => {
  try {
    const { caption, hashtags, status, engagement, image_url, scheduled_for } = req.body;
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (caption !== undefined) { updates.push(`caption = $${paramIndex++}`); params.push(caption); }
    if (hashtags !== undefined) { updates.push(`hashtags = $${paramIndex++}`); params.push(hashtags); }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
      if (status === 'published') {
        updates.push(`published_at = NOW()`);
      }
    }
    if (engagement !== undefined) { updates.push(`engagement = $${paramIndex++}`); params.push(JSON.stringify(engagement)); }
    if (image_url !== undefined) { updates.push(`image_url = $${paramIndex++}`); params.push(image_url); }
    if (scheduled_for !== undefined) { updates.push(`scheduled_for = $${paramIndex++}`); params.push(scheduled_for); }

    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

    params.push(req.params.id);
    const result = await query(
      `UPDATE social_posts SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Post not found' });
    res.json({ post: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /social/posts/:id — delete a post
router.delete('/posts/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM social_posts WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// POST /social/generate — trigger content generation
router.post('/generate', async (req, res, next) => {
  try {
    const { mode = 'weekly_batch', options = {} } = req.body;
    const job = await addContentJob({ mode, options });
    res.json({ success: true, jobId: job.id, mode });
  } catch (err) {
    next(err);
  }
});

// ── Social DMs ───────────────────────────────────────────────────────────────

// GET /social/dms — list DMs
router.get('/dms', async (req, res, next) => {
  try {
    const { platform, status, lead_id, limit = 50 } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (platform) { params.push(platform); whereClause += ` AND sd.platform = $${params.length}`; }
    if (status) { params.push(status); whereClause += ` AND sd.status = $${params.length}`; }
    if (lead_id) { params.push(lead_id); whereClause += ` AND sd.lead_id = $${params.length}`; }

    params.push(parseInt(limit, 10));

    const result = await query(
      `SELECT sd.*, l.name as lead_name, l.company as lead_company
       FROM social_dms sd
       LEFT JOIN leads l ON sd.lead_id = l.id
       ${whereClause}
       ORDER BY sd.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({ dms: result.rows });
  } catch (err) {
    next(err);
  }
});

// POST /social/dm — send a DM
router.post('/dm', async (req, res, next) => {
  try {
    const { mode = 'outreach', leadId, prospectId, platform, context = {} } = req.body;

    if (!platform) return res.status(400).json({ error: 'platform is required' });

    const job = await addDMJob({ mode, leadId, prospectId, platform, context });
    res.json({ success: true, jobId: job.id, platform, mode });
  } catch (err) {
    next(err);
  }
});

// POST /social/dm/batch — batch DMs to prospects
router.post('/dm/batch', async (req, res, next) => {
  try {
    const { platform, context = {} } = req.body;
    if (!platform) return res.status(400).json({ error: 'platform is required' });

    const job = await addDMJob({ mode: 'batch', platform, context });
    res.json({ success: true, jobId: job.id, platform, mode: 'batch' });
  } catch (err) {
    next(err);
  }
});

// ── Social Metrics ───────────────────────────────────────────────────────────

// GET /social/metrics — social media performance metrics
router.get('/metrics', async (req, res, next) => {
  try {
    const [postsMetrics, dmMetrics, platformBreakdown] = await Promise.all([
      query(`
        SELECT
          platform,
          COUNT(*) as total_posts,
          COUNT(*) FILTER (WHERE status = 'published') as published,
          COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
          COUNT(*) FILTER (WHERE status = 'draft') as drafts,
          COALESCE(SUM((engagement->>'likes')::int), 0) as total_likes,
          COALESCE(SUM((engagement->>'comments')::int), 0) as total_comments,
          COALESCE(SUM((engagement->>'reach')::int), 0) as total_reach
        FROM social_posts
        GROUP BY platform
      `),
      query(`
        SELECT
          platform,
          COUNT(*) as total_dms,
          COUNT(*) FILTER (WHERE direction = 'outbound') as sent,
          COUNT(*) FILTER (WHERE direction = 'inbound') as received,
          COUNT(*) FILTER (WHERE status = 'replied') as replied,
          COUNT(*) FILTER (WHERE status = 'read') as read
        FROM social_dms
        GROUP BY platform
      `),
      query(`
        SELECT
          DATE_TRUNC('day', created_at) as day,
          platform,
          COUNT(*) as count
        FROM social_posts
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY day, platform
        ORDER BY day
      `),
    ]);

    res.json({
      posts: postsMetrics.rows,
      dms: dmMetrics.rows,
      postsByDay: platformBreakdown.rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
