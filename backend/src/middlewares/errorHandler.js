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
        const target = Array.isArray(err.meta?.target)
          ? err.meta.target.join(", ")
          : err.meta?.target || "field";
        return new AppError(`A record with this ${target} already exists.`, HTTP_STATUS.CONFLICT);
      }
      case "P2025":
        return new AppError("The requested record was not found.", HTTP_STATUS.NOT_FOUND);
      case "P2003": {
        const field = err.meta?.field_name || "related record";
        return new AppError(`Invalid reference: ${field} does not exist.`, HTTP_STATUS.BAD_REQUEST);
      }
      case "P2000":
        return new AppError("One or more values are too long for their field.", HTTP_STATUS.BAD_REQUEST);
      case "P2014":
        return new AppError("This change would violate a strict database relation.", HTTP_STATUS.BAD_REQUEST);
      default:
        // Catch-all for any other Prisma query error (prevents leaking schema details)
        return new AppError("A database operation failed.", HTTP_STATUS.BAD_REQUEST);
    }
  }
  const instance = err instanceof Prisma.PrismaClientValidationError

  if (err instanceof Prisma.PrismaClientValidationError) {
    return new AppError("The request could not be processed due to a data conflict.", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
  
  if (
    err instanceof Prisma.PrismaClientInitializationError || 
    err instanceof Prisma.PrismaClientRustPanicError || 
    err instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return new AppError("A critical database error occurred.", HTTP_STATUS.INTERNAL_SERVER_ERROR);
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
