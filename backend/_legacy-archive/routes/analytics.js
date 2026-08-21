import express from 'express';
import { AnalyticsController } from '../controllers/analyticsController.js';
import { protect, requireRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();
router.get('/dashboard', protect, requireRoles('DIRECTOR', 'HOSPITAL_ADMIN'), AnalyticsController.getStats);
export default router;