import express from 'express'
import { protect } from '../utils/auth.js'
import { loadTenant } from '../utils/saas.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
import {
  verifyAbhaOtp,
  confirmAbhaOtpHandler,
  getConsents,
  createConsent,
  updateConsentStatus,
  syncRecords
} from '../controllers/abdmController.js'

const router = express.Router()

router.post('/verify-abha/otp', protect, loadTenant, verifyAbhaOtp)
router.post('/verify-abha/confirm', protect, loadTenant, confirmAbhaOtpHandler)
router.get('/consents', protect, loadTenant, getConsents)
router.post('/consents', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'manage_abdm'), createConsent)
router.put('/consents/:id/status', protect, loadTenant, updateConsentStatus)
router.post('/sync-records', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin', 'doctor'], 'manage_abdm'), syncRecords)

export default router
