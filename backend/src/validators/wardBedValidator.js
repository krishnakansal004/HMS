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

export const createWardValidator = [
  body('name').trim().notEmpty().withMessage('Ward name is required').escape(),
  body('type').trim().notEmpty().withMessage('Ward type is required').escape(),
  body('floor').optional().trim().escape(),
  body('capacity').isInt({ min: 1 }).withMessage('Capacity must be an integer greater than 0'),
  body('pricePerDay').isFloat({ min: 0 }).withMessage('Price per day must be a positive number'),
  handleValidationErrors
];

export const createBedValidator = [
  param('wardId').isUUID().withMessage('Valid Ward ID required'),
  body('bedNumber').trim().notEmpty().withMessage('Bed number is required').escape(),
  body('pricePerDay').optional().isFloat({ min: 0 }),
  handleValidationErrors
];

export const assignBedValidator = [
  param('bedId').isUUID().withMessage('Valid Bed ID required'),
  body('patientId').isUUID().withMessage('Valid Patient ID required'),
  handleValidationErrors
];

export const bedParamValidator = [
  param('bedId').isUUID().withMessage('Valid Bed ID required'),
  handleValidationErrors
];