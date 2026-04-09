const express = require('express');
const { query } = require('../config/database');
const { addClientFindingJob, addDMJob, addOutreachJob } = require('../queues/index');
const { convertProspectToLead } = require('../agents/clientFindingAgent');

const router = express.Router();

// GET /prospects — list prospects
router.get('/', async (req, res, next) => {
  try {
    const { status, industry, search, limit = 50, offset = 0, sort = 'created_at', order = 'desc' } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }
    if (industry) {
      params.push(industry);
      whereClause += ` AND industry = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (company_name ILIKE $${params.length} OR contact_name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }

    const validSorts = ['created_at', 'score', 'company_name', 'status'];
    const sortCol = validSorts.includes(sort) ? sort : 'created_at';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';

    params.push(parseInt(limit, 10));
    params.push(parseInt(offset, 10));

    const result = await query(
      `SELECT * FROM prospects ${whereClause}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM prospects ${whereClause}`,
      params.slice(0, -2)
    );

    res.json({
      prospects: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    });
  } catch (err) {
    next(err);
  }
});

// GET /prospects/:id — single prospect detail
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM prospects WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Prospect not found' });

    // Get related DMs
    const dms = await query(
      `SELECT * FROM social_dms WHERE metadata->>'prospect_id' = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.params.id]
    );

    res.json({ prospect: result.rows[0], dms: dms.rows });
  } catch (err) {
    next(err);
  }
});

// PATCH /prospects/:id — update prospect (approve, reject, edit)
router.patch('/:id', async (req, res, next) => {
  try {
    const { status, notes, score } = req.body;
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (status !== undefined) { updates.push(`status = $${paramIndex++}`); params.push(status); }
    if (notes !== undefined) { updates.push(`notes = $${paramIndex++}`); params.push(notes); }
    if (score !== undefined) { updates.push(`score = $${paramIndex++}`); params.push(score); }

    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

    params.push(req.params.id);
    const result = await query(
      `UPDATE prospects SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Prospect not found' });
    res.json({ prospect: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /prospects/:id/convert — convert prospect to lead
router.post('/:id/convert', async (req, res, next) => {
  try {
    const result = await convertProspectToLead(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /prospects/:id/dm — send DM to prospect
router.post('/:id/dm', async (req, res, next) => {
  try {
    const { platform, context = {} } = req.body;
    if (!platform) return res.status(400).json({ error: 'platform is required' });

    const job = await addDMJob({
      mode: 'outreach',
      prospectId: req.params.id,
      platform,
      context,
    });

    res.json({ success: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
});

// DELETE /prospects/:id — delete prospect
router.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM prospects WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// POST /prospects/research — trigger client-finding agent
router.post('/research', async (req, res, next) => {
  try {
    const {
      industries = ['HVAC', 'roofing', 'plumbing', 'electrical', 'landscaping', 'cleaning'],
      location = 'Utah',
      count = 15,
      autoConvert = false,
      autoDM = false,
    } = req.body;

    const job = await addClientFindingJob({ industries, location, count, autoConvert, autoDM });
    res.json({ success: true, jobId: job.id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
