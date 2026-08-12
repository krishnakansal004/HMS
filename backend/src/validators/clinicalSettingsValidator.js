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

export const createTemplateValidator = [
  body('name').trim().notEmpty().withMessage('Template name is required').escape(),
  body('medicines').optional().isArray().withMessage('Medicines must be an array'),
  body('tests').optional().isArray().withMessage('Tests must be an array'),
  body('html').optional().isString().trim(),
  handleValidationErrors
];

export const deleteTemplateValidator = [
  param('id').isUUID().withMessage('Valid Template ID required'),
  handleValidationErrors
];

export const updateSettingValidator = [
  body('key').trim().notEmpty().withMessage('Setting key is required').escape(),
  body('value').notEmpty().withMessage('Setting value is required'),
  body('group').optional().trim().escape(),
  handleValidationErrors
];