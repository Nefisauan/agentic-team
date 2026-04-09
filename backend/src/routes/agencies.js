const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

// GET /agencies — list agency partners
router.get('/', async (req, res, next) => {
  try {
    const { status, agency_type, search, limit = 50, offset = 0 } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }
    if (agency_type) {
      params.push(agency_type);
      whereClause += ` AND agency_type = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (agency_name ILIKE $${params.length} OR contact_name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }

    params.push(parseInt(limit, 10));
    params.push(parseInt(offset, 10));

    const result = await query(
      `SELECT * FROM agency_partners ${whereClause}
       ORDER BY score DESC NULLS LAST, created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM agency_partners ${whereClause}`,
      params.slice(0, -2)
    );

    res.json({
      agencies: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    });
  } catch (err) {
    next(err);
  }
});

// GET /agencies/:id — agency detail + messages
router.get('/:id', async (req, res, next) => {
  try {
    const agencyResult = await query('SELECT * FROM agency_partners WHERE id = $1', [req.params.id]);
    if (agencyResult.rowCount === 0) return res.status(404).json({ error: 'Agency not found' });

    const messages = await query(
      'SELECT * FROM agency_messages WHERE agency_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.params.id]
    );

    res.json({ agency: agencyResult.rows[0], messages: messages.rows });
  } catch (err) {
    next(err);
  }
});

// PATCH /agencies/:id — update agency
router.patch('/:id', async (req, res, next) => {
  try {
    const { status, notes, score, partnership_type } = req.body;
    const updates = [];
    const params = [];
    let i = 1;

    if (status !== undefined) { updates.push(`status = $${i++}`); params.push(status); }
    if (notes !== undefined) { updates.push(`notes = $${i++}`); params.push(notes); }
    if (score !== undefined) { updates.push(`score = $${i++}`); params.push(score); }
    if (partnership_type !== undefined) { updates.push(`partnership_type = $${i++}`); params.push(partnership_type); }

    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

    params.push(req.params.id);
    const result = await query(
      `UPDATE agency_partners SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Agency not found' });
    res.json({ agency: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /agencies/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM agency_messages WHERE agency_id = $1', [req.params.id]);
    await query('DELETE FROM agency_partners WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// POST /agencies/:id/pitch — pitch a specific agency
router.post('/:id/pitch', async (req, res, next) => {
  try {
    const { channel = 'email', platform } = req.body;
    const { agencyQueue } = require('../workers/agencyWorker');

    let jobData;
    if (channel === 'email') {
      jobData = { mode: 'pitch_email', options: { agencyId: req.params.id } };
    } else {
      jobData = { mode: 'pitch_dm', options: { agencyId: req.params.id, platform: platform || channel } };
    }

    const job = await agencyQueue.add('pitch-agency', jobData);
    res.json({ success: true, jobId: job.id, channel });
  } catch (err) {
    next(err);
  }
});

// POST /agencies/research — trigger agency research
router.post('/research', async (req, res, next) => {
  try {
    const { agencyQueue } = require('../workers/agencyWorker');
    const {
      agencyTypes = ['ad_agency', 'marketing_agency', 'digital_agency', 'seo_agency', 'social_media_agency', 'web_design'],
      location = 'Utah and nationwide',
      count = 15,
    } = req.body;

    const job = await agencyQueue.add('research-agencies', {
      mode: 'research',
      options: { agencyTypes, location, count },
    });

    res.json({ success: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
});

// POST /agencies/batch-pitch — research + pitch all
router.post('/batch-pitch', async (req, res, next) => {
  try {
    const { agencyQueue } = require('../workers/agencyWorker');
    const job = await agencyQueue.add('batch-agency-pipeline', {
      mode: 'batch_pitch',
      options: req.body || {},
    });

    res.json({ success: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
});

// POST /agencies/followup — trigger follow-ups
router.post('/followup', async (req, res, next) => {
  try {
    const { agencyQueue } = require('../workers/agencyWorker');
    const job = await agencyQueue.add('followup-agencies', {
      mode: 'followup',
      options: req.body || {},
    });

    res.json({ success: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
});

// GET /agencies/metrics — agency pipeline metrics
router.get('/metrics/summary', async (req, res, next) => {
  try {
    const [statusCounts, channelCounts, typeCounts] = await Promise.all([
      query(`
        SELECT status, COUNT(*) as count
        FROM agency_partners GROUP BY status
        ORDER BY CASE status
          WHEN 'new' THEN 1 WHEN 'researched' THEN 2 WHEN 'pitched' THEN 3
          WHEN 'interested' THEN 4 WHEN 'negotiating' THEN 5 WHEN 'partner' THEN 6 WHEN 'declined' THEN 7
        END
      `),
      query(`
        SELECT channel, direction, COUNT(*) as count
        FROM agency_messages GROUP BY channel, direction
      `),
      query(`
        SELECT agency_type, COUNT(*) as count
        FROM agency_partners GROUP BY agency_type ORDER BY count DESC
      `),
    ]);

    res.json({
      pipeline: statusCounts.rows,
      messages: channelCounts.rows,
      byType: typeCounts.rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
