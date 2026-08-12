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

export const createMedicineValidator = [
  body('supplierId').isUUID().withMessage('Valid Supplier ID is required'),
  body('sku').trim().notEmpty().escape().withMessage('SKU is required'),
  body('name').trim().notEmpty().escape().withMessage('Medicine name is required'),
  body('category').trim().notEmpty().escape().withMessage('Category is required'),
  body('batchNumber').trim().notEmpty().escape().withMessage('Batch number is required'),
  body('expiryDate').isISO8601().toDate().withMessage('Valid expiry date required'),
  body('purchasePrice').isFloat({ min: 0 }).withMessage('Purchase price must be a positive number'),
  body('sellingPrice').isFloat({ min: 0 }).withMessage('Selling price must be a positive number'),
  body('initialStock').optional().isInt({ min: 0 }),
  body('minimumStock').optional().isInt({ min: 0 }),
  handleValidationErrors
];

export const dispenseValidator = [
  param('id').isUUID().withMessage('Valid Medicine ID required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be an integer greater than 0'),
  body('prescriptionId').optional().isUUID().withMessage('If provided, prescription ID must be a valid UUID'),
  body('notes').optional().trim().escape(),
  handleValidationErrors
];

export const receivePurchaseValidator = [
  param('id').isUUID().withMessage('Valid Medicine ID required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be an integer greater than 0'),
  body('purchaseOrderId').optional().isUUID().withMessage('If provided, PO ID must be a valid UUID'),
  body('notes').optional().trim().escape(),
  handleValidationErrors
];

export const listMedicinesValidator = [
  query('search').optional().trim().escape(),
  query('category').optional().trim().escape(),
  query('lowStock').optional().isBoolean(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors
];