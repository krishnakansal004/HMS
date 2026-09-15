import express from "express";
import { PlanReceiptController } from "../controllers/planReceiptController.js";
import {
  generateReceiptValidator,
  receiptIdValidator,
  listReceiptsValidator,
} from "../validators/planReceiptValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant);

// Platform-subscription billing artifacts, not patient billing -- same
// SYSTEM_OWNER platform tier as routes/plans.js and the review endpoints
// on routes/planRequests.js. HOSPITAL_ADMIN can view their own tenant's
// receipts (their subscription payment history) but not generate them --
// generation happens as a side effect of a plan-request invoice clearing,
// not something a hospital admin triggers by hand in the normal flow.
router.post(
  "/",
  requireRoles("SYSTEM_OWNER"),
  generateReceiptValidator,
  PlanReceiptController.generate,
);
router.get(
  "/",
  requireRoles("SYSTEM_OWNER", "HOSPITAL_ADMIN"),
  listReceiptsValidator,
  PlanReceiptController.list,
);
router.get(
  "/:id",
  requireRoles("SYSTEM_OWNER", "HOSPITAL_ADMIN"),
  receiptIdValidator,
  PlanReceiptController.getById,
);

export default router;
