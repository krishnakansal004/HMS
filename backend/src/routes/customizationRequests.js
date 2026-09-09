import express from "express";
import { CustomizationRequestController } from "../controllers/customizationRequestController.js";
import {
  submitCustomizationRequestValidator,
  updateRequestStatusValidator,
  listRequestsValidator,
} from "../validators/customizationRequestValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { publicFormLimiter } from "../middlewares/rateLimiters.js";

const router = express.Router();

// Public submission -- no auth, the marketing-site "request a custom
// plan" form.
router.post(
  "/",
  publicFormLimiter,
  submitCustomizationRequestValidator,
  CustomizationRequestController.submit,
);

router.use(protect);
router.use(requireTenant);

router.get(
  "/",
  requireRoles("SYSTEM_OWNER", "DIRECTOR"),
  listRequestsValidator,
  CustomizationRequestController.list,
);
router.patch(
  "/:id/status",
  requireRoles("SYSTEM_OWNER", "DIRECTOR"),
  updateRequestStatusValidator,
  CustomizationRequestController.updateStatus,
);

export default router;
