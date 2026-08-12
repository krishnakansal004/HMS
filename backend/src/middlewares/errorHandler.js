import { HTTP_STATUS } from '../constants/httpStatus.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  err.status = err.status || 'error';

  // Log operational errors vs critical programming bugs
  if (err.statusCode >= 500) {
    logger.error(`[CRITICAL ERROR] ${err.message}`, { stack: err.stack, path: req.path, method: req.method });
  } else {
    logger.warn(`[API FAIL] ${err.message}`, { path: req.path, method: req.method, statusCode: err.statusCode });
  }

  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    message: err.message || 'Internal Server Error',
    ...(env.nodeEnv !== 'production' && { stack: err.stack })
  });
};