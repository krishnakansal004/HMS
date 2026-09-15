import { body, param, query, validationResult } from "express-validator";

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

export const compensationValidator = [
  param("userId").isUUID(),
  body("monthlyGross").isFloat({ min: 0.01 }),
  body("employmentStartDate").isISO8601(),
  body("employmentEndDate").optional({ values: "falsy" }).isISO8601(),
  handleValidationErrors,
];

export const createPayrollRunValidator = [
  body("month").matches(/^\d{4}-(0[1-9]|1[0-2])$/),
  handleValidationErrors,
];

export const payrollIdValidator = [param("id").isUUID(), handleValidationErrors];
export const payrollItemIdValidator = [param("id").isUUID(), param("itemId").isUUID(), handleValidationErrors];

export const adjustmentValidator = [
  param("id").isUUID(),
  param("itemId").isUUID(),
  body("additions").optional().isFloat({ min: 0 }),
  body("deductions").optional().isFloat({ min: 0 }),
  body("adjustmentNote").optional().isString().trim().isLength({ max: 1000 }),
  handleValidationErrors,
];

export const listPayrollValidator = [
  query("page").optional().isInt({ min: 1 }),
  query("limit").optional().isInt({ min: 1, max: 100 }),
  query("userId").optional().isUUID(),
  handleValidationErrors,
];
