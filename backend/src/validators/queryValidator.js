import { body, param, query as queryParam, validationResult } from 'express-validator';
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

export const submitQueryValidator = [
  body('tenantId').optional().isUUID(),
  body('name').trim().escape().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone').optional().trim().escape(),
  body('message').trim().escape().notEmpty().withMessage('Message is required')
    .isLength({ max: 2000 }).withMessage('Message is too long'),
  handleValidationErrors
];

export const updateQueryStatusValidator = [
  param('id').isUUID(),
  body('status').isIn(['NEW', 'PROCESSING', 'SOLVED', 'CLOSED']),
  handleValidationErrors
];

export const listQueriesValidator = [
  queryParam('status').optional().isIn(['NEW', 'PROCESSING', 'SOLVED', 'CLOSED']),
  queryParam('page').optional().isInt({ min: 1 }),
  queryParam('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];
