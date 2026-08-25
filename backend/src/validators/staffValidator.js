import { body, validationResult } from 'express-validator';
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

export const inviteStaffValidator = [
  body('name').trim().notEmpty().withMessage('Name is required').escape(),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('roleName').isIn([
    'HOSPITAL_ADMIN', 'RECEPTIONIST', 'NURSE', 'ACCOUNTANT', 
    'CASHIER', 'HR', 'PHARMACIST', 'STORE_MANAGER', 
    'LAB_TECHNICIAN', 'RADIOLOGY_TECHNICIAN'
  ]).withMessage('Invalid or restricted staff role.'),
  handleValidationErrors
];