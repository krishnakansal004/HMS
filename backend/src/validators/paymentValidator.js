import { body, validationResult } from 'express-validator';
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

// Basic shape validation only -- this does NOT substitute for verifying
// the gateway's HMAC signature (see the TODO in paymentService.js). A
// well-formed but unsigned payload still passes this.
export const webhookValidator = [
  body('razorpayOrderId').trim().notEmpty().withMessage('razorpayOrderId is required'),
  body('invoiceId').isUUID().withMessage('Valid invoiceId is required'),
  body('gatewayPaymentId').trim().notEmpty().withMessage('gatewayPaymentId is required'),
  body('amountPaid').isFloat({ gt: 0 }).withMessage('amountPaid must be a positive number'),
  body('signature').trim().notEmpty().withMessage('signature is required'),
  handleValidationErrors
];
