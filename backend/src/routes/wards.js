import express from 'express';
import { WardBedController } from '../controllers/wardBedController.js';
import { 
  createWardValidator, 
  createBedValidator, 
  assignBedValidator, 
  bedParamValidator 
} from '../validators/wardBedValidator.js';
import { protect, requireRoles } from '../middlewares/authMiddleware.js';
import { requireTenant } from '../middlewares/tenantMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(requireTenant);

// GET /api/wards
// Who: Hospital Admin, Doctor, Nurse, Receptionist
router.get(
  '/',
  requireRoles('HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'),
  WardBedController.listWards
);

// POST /api/wards
// Who: Hospital Admin
router.post(
  '/',
  requireRoles('HOSPITAL_ADMIN'),
  createWardValidator,
  WardBedController.createWard
);

// POST /api/wards/:wardId/beds
// Who: Hospital Admin
router.post(
  '/:wardId/beds',
  requireRoles('HOSPITAL_ADMIN'),
  createBedValidator,
  WardBedController.addBed
);

// PATCH /api/wards/beds/:bedId/assign
// Who: Hospital Admin, Nurse, Receptionist
router.patch(
  '/beds/:bedId/assign',
  requireRoles('HOSPITAL_ADMIN', 'NURSE', 'RECEPTIONIST'),
  assignBedValidator,
  WardBedController.assignBed
);

// PATCH /api/wards/beds/:bedId/release
// Who: Hospital Admin, Nurse, Receptionist
router.patch(
  '/beds/:bedId/release',
  requireRoles('HOSPITAL_ADMIN', 'NURSE', 'RECEPTIONIST'),
  bedParamValidator,
  WardBedController.releaseBed
);

export default router;