import express from "express";
import { EmergencyController } from "../controllers/emergencyController.js";
import {
  dispatchAmbulanceValidator,
  scheduleSurgeryValidator,
} from "../validators/emergencyValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant);

router.post(
  "/ambulance/dispatch",
  requireRoles("HOSPITAL_ADMIN", "RECEPTIONIST"),
  dispatchAmbulanceValidator,
  EmergencyController.dispatchAmbulance,
);

router.post(
  "/ot/schedule",
  requireRoles("HOSPITAL_ADMIN", "DOCTOR"),
  scheduleSurgeryValidator,
  EmergencyController.scheduleSurgery,
);

export default router;
