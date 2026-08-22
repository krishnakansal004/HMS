import { body, param, query, validationResult } from 'express-validator';

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

export const applyLeaveValidator = [
  body('startDate').isISO8601().toDate(),
  body('endDate').isISO8601().toDate(),
  body('reason').trim().escape().notEmpty(),
  body('targetUserId').optional().isUUID(),
  handleValidationErrors
];

export const reviewLeaveValidator = [
  param('id').isUUID(),
  body('status').isIn(['APPROVED', 'REJECTED']),
  handleValidationErrors
];

// New -- routes/hrms.js needs this for POST /shifts, and nothing enforced
// shift input at all before now.
export const createShiftValidator = [
  body('name').trim().escape().notEmpty().withMessage('Shift name is required'),
  body('startTime').isISO8601().toDate().withMessage('Valid start time is required'),
  body('endTime').isISO8601().toDate().withMessage('Valid end time is required')
    .custom((endTime, { req }) => new Date(endTime) > new Date(req.body.startTime))
    .withMessage('End time must be after start time'),
  handleValidationErrors
];

// New -- routes/hrms.js needs this for GET /staff.
export const listStaffValidator = [
  query('search').optional().trim().escape(),
  query('roleId').optional().isUUID(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];
