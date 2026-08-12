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

export const createTestCatalogValidator = [
  body('name').trim().notEmpty().withMessage('Test name is required').escape(),
  body('code').trim().notEmpty().withMessage('Test code is required').escape(),
  body('category').optional().trim().escape(),
  body('sampleType').optional().trim().escape(),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('referenceRange').optional().isString().trim(),
  handleValidationErrors
];

export const orderLabValidator = [
  body('patientId').isUUID().withMessage('Valid Patient ID is required'),
  body('testId').isUUID().withMessage('Valid Test Catalog ID is required'),
  body('doctorProfileId').optional().isUUID().withMessage('Doctor Profile ID must be a UUID'),
  body('prescriptionId').optional().isUUID().withMessage('Prescription ID must be a UUID'),
  handleValidationErrors
];

export const updateLabResultsValidator = [
  param('id').isUUID().withMessage('Valid Lab Order ID is required'),
  body('sampleStatus').isIn(['pending', 'collected', 'processing', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('technicianNotes').optional().isString().trim(),
  body('results').optional().isObject().withMessage('Results must be a structured JSON object'),
  body('invoiceId').optional().isUUID().withMessage('Invoice ID must be a valid UUID to post charges'),
  handleValidationErrors
];

export const listLabOrdersValidator = [
  query('patientId').optional().isUUID(),
  query('status').optional().isString().escape(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];