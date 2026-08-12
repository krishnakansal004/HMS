import winston from 'winston';
import { env } from './env.js';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const devFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

export const logger = winston.createLogger({
  level: env.nodeEnv === 'production' ? 'info' : 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    env.nodeEnv === 'production' ? json() : combine(colorize(), devFormat)
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Catch unhandled rejections to prevent silent failures
process.on('unhandledRejection', (reason) => {
  logger.error(`[Unhandled Rejection] ${reason}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`[Uncaught Exception] ${error.message}`, { stack: error.stack });
  process.exit(1);
});