import express from 'express'
import { uploadAppointments } from '../config/cloudinary.js'
import { protect, doctor as requireDoctor } from '../utils/auth.js'
import tenantMiddleware from '../utils/tenant.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
import {
  validateDoctorAndDateQuery,
  validateBulkCancelPayload,
  validatePatientIdQuery,
  ensureRequestDbForDoctor
} from '../middlewares/appointmentsMiddleware.js'
import {
  listAppointments,
  getMyAppointments,
  getSlotsAndQueue,
  getSlots,
  createAppointment,
  updateAppointment,
  hideAppointment,
  cancelAppointment,
  bulkCancelAppointments,
  getAppointmentsByPatient,
  getDoctorPatients,
  listAppointmentPatients,
  getAppointmentById
} from '../controllers/appointmentsController.js'

const router = express.Router()
const upload = uploadAppointments

router.get('/', protect, tenantMiddleware, allowRolesWithSubadminFeature(['admin', 'director', 'doctor', 'subadmin'], 'view_appointments'), listAppointments)
router.get('/mine', protect, tenantMiddleware, getMyAppointments)
router.get('/slots-and-queue', protect, tenantMiddleware, validateDoctorAndDateQuery, getSlotsAndQueue)
router.get('/slots', validateDoctorAndDateQuery, ensureRequestDbForDoctor, getSlots)
router.post('/', upload.fields([{ name: 'voice', maxCount: 1 }, { name: 'docs', maxCount: 20 }]), createAppointment)
router.patch('/:id', protect, tenantMiddleware, allowRolesWithSubadminFeature(['admin', 'director', 'doctor', 'subadmin'], 'manage_appointments'), updateAppointment)
router.patch('/hide/:id', protect, tenantMiddleware, hideAppointment)
router.delete('/:id', protect, tenantMiddleware, allowRolesWithSubadminFeature(['admin', 'director', 'doctor', 'subadmin'], 'manage_appointments'), cancelAppointment)
router.post('/bulk-cancel', protect, tenantMiddleware, allowRolesWithSubadminFeature(['admin', 'director', 'doctor', 'subadmin'], 'manage_appointments'), validateBulkCancelPayload, bulkCancelAppointments)
router.get('/by-patient', protect, requireDoctor, validatePatientIdQuery, getAppointmentsByPatient)
router.get('/doctor-patients', protect, requireDoctor, getDoctorPatients)
router.get('/patients', protect, tenantMiddleware, allowRolesWithSubadminFeature(['admin', 'director', 'subadmin'], 'view_appointments'), listAppointmentPatients)
router.get('/:id', protect, getAppointmentById)

export default router
