const { createLogger, format, transports } = require('winston');
const { NODE_ENV } = process.env;

const logger = createLogger({
  level: NODE_ENV === 'production' ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'business-automation' },
  transports: [
    new transports.Console({
      format:
        NODE_ENV === 'production'
          ? format.json()
          : format.combine(
              format.colorize(),
              format.printf(({ timestamp, level, message, ...meta }) => {
                const metaStr = Object.keys(meta).length
                  ? ' ' + JSON.stringify(meta)
                  : '';
                return `${timestamp} [${level}] ${message}${metaStr}`;
              })
            ),
    }),
  ],
});

module.exports = logger;
