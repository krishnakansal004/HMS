import { body, param, validationResult } from 'express-validator';
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

export const submitApplicationValidator = [
  body('hospitalSlug').trim().notEmpty().withMessage('Hospital URL slug is required').escape(),
  body('name').trim().escape().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional().trim().escape(),
  body('specialization').trim().escape().notEmpty().withMessage('Specialization is required'),
  body('department').optional().trim().escape(),
  body('education').optional().trim().escape(),
  body('yearsExperience').optional().isInt({ min: 0 }).withMessage('Years of experience must be a positive integer'),
  body('address').optional().trim().escape(),
  body('message').optional().trim().escape(),
  handleValidationErrors
];

export const reviewApplicationValidator = [
  param('id').isUUID().withMessage('Valid Application ID is required'),
  body('status').isIn(['APPROVED', 'REJECTED']).withMessage('Status must be APPROVED or REJECTED'),
  handleValidationErrors
];