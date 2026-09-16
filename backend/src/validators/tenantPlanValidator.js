import { body, query, param, validationResult } from 'express-validator';
import { HTTP_STATUS } from '../constants/httpStatus.js';
import { PLAN_FEATURE_KEYS, PLAN_LIMIT_KEYS } from '../config/planEntitlements.js';

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
  body('limits').isObject().withMessage('Plan limits are required'),
  ...PLAN_LIMIT_KEYS.map((key) => body(`limits.${key}`).isInt({ min: 1 }).withMessage(`limits.${key} must be a positive integer`)),
  body('limits.features').isObject().withMessage('Every plan must define its feature entitlements')
    .custom((features) => {
      const missing = PLAN_FEATURE_KEYS.filter((key) => typeof features[key] !== 'boolean');
      if (missing.length) throw new Error(`Missing feature entitlements: ${missing.join(', ')}`);
      return true;
    }),
  body('limits.customFeatures').optional().isArray({ max: 20 }),
  body('limits.customFeatures.*').optional().isString().trim().isLength({ min: 1, max: 120 }),
  handleValidationErrors
];

export const updatePlanValidator = [
  param('id').isUUID().withMessage('Valid Plan ID required'),
  body('status').optional().isIn(['active', 'inactive', 'archived']).withMessage('Invalid plan status'),
  ...createPlanValidator,
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
  body('billingPeriod').optional().isIn(['monthly', 'yearly']).withMessage('Invalid billing period'),
  handleValidationErrors
];

export const verifyProvisionPaymentValidator = [
  body('signupId').isUUID().withMessage('Valid signup ID is required'),
  body('razorpayPaymentId').trim().notEmpty().withMessage('Razorpay payment ID is required'),
  body('razorpayOrderId').trim().notEmpty().withMessage('Razorpay order ID is required'),
  body('razorpaySignature').trim().notEmpty().withMessage('Razorpay signature is required'),
  handleValidationErrors,
];

export const requestPlanValidator = [
  body('planId').isUUID().withMessage('Valid Plan ID is required'),
  body('period').optional().isIn(['monthly', '3months', 'yearly', '5years']),
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
