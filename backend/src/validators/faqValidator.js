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

export const createFaqValidator = [
  body('question').trim().notEmpty().withMessage('Question is required').escape(),
  body('answer').trim().notEmpty().withMessage('Answer is required').escape(),
  body('category').optional().trim().escape(),
  handleValidationErrors
];

export const listFaqValidator = [
  query('category').optional().trim().escape(),
  handleValidationErrors
];

export const deleteFaqValidator = [
  param('id').isUUID().withMessage('Valid FAQ ID required'),
  handleValidationErrors
];