import express from "express";
import { DocumentController } from "../controllers/documentController.js";
import {
  registerDocumentValidator,
  listForEntityValidator,
  documentIdValidator,
} from "../validators/documentValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant);
router.post("/", registerDocumentValidator, DocumentController.register);
router.get("/", listForEntityValidator, DocumentController.listForEntity);
router.delete(
  "/:id",
  requireRoles("HOSPITAL_ADMIN", "DOCTOR"),
  documentIdValidator,
  DocumentController.remove,
);

export default router;
