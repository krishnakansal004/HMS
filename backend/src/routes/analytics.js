import express from 'express'
import rateLimit from 'express-rate-limit'
import { protect } from '../utils/auth.js'
import { loadTenant } from '../utils/saas.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
import { getAnalyticsSummary, recompileAnalytics } from '../controllers/analyticsController.js'

const router = express.Router()

const recompileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2,
  message: { error: 'Too many analytics recompilation requests, please wait and try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

router.get('/summary', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'view_reports'), getAnalyticsSummary)
router.post('/recompile', protect, loadTenant, allowRolesWithSubadminFeature(['admin', 'subadmin'], 'view_reports'), recompileLimiter, recompileAnalytics)

export default router
