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

export const submitCustomizationRequestValidator = [
  body('tenantId').optional().isUUID(),
  body('title').trim().escape().notEmpty().withMessage('Title is required'),
  body('description').optional().trim().escape(),
  body('requesterName').optional().trim().escape(),
  body('requesterEmail').optional().isEmail().normalizeEmail(),
  body('requesterPhone').optional().trim().escape(),
  body('requesterAddress').optional().trim().escape(),
  body('company').optional().trim().escape(),
  body('purpose').optional().trim().escape(),
  body('priceRange').optional().trim().escape(),
  body('period').optional().trim().escape(),
  body('acceptanceText').optional().trim().escape(),
  body('agreed').optional().isBoolean(),
  handleValidationErrors
];

export const updateRequestStatusValidator = [
  param('id').isUUID(),
  body('status').isIn(['NEW', 'IN_PROGRESS', 'COMPLETED', 'REJECTED']),
  handleValidationErrors
];

export const listRequestsValidator = [
  query('status').optional().isIn(['NEW', 'IN_PROGRESS', 'COMPLETED', 'REJECTED']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];
