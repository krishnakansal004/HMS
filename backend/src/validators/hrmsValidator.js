import { body, param, validationResult } from 'express-validator';
export const applyLeaveValidator = [
  body('startDate').isISO8601().toDate(),
  body('endDate').isISO8601().toDate(),
  body('reason').trim().escape().notEmpty(),
];
export const reviewLeaveValidator = [
  param('id').isUUID(),
  body('status').isIn(['APPROVED', 'REJECTED'])
];