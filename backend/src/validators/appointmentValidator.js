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

export const bookAppointmentValidator = [
  body('doctorId').isUUID().withMessage('Valid Doctor ID is required'),
  body('patientId').isUUID().withMessage('Valid Patient ID is required'),
  body('startTime').isISO8601().withMessage('Valid start time (ISO 8601) is required').toDate(),
  body('endTime').isISO8601().withMessage('Valid end time (ISO 8601) is required').toDate(),
  body('type').isIn(['ONLINE', 'WALK_IN']).withMessage('Type must be ONLINE or WALK_IN'),
  body('notes').optional().isString().trim().escape(),
  handleValidationErrors
];

export const updateStatusValidator = [
  body('status').isIn(['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']).withMessage('Invalid status transition'),
  body('reason').optional().isString().trim().escape(),
  handleValidationErrors
];

export const listAppointmentsValidator = [
  query('doctorId').optional().isUUID(),
  query('patientId').optional().isUUID(),
  query('date').optional().isISO8601().toDate(),
  query('status').optional().isString().escape(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];