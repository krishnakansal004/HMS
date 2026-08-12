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

export const createExpenseValidator = [
  body('title').trim().notEmpty().withMessage('Expense title is required').escape(),
  body('category').trim().notEmpty().withMessage('Category is required').isIn([
    'SALARY', 'MAINTENANCE', 'UTILITIES', 'EQUIPMENT', 'MEDICINE_PURCHASE', 'MARKETING', 'RENT', 'MISCELLANEOUS'
  ]).withMessage('Invalid expense category'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than zero'),
  body('expenseDate').optional().isISO8601().toDate().withMessage('Valid expense date required (YYYY-MM-DD)'),
  handleValidationErrors
];

export const deleteExpenseValidator = [
  param('id').isUUID().withMessage('Valid Expense ID required'),
  handleValidationErrors
];

export const listExpensesValidator = [
  query('category').optional().trim().escape(),
  query('startDate').optional().isISO8601().toDate(),
  query('endDate').optional().isISO8601().toDate(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];