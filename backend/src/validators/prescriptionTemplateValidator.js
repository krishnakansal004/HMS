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

export const createTemplateValidator = [
  body('name').trim().escape().notEmpty().withMessage('Template name is required'),
  body('medicines').optional().isArray().withMessage('medicines must be an array'),
  body('tests').optional().isArray().withMessage('tests must be an array'),
  body('html').optional().isString(),
  handleValidationErrors
];

export const updateTemplateValidator = [
  param('id').isUUID(),
  body('name').optional().trim().escape().notEmpty(),
  body('medicines').optional().isArray(),
  body('tests').optional().isArray(),
  body('html').optional().isString(),
  handleValidationErrors
];

export const listTemplatesValidator = [
  query('search').optional().trim().escape(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];

export const templateIdValidator = [
  param('id').isUUID(),
  handleValidationErrors
];
