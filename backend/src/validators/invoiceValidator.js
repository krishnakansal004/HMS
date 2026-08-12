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

export const generateInvoiceValidator = [
  body('patientId').isUUID().withMessage('Valid Patient ID is required'),
  body('discount').optional().isInt({ min: 0 }).withMessage('Discount must be an integer (in minor currency)'),
  body('taxRate').optional().isInt({ min: 0, max: 100 }).withMessage('Tax rate must be an integer percentage (0-100)'),
  
  body('items').isArray({ min: 1 }).withMessage('At least one invoice item is required'),
  body('items.*.entityType').isIn(['CONSULTATION', 'MEDICINE', 'LAB', 'RADIOLOGY', 'ROOM', 'OTHER']).withMessage('Invalid entity type'),
  body('items.*.entityId').optional().isUUID().withMessage('Entity ID must be a valid UUID'),
  body('items.*.description').trim().notEmpty().withMessage('Description is required').escape(),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be an integer greater than 0'),
  body('items.*.unitPrice').isInt({ min: 0 }).withMessage('Unit price must be an integer (in minor currency)'),
  
  handleValidationErrors
];

export const recordPaymentValidator = [
  param('id').isUUID().withMessage('Valid Invoice ID is required'),
  body('amount').isInt({ min: 1 }).withMessage('Payment amount must be a positive integer (in minor currency)'),
  body('method').isIn(['CASH', 'UPI', 'CARD', 'INSURANCE', 'CHEQUE']).withMessage('Invalid payment method'),
  body('transactionId').optional().trim().escape(),
  handleValidationErrors
];

export const listInvoicesValidator = [
  query('patientId').optional().isUUID(),
  query('status').optional().isIn(['DRAFT', 'PENDING', 'PARTIAL', 'PAID', 'CANCELLED']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];