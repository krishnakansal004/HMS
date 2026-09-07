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

export const createPlanValidator = [
  body('name').trim().notEmpty().withMessage('Plan name is required').escape(),
  body('publicFlag').optional().isBoolean(),
  body('customized').optional().isBoolean(),
  body('accessCode').optional().trim().escape(),
  body('durations').optional().isArray(),
  body('prices').optional().isObject(),
  body('limits').optional().isObject(),
  handleValidationErrors
];

export const provisionTenantValidator = [
  body('name').trim().notEmpty().withMessage('Hospital name is required').escape(),
  body('slug').trim().notEmpty().withMessage('Hospital portal slug is required').isSlug().withMessage('Invalid slug format'),
  body('planId').isUUID().withMessage('Valid Plan ID is required'),
  body('adminName').trim().notEmpty().withMessage('Admin name is required').escape(),
  body('adminEmail').trim().isEmail().withMessage('Valid admin email required').normalizeEmail(),
  body('adminPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and a number'),
  handleValidationErrors
];

export const requestPlanValidator = [
  body('planId').isUUID().withMessage('Valid Plan ID is required'),
  body('period').optional().isIn(['monthly', '3months', 'yearly', '5years']),
  body('requestedAmount').optional().isFloat({ min: 0 }),
  body('accessCode').optional().trim().escape(),
  handleValidationErrors
];

export const reviewPlanRequestValidator = [
  param('id').isUUID().withMessage('Valid Request ID required'),
  body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),
  handleValidationErrors
];

export const updateTenantStatusValidator = [
  param('id').isUUID().withMessage('Valid Tenant ID required'),
  body('status').isIn(['active', 'suspended', 'cancelled']).withMessage('Status must be active, suspended, or cancelled'),
  handleValidationErrors
];

export const updateTenantPlanValidator = [
  param('id').isUUID().withMessage('Valid Tenant ID required'),
  body('planId').isUUID().withMessage('Valid Plan ID required'),
  handleValidationErrors
];