import { Prisma } from "@prisma/client";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

function mapPrismaError(err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        // Unique constraint violation. err.meta.target is usually an array
        // of column names (or the @@map'd constraint name) involved.
        const target = Array.isArray(err.meta?.target)
          ? err.meta.target.join(", ")
          : err.meta?.target || "field";
        return new AppError(
          `A record with this ${target} already exists.`,
          HTTP_STATUS.CONFLICT,
        );
      }
      case "P2025":
        // Record required for the operation (update/delete/connect) was not found.
        return new AppError(
          "The requested record was not found.",
          HTTP_STATUS.NOT_FOUND,
        );
      case "P2003": {
        // Foreign key constraint violation.
        const field = err.meta?.field_name || "related record";
        return new AppError(
          `Invalid reference: ${field} does not exist.`,
          HTTP_STATUS.BAD_REQUEST,
        );
      }
      case "P2000":
        // Value too long for the column type.
        return new AppError(
          "One or more values are too long for their field.",
          HTTP_STATUS.BAD_REQUEST,
        );
      default:
        return null;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    // Malformed query (unknown field, wrong type, etc.) — this is a
    // programming bug, not user input, so keep it a 500 but at least make
    // sure it's logged loudly and doesn't leak the raw Prisma message to
    // the client in production.
    return new AppError(
      "A database query error occurred.",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }

  return null;
}

export const errorHandler = (err, req, res, next) => {
  const mapped = mapPrismaError(err);
  if (mapped) {
    err = mapped;
  }

  err.statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  err.status = err.status || "error";

  // Log operational errors vs critical programming bugs
  if (err.statusCode >= 500) {
    logger.error(`[CRITICAL ERROR] ${err.message}`, {
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.warn(`[API FAIL] ${err.message}`, {
      path: req.path,
      method: req.method,
      statusCode: err.statusCode,
    });
  }

  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    message: err.message || "Internal Server Error",
    ...(env.nodeEnv !== "production" && { stack: err.stack }),
  });
};
