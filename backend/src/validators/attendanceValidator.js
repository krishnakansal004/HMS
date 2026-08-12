import { body, query, validationResult } from 'express-validator';
import { HTTP_STATUS } from '../constants/httpStatus.js';

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({ field: err.path, message: err.msg }))
    });
  }
  next();
};

export const checkInOutValidator = [
  // Optional: Used when an Admin/HR checks in a staff member manually
  body('targetUserId').optional().isUUID().withMessage('Valid Target User ID must be provided'),
  handleValidationErrors
];

export const listAttendanceValidator = [
  query('userId').optional().isUUID().withMessage('Valid User ID must be provided'),
  query('startDate').optional().isISO8601().toDate().withMessage('Valid start date required'),
  query('endDate').optional().isISO8601().toDate().withMessage('Valid end date required'),
  query('status').optional().isIn(['PRESENT', 'LEAVE', 'HALF_DAY']).withMessage('Invalid status'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];