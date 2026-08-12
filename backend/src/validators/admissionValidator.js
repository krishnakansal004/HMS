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

export const admitPatientValidator = [
  body('patientId').isUUID().withMessage('Valid Patient ID required'),
  body('bedId').optional().isUUID().withMessage('Valid Bed ID required'),
  body('admittingDoctorId').optional().isUUID().withMessage('Valid Doctor ID required'),
  body('diagnosis').optional().trim().escape(),
  handleValidationErrors
];

export const updateAdmissionValidator = [
  param('id').isUUID().withMessage('Valid Admission ID required'),
  body('status').isIn(['ADMITTED', 'DISCHARGED', 'TRANSFERRED', 'CANCELLED']).withMessage('Invalid status'),
  body('dischargeDate').optional().isISO8601().toDate(),
  body('dischargeNotes').optional().trim().escape(),
  handleValidationErrors
];

export const listAdmissionsValidator = [
  query('status').optional().trim().escape(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];