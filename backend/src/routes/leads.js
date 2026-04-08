const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');
const { addOutreachJob } = require('../queues/index');
const logger = require('../config/logger');

const router = express.Router();

// POST /leads — add a new lead (triggers outreach pipeline)
router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, company, notes } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check for duplicate
    const existing = await query('SELECT id, status FROM leads WHERE email = $1', [normalizedEmail]);
    if (existing.rowCount > 0) {
      return res.status(409).json({
        error: 'Lead with this email already exists',
        lead: existing.rows[0],
      });
    }

    const id = uuidv4();
    const result = await query(
      `INSERT INTO leads (id, name, email, phone, company, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'new')
       RETURNING *`,
      [id, name.trim(), normalizedEmail, phone || null, company?.trim() || null, notes?.trim() || null]
    );

    const lead = result.rows[0];

    // Create new_lead event
    await query(
      `INSERT INTO events (type, lead_id, payload) VALUES ('new_lead', $1, $2)`,
      [id, JSON.stringify({ source: 'api' })]
    );

    // Enqueue outreach job
    const job = await addOutreachJob(id);

    logger.info('New lead created', { leadId: id, email: normalizedEmail, jobId: job.id });

    res.status(201).json({ lead, jobId: job.id });
  } catch (err) {
    next(err);
  }
});

// GET /leads — list all leads with optional filters
router.get('/', async (req, res, next) => {
  try {
    const { status, search, limit = 50, offset = 0, sort = 'created_at', order = 'desc' } = req.query;

    const validSorts = ['created_at', 'updated_at', 'last_contacted_at', 'score', 'name', 'status'];
    const validOrders = ['asc', 'desc'];
    const safeSort = validSorts.includes(sort) ? sort : 'created_at';
    const safeOrder = validOrders.includes(order.toLowerCase()) ? order.toLowerCase() : 'desc';

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR company ILIKE $${params.length})`;
    }

    params.push(parseInt(limit, 10));
    const limitClause = `LIMIT $${params.length}`;

    params.push(parseInt(offset, 10));
    const offsetClause = `OFFSET $${params.length}`;

    const [leadsResult, countResult] = await Promise.all([
      query(
        `SELECT * FROM leads ${whereClause} ORDER BY ${safeSort} ${safeOrder} ${limitClause} ${offsetClause}`,
        params
      ),
      query(
        `SELECT COUNT(*) as total FROM leads ${whereClause}`,
        params.slice(0, params.length - 2)
      ),
    ]);

    res.json({
      leads: leadsResult.rows,
      total: parseInt(countResult.rows[0].total, 10),
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  } catch (err) {
    next(err);
  }
});

// GET /leads/:id — single lead with messages
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const [leadResult, messagesResult] = await Promise.all([
      query('SELECT * FROM leads WHERE id = $1', [id]),
      query(
        `SELECT * FROM messages WHERE lead_id = $1 ORDER BY sent_at DESC LIMIT 50`,
        [id]
      ),
    ]);

    if (leadResult.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ lead: leadResult.rows[0], messages: messagesResult.rows });
  } catch (err) {
    next(err);
  }
});

// PATCH /leads/:id — update lead (status, notes, etc.)
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes, score } = req.body;

    const validStatuses = ['new', 'contacted', 'replied', 'qualified', 'booked', 'disqualified'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updates = [];
    const params = [];

    if (status !== undefined) { params.push(status); updates.push(`status = $${params.length}`); }
    if (notes !== undefined) { params.push(notes); updates.push(`notes = $${params.length}`); }
    if (score !== undefined) { params.push(score); updates.push(`score = $${params.length}`); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    params.push(id);
    const result = await query(
      `UPDATE leads SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ lead: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// DELETE /leads/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM leads WHERE id = $1 RETURNING id', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    res.json({ deleted: true, id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
