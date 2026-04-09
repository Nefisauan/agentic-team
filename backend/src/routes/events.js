const express = require('express');
const { query } = require('../config/database');
const {
  addOutreachJob,
  addFollowupJob,
  addQualificationJob,
  addSchedulingJob,
  addContentJob,
  addDMJob,
  addClientFindingJob,
} = require('../queues/index');
const { FOLLOWUP_DELAY_DAYS } = require('../config/env');

const router = express.Router();

// POST /events — manually trigger an event (testing / admin)
router.post('/', async (req, res, next) => {
  try {
    const { type, lead_id, payload = {} } = req.body;

    const validTypes = [
      'new_lead',
      'follow_up_due',
      'lead_replied',
      'meeting_booked',
      'lead_qualified',
      'content_generated',
      'dm_sent',
      'prospects_found',
      'prospect_converted',
    ];

    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({
        error: 'Invalid or missing event type',
        validTypes,
      });
    }

    if (!lead_id) {
      return res.status(400).json({ error: 'lead_id is required' });
    }

    // Verify lead exists
    const leadResult = await query('SELECT id, status FROM leads WHERE id = $1', [lead_id]);
    if (leadResult.rowCount === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Save event record
    await query(
      `INSERT INTO events (type, lead_id, payload) VALUES ($1, $2, $3)`,
      [type, lead_id, JSON.stringify({ ...payload, source: 'manual' })]
    );

    // Dispatch to appropriate queue
    let job;
    const delayMs = FOLLOWUP_DELAY_DAYS * 24 * 60 * 60 * 1000;

    switch (type) {
      case 'new_lead':
        job = await addOutreachJob(lead_id);
        break;
      case 'follow_up_due':
        job = await addFollowupJob(lead_id, 0); // immediate
        break;
      case 'lead_replied':
        job = await addQualificationJob(lead_id, payload.reply_message_id || null);
        break;
      case 'lead_qualified':
        job = await addSchedulingJob(lead_id);
        break;
      case 'meeting_booked':
        await query(
          `UPDATE leads SET status = 'booked', updated_at = NOW() WHERE id = $1`,
          [lead_id]
        );
        break;
      case 'content_generated':
        job = await addContentJob(payload);
        break;
      case 'dm_sent':
        job = await addDMJob({ leadId: lead_id, platform: payload.platform || 'instagram', ...payload });
        break;
      case 'prospects_found':
        job = await addClientFindingJob(payload);
        break;
    }

    res.json({
      success: true,
      event: { type, lead_id, payload },
      jobId: job?.id || null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /events — list recent events
router.get('/', async (req, res, next) => {
  try {
    const { lead_id, type, limit = 50 } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (lead_id) {
      params.push(lead_id);
      whereClause += ` AND e.lead_id = $${params.length}`;
    }
    if (type) {
      params.push(type);
      whereClause += ` AND e.type = $${params.length}`;
    }

    params.push(parseInt(limit, 10));

    const result = await query(
      `SELECT e.*, l.name as lead_name, l.email as lead_email
       FROM events e
       LEFT JOIN leads l ON e.lead_id = l.id
       ${whereClause}
       ORDER BY e.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    res.json({ events: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
