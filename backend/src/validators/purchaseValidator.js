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

export const createPurchaseValidator = [
  body('supplierId').isUUID().withMessage('Valid Supplier ID is required'),
  body('orderId').optional().trim().escape(),
  body('orderDate').optional().isISO8601().toDate(),
  body('status').optional().isIn(['pending', 'ordered', 'received', 'completed', 'cancelled']),
  
  body('items').isArray({ min: 1 }).withMessage('At least one purchase item is required'),
  body('items.*.medicineId').isUUID().withMessage('Valid Medicine ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be an integer >= 1'),
  body('items.*.unitCost').isInt({ min: 0, max: 99999999 }).withMessage('Unit cost must be a non-negative minor-currency integer within the current ledger limit'),
  
  handleValidationErrors
];

export const updatePurchaseStatusValidator = [
  param('id').isUUID().withMessage('Valid Purchase Order ID required'),
  body('status').isIn(['pending', 'ordered', 'received', 'completed', 'cancelled']).withMessage('Invalid status'),
  handleValidationErrors
];

export const listPurchasesValidator = [
  query('supplierId').optional().isUUID(),
  query('status').optional().isString().escape(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];