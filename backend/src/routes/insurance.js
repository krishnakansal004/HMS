import express from "express";
import { InsuranceController } from "../controllers/insuranceController.js";
import {
  createCompanyValidator,
  submitClaimValidator,
  updateClaimValidator,
  listClaimsValidator,
} from "../validators/insuranceValidator.js";
import { protect, requireRoles } from "../middlewares/authMiddleware.js";
import { requireTenant } from "../middlewares/tenantMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(requireTenant);

// GET /api/insurance/companies
// Who: Hospital Admin, Accountant, Receptionist, Doctor
router.get(
  "/companies",
  requireRoles("HOSPITAL_ADMIN", "ACCOUNTANT", "RECEPTIONIST", "DOCTOR"),
  InsuranceController.listCompanies,
);

// POST /api/insurance/companies
// Who: Hospital Admin, Accountant
router.post(
  "/companies",
  requireRoles("HOSPITAL_ADMIN", "ACCOUNTANT"),
  createCompanyValidator,
  InsuranceController.registerCompany,
);

// GET /api/insurance/claims
// Who: Hospital Admin, Accountant, Receptionist
router.get(
  "/claims",
  requireRoles("HOSPITAL_ADMIN", "ACCOUNTANT", "RECEPTIONIST"),
  listClaimsValidator,
  InsuranceController.listClaims,
);

// POST /api/insurance/claims
// Who: Hospital Admin, Accountant, Receptionist
router.post(
  "/claims",
  requireRoles("HOSPITAL_ADMIN", "ACCOUNTANT", "RECEPTIONIST"),
  submitClaimValidator,
  InsuranceController.submitClaim,
);

// PATCH /api/insurance/claims/:id
// Who: Hospital Admin, Accountant
router.patch(
  "/claims/:id",
  requireRoles("HOSPITAL_ADMIN", "ACCOUNTANT"),
  updateClaimValidator,
  InsuranceController.updateClaim,
);

export default router;
