import express from 'express';
import { HrmsController } from '../controllers/hrmsController.js';
import { applyLeaveValidator, reviewLeaveValidator } from '../validators/hrmsValidator.js';
import { protect, requireRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();
router.use(protect);
router.get('/staff', requireRoles('HR', 'HOSPITAL_ADMIN'), HrmsController.listStaff);
router.post('/leaves', applyLeaveValidator, HrmsController.applyLeave);
router.patch('/leaves/:id/review', requireRoles('HR', 'HOSPITAL_ADMIN'), reviewLeaveValidator, HrmsController.reviewLeave);
export default router;