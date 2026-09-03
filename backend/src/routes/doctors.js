import express from 'express';
import { DoctorController } from '../controllers/doctorController.js';
import { protect, requireRoles } from '../middlewares/authMiddleware.js';
import { requireTenant } from '../middlewares/tenantMiddleware.js';

const router = express.Router();

// Apply auth and tenant isolation to all doctor routes
router.use(protect);
router.use(requireTenant);

// GET /api/doctors
router.get(
  '/', 
  requireRoles('HOSPITAL_ADMIN', 'DIRECTOR', 'RECEPTIONIST', 'NURSE'), 
  DoctorController.list
);

// POST /api/doctors
router.post(
  '/', 
  requireRoles('HOSPITAL_ADMIN', 'DIRECTOR'), 
  DoctorController.create
);

// PUT /api/doctors/:id
router.put(
  '/:id', 
  requireRoles('HOSPITAL_ADMIN', 'DIRECTOR'), 
  DoctorController.update
);

// DELETE /api/doctors/:id
router.delete(
  '/:id', 
  requireRoles('HOSPITAL_ADMIN', 'DIRECTOR'), 
  DoctorController.remove
);

export default router;