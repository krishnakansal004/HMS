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

export const registerPatientValidator = [
  body('firstName').trim().notEmpty().withMessage('First name is required').escape(),
  body('lastName').optional().trim().escape(),
  body('email').optional().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone').trim().notEmpty().withMessage('Phone number is required').escape(),
  body('dob').isISO8601().toDate().withMessage('Valid Date of Birth is required (YYYY-MM-DD)'),
  body('gender').isIn(['MALE', 'FEMALE', 'OTHER']).withMessage('Valid gender is required'),
  body('bloodGroup').optional().trim().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Invalid blood group'),
  body('address').optional().trim().escape(),
  body('emergencyContact').optional().trim().escape(),
  body('allergies').optional().trim().escape(),
  body('medicalHistory').optional().trim().escape(),
  handleValidationErrors
];

export const updatePatientValidator = [
  param('id').isUUID().withMessage('Valid Patient ID required'),
  body('firstName').optional().trim().notEmpty().escape(),
  body('lastName').optional().trim().escape(),
  body('phone').optional().trim().escape(),
  body('address').optional().trim().escape(),
  body('emergencyContact').optional().trim().escape(),
  body('allergies').optional().trim().escape(),
  body('medicalHistory').optional().trim().escape(),
  body('bloodGroup').optional().trim(),
  handleValidationErrors
];

export const getPatientValidator = [
  param('id').isUUID().withMessage('Valid Patient ID required'),
  handleValidationErrors
];

export const listPatientsValidator = [
  query('search').optional().trim().escape(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];