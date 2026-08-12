import express from 'express';
import { PatientController } from '../controllers/patientController.js';
import { 
  registerPatientValidator, 
  updatePatientValidator, 
  getPatientValidator, 
  listPatientsValidator 
} from '../validators/patientValidator.js';
import { protect, requireRoles } from '../middlewares/authMiddleware.js';
import { requireTenant } from '../middlewares/tenantMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(requireTenant);

// POST /api/patients
// Who: Hospital Admin, Receptionist, Doctor, Nurse
router.post(
  '/',
  requireRoles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE'),
  registerPatientValidator,
  PatientController.register
);

// GET /api/patients
// Who: Hospital Admin, Receptionist, Doctor, Nurse
router.get(
  '/',
  requireRoles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE'),
  listPatientsValidator,
  PatientController.list
);

// GET /api/patients/:id
// Who: Hospital Admin, Receptionist, Doctor, Nurse
router.get(
  '/:id',
  requireRoles('HOSPITAL_ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE'),
  getPatientValidator,
  PatientController.getById
);

// PUT /api/patients/:id
// Who: Hospital Admin, Receptionist
router.put(
  '/:id',
  requireRoles('HOSPITAL_ADMIN', 'RECEPTIONIST'),
  updatePatientValidator,
  PatientController.update
);

export default router;