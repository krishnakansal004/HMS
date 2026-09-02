import { body, param, query, validationResult } from 'express-validator';
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

export const generateReceiptValidator = [
  body('invoiceId').isUUID().withMessage('Valid invoiceId is required'),
  handleValidationErrors
];

export const receiptIdValidator = [
  param('id').isUUID(),
  handleValidationErrors
];

export const listReceiptsValidator = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];
