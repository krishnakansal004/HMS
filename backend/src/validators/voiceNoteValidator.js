import { param, query, validationResult } from "express-validator";
import { HTTP_STATUS } from "../constants/httpStatus.js";

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((err) => ({ field: err.path, message: err.msg })),
    });
  }
  next();
};

export const listVoiceNotesValidator = [
  query("patientId").optional().isUUID().withMessage("Valid patientId is required"),
  handleValidationErrors,
];

export const voiceNoteIdValidator = [
  param("id").isUUID().withMessage("Valid voice note id is required"),
  handleValidationErrors,
];
