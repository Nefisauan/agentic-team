const express = require('express');
const { getMetrics, runAnalyticsAgent } = require('../agents/analyticsAgent');
const { getRecentJobLogs } = require('../middleware/supervisor');

const router = express.Router();

// GET /metrics — fetch analytics data
router.get('/', async (req, res, next) => {
  try {
    const metrics = await getMetrics();
    res.json(metrics);
  } catch (err) {
    next(err);
  }
});

// POST /metrics/refresh — manually run analytics agent
router.post('/refresh', async (req, res, next) => {
  try {
    const snapshot = await runAnalyticsAgent();
    res.json({ success: true, snapshot });
  } catch (err) {
    next(err);
  }
});

// GET /metrics/activity — job logs (supervisor feed)
router.get('/activity', async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const logs = await getRecentJobLogs(parseInt(limit, 10));
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
