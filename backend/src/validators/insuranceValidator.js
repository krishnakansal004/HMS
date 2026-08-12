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

export const createCompanyValidator = [
  body('name').trim().notEmpty().withMessage('Company name is required').escape(),
  body('code').trim().notEmpty().withMessage('Company code/identifier is required').escape(),
  body('contactPerson').optional().trim().escape(),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().trim().escape(),
  body('corporateDiscount').optional().isFloat({ min: 0, max: 100 }),
  handleValidationErrors
];

export const submitClaimValidator = [
  body('patientId').isUUID().withMessage('Valid Patient ID is required'),
  body('companyId').isUUID().withMessage('Valid Insurance Company ID is required'),
  body('policyNumber').trim().notEmpty().withMessage('Policy number is required').escape(),
  body('totalBillAmount').isFloat({ min: 0 }).withMessage('Total bill amount must be positive'),
  body('claimedAmount').isFloat({ min: 0 }).withMessage('Claimed amount must be positive'),
  body('invoiceId').optional().isUUID().withMessage('Invoice ID must be a valid UUID'),
  handleValidationErrors
];

export const updateClaimValidator = [
  param('id').isUUID().withMessage('Valid Claim ID required'),
  body('status').isIn(['submitted', 'under_review', 'approved', 'rejected', 'settled']).withMessage('Invalid claim status'),
  body('approvedAmount').optional().isFloat({ min: 0 }),
  body('rejectionReason').optional().isString().trim(),
  body('settlementDate').optional().isISO8601().toDate(),
  handleValidationErrors
];

export const listClaimsValidator = [
  query('patientId').optional().isUUID(),
  query('status').optional().isString().escape(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];