import { body, query, param, validationResult } from 'express-validator';
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

export const orderRadiologyValidator = [
  body('patientId').isUUID().withMessage('Valid Patient ID is required'),
  body('doctorProfileId').optional().isUUID().withMessage('Doctor Profile ID must be a UUID'),
  body('modality').trim().notEmpty().withMessage('Modality (e.g., X-RAY, MRI) is required').escape(),
  body('studyType').trim().notEmpty().withMessage('Study type is required').escape(),
  body('bodyPart').optional().trim().escape(),
  body('urgency').optional().isIn(['routine', 'urgent', 'stat']).withMessage('Invalid urgency level'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('notes').optional().trim().escape(),
  handleValidationErrors
];

export const updateRadiologyValidator = [
  param('id').isUUID().withMessage('Valid Radiology Order ID required'),
  body('status').isIn(['ordered', 'scheduled', 'in_progress', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('findings').optional().isString().trim(),
  body('impression').optional().isString().trim(),
  body('scanMetadata').optional().isObject().withMessage('Scan metadata must be a valid JSON object'),
  body('invoiceId').optional().isUUID().withMessage('Invoice ID must be a valid UUID for billing posting'),
  handleValidationErrors
];

export const listRadiologyOrdersValidator = [
  query('patientId').optional().isUUID(),
  query('status').optional().isString().escape(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];