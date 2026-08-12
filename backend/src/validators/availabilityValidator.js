import { body, param, validationResult } from 'express-validator';
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

// Regex to strictly match HH:mm format (00:00 to 23:59)
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const getAvailabilityValidator = [
  param('doctorId').isUUID().withMessage('Valid Doctor ID is required'),
  handleValidationErrors
];

export const updateAvailabilityValidator = [
  param('doctorId').isUUID().withMessage('Valid Doctor ID is required'),
  
  // Validate Days Array
  body('days').isArray({ min: 7, max: 7 }).withMessage('Days array must contain exactly 7 objects (0-6 for Sun-Sat)'),
  body('days.*.dayOfWeek').isInt({ min: 0, max: 6 }).withMessage('dayOfWeek must be between 0 (Sun) and 6 (Sat)'),
  body('days.*.enabled').isBoolean().withMessage('enabled must be a boolean'),
  body('days.*.startTime').matches(timeRegex).withMessage('startTime must be in HH:mm format'),
  body('days.*.endTime').matches(timeRegex).withMessage('endTime must be in HH:mm format'),
  body('days.*.slotDurationMin').isInt({ min: 5, max: 120 }).withMessage('slotDurationMin must be between 5 and 120 minutes'),

  // Validate Exceptions Array (Optional)
  body('exceptions').optional().isArray().withMessage('Exceptions must be an array'),
  body('exceptions.*.date').isISO8601().withMessage('Exception date must be a valid ISO8601 date string (YYYY-MM-DD)'),
  body('exceptions.*.enabled').isBoolean().withMessage('Exception enabled must be a boolean'),
  body('exceptions.*.startTime').optional().matches(timeRegex).withMessage('Exception startTime must be in HH:mm format'),
  body('exceptions.*.endTime').optional().matches(timeRegex).withMessage('Exception endTime must be in HH:mm format'),
  
  handleValidationErrors
];