import { body, validationResult } from 'express-validator';
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

export const dispatchAmbulanceValidator = [
  body('vehicleNumber').trim().notEmpty().escape(),
  body('emergencyLevel').optional().isIn(['MODERATE', 'URGENT', 'CRITICAL']),
  handleValidationErrors
];

export const scheduleSurgeryValidator = [
  body('patientId').isUUID().withMessage('Valid Patient ID required'),
  body('surgeryName').trim().notEmpty().escape(),
  body('scheduledAt').isISO8601().toDate(),
  handleValidationErrors
];