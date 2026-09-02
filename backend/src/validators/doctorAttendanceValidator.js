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
  body('targetUserId').optional().isUUID(),
  handleValidationErrors
];

export const setStatusValidator = [
  body('targetUserId').isUUID().withMessage('targetUserId is required'),
  body('attendanceDate').isISO8601().withMessage('Valid attendanceDate is required'),
  body('status').isIn(['present', 'absent', 'half_day', 'on_leave']).withMessage('Invalid status'),
  body('notes').optional().trim().escape(),
  handleValidationErrors
];

export const listAttendanceValidator = [
  query('doctorUserId').optional().isUUID(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('status').optional().isIn(['present', 'absent', 'half_day', 'on_leave']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];
