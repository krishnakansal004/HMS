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


export const initiatePaymentValidator = [
  // Zero-Trust: We only accept the invoice ID. The backend calculates the amount.
  body("invoiceId")
    .isUUID()
    .withMessage("A valid Invoice ID is required."),
  handleValidationErrors,
];

export const webhookValidator = [
  body("invoiceId").isUUID().withMessage("Valid Invoice ID required."),
  body("gatewayPaymentId").notEmpty().isString().withMessage("Gateway Payment ID required."),
  body("razorpayOrderId").notEmpty().isString().withMessage("Razorpay Order ID required."),
  body("amountPaid").isNumeric().withMessage("Amount paid must be a number."),
  body("signature").notEmpty().isString().withMessage("Cryptographic signature required."),
  handleValidationErrors,
];
