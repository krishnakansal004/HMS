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
  // Core Demographics
  body('firstName').trim().notEmpty().withMessage('First name is required').escape(),
  body('lastName').optional({ checkFalsy: true }).trim().escape(),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone').trim().notEmpty().withMessage('Phone number is required').escape(),
  body('dob').isISO8601().toDate().withMessage('Valid Date of Birth is required (YYYY-MM-DD)'),
  body('gender').isIn(['MALE', 'FEMALE', 'OTHER']).withMessage('Valid gender is required'),
  body('bloodGroup').optional({ checkFalsy: true }).trim().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Invalid blood group'),
  body('address').optional({ checkFalsy: true }).trim().escape(),
  
  // Clinical Fields (From your additions)
  body('emergencyContact').optional({ checkFalsy: true }).trim().escape(),
  body('allergies').optional({ checkFalsy: true }).trim().escape(),
  body('medicalHistory').optional({ checkFalsy: true }).trim().escape(),
  
  // ABDM / ABHA Fields (Strict Production Validation)
  body('abhaId')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9]{2}-?[0-9]{4}-?[0-9]{4}-?[0-9]{4}$/)
    .withMessage('ABHA ID must be a valid 14-digit format (e.g., 12-3456-7890-1234)')
    .escape(),
  body('abhaAddress')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/)
    .withMessage('ABHA Address must be a valid format (e.g., username@abdm)')
    .escape(),
    
  handleValidationErrors
];

export const updatePatientValidator = [
  param('id').isUUID().withMessage('Valid Patient ID required'),
  
  // Core Demographics
  body('firstName').optional().trim().notEmpty().escape(),
  body('lastName').optional({ checkFalsy: true }).trim().escape(),
  body('phone').optional().trim().escape(),
  body('address').optional({ checkFalsy: true }).trim().escape(),
  body('bloodGroup').optional({ checkFalsy: true }).trim().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Invalid blood group'),
  
  // Clinical Fields
  body('emergencyContact').optional({ checkFalsy: true }).trim().escape(),
  body('allergies').optional({ checkFalsy: true }).trim().escape(),
  body('medicalHistory').optional({ checkFalsy: true }).trim().escape(),
  
  // ABDM / ABHA Fields
  body('abhaId')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9]{2}-?[0-9]{4}-?[0-9]{4}-?[0-9]{4}$/)
    .withMessage('ABHA ID must be a valid 14-digit format')
    .escape(),
  body('abhaAddress')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/)
    .withMessage('ABHA Address must be a valid format')
    .escape(),

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

export const invitePatientValidator = [
  param('id').isUUID().withMessage('Valid Patient ID required'),
  handleValidationErrors
];