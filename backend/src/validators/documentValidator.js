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

export const registerDocumentValidator = [
  body('entityType').trim().notEmpty().withMessage('entityType is required'),
  body('entityId').isUUID().withMessage('Valid entityId is required'),
  body('url').isURL().withMessage('A valid url is required'),
  body('publicId').optional().trim(),
  body('mimeType').optional().trim(),
  body('sizeBytes').optional().isInt({ min: 0 }),
  handleValidationErrors
];

export const listForEntityValidator = [
  query('entityType').trim().notEmpty().withMessage('entityType is required'),
  query('entityId').isUUID().withMessage('Valid entityId is required'),
  handleValidationErrors
];

export const documentIdValidator = [
  param('id').isUUID(),
  handleValidationErrors
];
