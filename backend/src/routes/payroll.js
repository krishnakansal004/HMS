import express from "express";
import { PayrollController } from "../controllers/payrollController.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";
import {
  adjustmentValidator,
  compensationValidator,
  createPayrollRunValidator,
  listPayrollValidator,
  payrollIdValidator,
  payrollItemIdValidator,
} from "../validators/payrollValidator.js";

const router = express.Router();
router.use(protect, requireTenant);

router.get("/compensation", requireRoles("HOSPITAL_ADMIN", "HR"), PayrollController.listCompensation);
router.put("/compensation/:userId", requireRoles("HOSPITAL_ADMIN"), compensationValidator, PayrollController.setCompensation);

router.post("/runs", requireRoles("HOSPITAL_ADMIN"), createPayrollRunValidator, PayrollController.createRun);
router.get("/runs", requireRoles("HOSPITAL_ADMIN", "HR"), listPayrollValidator, PayrollController.listRuns);
router.get("/runs/:id", requireRoles("HOSPITAL_ADMIN", "HR"), payrollIdValidator, PayrollController.getRun);
router.patch("/runs/:id/items/:itemId", requireRoles("HOSPITAL_ADMIN"), adjustmentValidator, PayrollController.updateAdjustments);
router.post("/runs/:id/freeze", requireRoles("HOSPITAL_ADMIN"), payrollIdValidator, PayrollController.freezeRun);
router.post("/runs/:id/pay/:itemId", requireRoles("HOSPITAL_ADMIN"), payrollItemIdValidator, PayrollController.markPaid);
router.post("/runs/:id/pay-all", requireRoles("HOSPITAL_ADMIN"), payrollIdValidator, PayrollController.markAllPaid);

router.get(
  "/payslips",
  requireRoles("HOSPITAL_ADMIN", "HR", "DIRECTOR", "NURSE", "RECEPTIONIST", "PHARMACIST", "LAB_TECHNICIAN", "RADIOLOGY_TECHNICIAN", "CASHIER"),
  listPayrollValidator,
  PayrollController.listPayslips,
);

export default router;
