const { Redis } = require('ioredis');
const { REDIS_URL } = require('./env');
const logger = require('./logger');

let connection;

function getRedisConnection() {
  if (!connection) {
    connection = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
      lazyConnect: true,
    });

    connection.on('connect', () => logger.info('Redis connected'));
    connection.on('error', (err) => logger.error('Redis error', { error: err.message }));
    connection.on('close', () => logger.warn('Redis connection closed'));
  }
  return connection;
}

module.exports = { getRedisConnection };
