import { body, param, validationResult } from 'express-validator';
import { HTTP_STATUS } from '../constants/httpStatus.js';

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((error) => ({ field: error.path, message: error.msg })),
    });
  }
  next();
};

const supplierFields = [
  body('name').trim().isLength({ min: 2, max: 255 }).withMessage('Supplier name must be 2 to 255 characters').escape(),
  body('contactEmail').optional({ values: 'falsy' }).isEmail().normalizeEmail().withMessage('Valid supplier email required'),
  body('contactPhone').optional({ values: 'falsy' }).trim().isLength({ min: 7, max: 20 }).withMessage('Supplier phone must be 7 to 20 characters').escape(),
];

export const createSupplierValidator = [...supplierFields, handleValidationErrors];
export const updateSupplierValidator = [
  param('id').isUUID().withMessage('Valid supplier ID required'),
  ...supplierFields,
  handleValidationErrors,
];
export const supplierIdValidator = [param('id').isUUID().withMessage('Valid supplier ID required'), handleValidationErrors];
