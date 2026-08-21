import express from 'express';
import { AdmissionController } from '../controllers/admissionController.js';
import { admitPatientValidator, updateAdmissionValidator, listAdmissionsValidator } from '../validators/admissionValidator.js';
import { protect, requireRoles } from '../middlewares/authMiddleware.js';
import { requireTenant } from '../middlewares/tenantMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(requireTenant);

// GET /api/admissions
router.get(
    '/',
    requireRoles('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'), 
    listAdmissionsValidator, 
    AdmissionController.list);

// POST /api/admissions
router.post(
    '/',
    requireRoles('HOSPITAL_ADMIN', 'DOCTOR', 'RECEPTIONIST'), 
    admitPatientValidator, 
    AdmissionController.admit);

// PATCH /api/admissions/:id
router.patch(
    '/:id',
    requireRoles('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE'), 
    updateAdmissionValidator, 
    AdmissionController.update);

export default router;