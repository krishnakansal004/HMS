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

export const createPrescriptionValidator = [
  body('patientId').isUUID().withMessage('Valid Patient ID is required'),
  body('appointmentId').optional().isUUID().withMessage('Appointment ID must be a UUID'),
  body('diagnosis').trim().notEmpty().withMessage('Diagnosis is required').escape(),
  body('instructions').optional().trim().escape(),
  
  body('items').isArray({ min: 1 }).withMessage('At least one medicine item is required'),
  body('items.*.medicineName').trim().notEmpty().withMessage('Medicine name is required').escape(),
  body('items.*.dosage').trim().notEmpty().withMessage('Dosage is required').escape(),
  body('items.*.frequency').trim().notEmpty().withMessage('Frequency is required').escape(),
  body('items.*.durationDays').isInt({ min: 1 }).withMessage('Duration in days must be an integer >= 1'),
  body('items.*.instructions').optional().trim().escape(),
  
  handleValidationErrors
];

export const updateApprovalValidator = [
  param('id').isUUID().withMessage('Valid Prescription ID required'),
  body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),
  handleValidationErrors
];

export const listPrescriptionsValidator = [
  query('patientId').optional().isUUID(),
  query('doctorId').optional().isUUID(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];