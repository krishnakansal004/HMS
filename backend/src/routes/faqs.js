import express from "express";
import { FaqController } from "../controllers/faqController.js";
import {
  createFaqValidator,
  listFaqValidator,
  deleteFaqValidator,
} from "../validators/faqValidator.js";
import { protect, requireRoles, optionalAuth } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

// Publicly readable FAQ list
router.get(
  "/",
  optionalAuth, 
  listFaqValidator, 
  FaqController.list);

// Protected Management Routes
router.post(
  "/",
  protect,
  requireRoles("HOSPITAL_ADMIN", "DIRECTOR"),
  createFaqValidator,
  FaqController.create,
);
router.delete(
  "/:id",
  protect,
  requireTenant,
  requireRoles("HOSPITAL_ADMIN", "DIRECTOR"),
  deleteFaqValidator,
  FaqController.remove,
);

export default router;
