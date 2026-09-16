import express from "express";
import { DocumentController } from "../controllers/documentController.js";
import {
  registerDocumentValidator,
  listForEntityValidator,
  documentIdValidator,
} from "../validators/documentValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import { requirePlanFeature } from "../utils/saas.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant);
router.use(requirePlanFeature("clinical_media"));

router.post(
  "/", 
  registerDocumentValidator, 
  DocumentController.register);

router.get(
  "/", 
  listForEntityValidator, 
  DocumentController.listForEntity);

// Signed Cloudinary delivery is generated only after authentication and
// tenant/object checks. The list endpoint never creates signed URLs.
router.get(
  "/:id/download",
  documentIdValidator,
  DocumentController.download,
);
  
router.delete(
  "/:id",
  requireRoles("HOSPITAL_ADMIN", "DOCTOR"),
  documentIdValidator,
  DocumentController.remove,
);

export default router;
