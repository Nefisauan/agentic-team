const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  logger.error('Request error', {
    method: req.method,
    url: req.url,
    status,
    error: message,
    stack: status >= 500 ? err.stack : undefined,
  });

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

function notFound(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
}

module.exports = { errorHandler, notFound };
