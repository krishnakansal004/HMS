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
  body('patientId').optional().isUUID().withMessage('Valid Patient ID is required'), // <-- Made optional
  body('startTime').isISO8601().withMessage('Valid start time (ISO 8601) is required').toDate(),
  body('endTime').isISO8601().withMessage('Valid end time (ISO 8601) is required').toDate(),
  body('type').isIn(['online', 'walk_in']).withMessage('Type must be online or walk_in'),
  body('notes').optional().isString().trim().escape(),
  handleValidationErrors
];

// Lowercase, matching chk_appointment_status in migration 0042 -- every
// status-like CHECK constraint in this schema uses lowercase, and the DB
// is what actually enforces this, not the validator. Previously uppercase
// here (and in the service/repository/frontend) while the DB was always
// lowercase -- confirmed via a full migration dry-run that every value
// this validator allowed failed the DB constraint on every real request.
export const updateStatusValidator = [
  body('status').isIn(['confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show']).withMessage('Invalid status transition'),
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