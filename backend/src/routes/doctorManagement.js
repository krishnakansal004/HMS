import express from 'express';
import { DoctorManagementController } from '../controllers/doctorManagementController.js';
import { protect, requireRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();
router.post('/apply', DoctorManagementController.submitApplication);
router.patch('/applications/:id/review', protect, requireRoles('HOSPITAL_ADMIN'), DoctorManagementController.reviewApplication);
export default router;