import express from 'express'
import { protect, admin } from '../utils/auth.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
import tenantMiddleware from '../utils/tenant.js'
import {
  validateAttendanceQuery,
  validateAttendancePayload,
  ensureAttendanceTenantContext,
  ensureAttendanceRecordScope
} from '../middlewares/attendanceMiddleware.js'
import { listAttendance, createAttendance } from '../controllers/attendanceController.js'

const router = express.Router()

router.get('/', protect, tenantMiddleware, validateAttendanceQuery, ensureAttendanceTenantContext, listAttendance)
router.post('/', protect, tenantMiddleware, allowRolesWithSubadminFeature(['admin','director','subadmin'], 'manage_attendance'), validateAttendancePayload, ensureAttendanceTenantContext, createAttendance)

export default router
