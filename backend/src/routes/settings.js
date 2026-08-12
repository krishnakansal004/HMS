import express from 'express';
import { ClinicalSettingsController } from '../controllers/clinicalSettingsController.js';
import { 
  createTemplateValidator, 
  deleteTemplateValidator, 
  updateSettingValidator 
} from '../validators/clinicalSettingsValidator.js';
import { protect, requireRoles } from '../middlewares/authMiddleware.js';
import { requireTenant } from '../middlewares/tenantMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(requireTenant);

// --- PRESCRIPTION TEMPLATES ---

// GET /api/settings/templates
// Who: Hospital Admin, Doctor
router.get(
  '/templates',
  requireRoles('HOSPITAL_ADMIN', 'DOCTOR'),
  ClinicalSettingsController.listTemplates
);

// POST /api/settings/templates
// Who: Only Doctors
router.post(
  '/templates',
  requireRoles('DOCTOR'),
  createTemplateValidator,
  ClinicalSettingsController.createTemplate
);

// DELETE /api/settings/templates/:id
// Who: Only Doctors (creators) or Admins
router.delete(
  '/templates/:id',
  requireRoles('HOSPITAL_ADMIN', 'DOCTOR'),
  deleteTemplateValidator,
  ClinicalSettingsController.removeTemplate
);

// --- HOSPITAL CONFIGURATION SETTINGS ---

// GET /api/settings
// Who: Hospital Admin, Accountant, Receptionist
router.get(
  '/',
  requireRoles('HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST'),
  ClinicalSettingsController.listSettings
);

// PUT /api/settings
// Who: Only Hospital Admin
router.put(
  '/',
  requireRoles('HOSPITAL_ADMIN'),
  updateSettingValidator,
  ClinicalSettingsController.updateSetting
);

export default router;