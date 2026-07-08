// import express from 'express'
// import bcrypt from 'bcryptjs'
// import jwt from 'jsonwebtoken'
// import Tenant from '../models/Tenant.js'
// import crypto from 'crypto'
// import User from '../models/User.js'
// import Patient from '../models/Patient.js'
// import { protect } from '../utils/auth.js'
// import { sendEmail } from '../utils/notify.js'
// import { passwordResetTemplate } from '../utils/emailTemplates.js'
// import rateLimit from 'express-rate-limit'
// import { body, validationResult } from 'express-validator'
// import { doubleCsrf } from 'csrf-csrf'

// const isProduction = process.env.NODE_ENV === 'production'
// // Dynamically determine secure/sameSite
// const cookieSameSite = process.env.COOKIE_SAME_SITE || 'none'
// const cookieSecure = process.env.COOKIE_SECURE === 'true' || true

// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 10, // Limit each IP to 10 requests per windowMs
//   message: { error: 'Too many attempts. Please try again later.' },
//   standardHeaders: true,
//   legacyHeaders: false,
// })

// const router = express.Router()

// const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
//   getSecret: () => process.env.CSRF_SECRET || 'fallback-secret-for-csrf-protection-which-should-be-random',
//   cookieName: '_csrf',
//   cookieOptions: {
//     sameSite: cookieSameSite,
//     secure: cookieSecure,
//     path: '/',
//     httpOnly: true,
//   },
//   getTokenFromRequest: (req) => req.headers['x-csrf-token']
// })

// // Custom CSRF Protection for sensitive cookie-based endpoints
// export const requireCsrf = (req, res, next) => {
//   doubleCsrfProtection(req, res, (err) => {
//     if (err) {
//       console.warn('[auth] CSRF token mismatch or missing:', err)
//       return res.status(403).json({ error: 'CSRF token mismatch' })
//     }
//     next()
//   })
// }

// // CSRF Token Generation Endpoint
// router.get('/csrf', (req, res) => {
//   const token = generateCsrfToken(req, res)
//   res.json({ csrfToken: token })
// })

// // DEBUG endpoint removed

// const setRefreshCookie = (res, token) => {
//   const expiryStr = process.env.REFRESH_TOKEN_EXPIRY || '7d'
//   let maxAge = 7 * 24 * 60 * 60 * 1000 // default 7 days

//   // Simple parsing for 'd' (days), 'h' (hours), 'm' (minutes), 's' (seconds)
//   if (expiryStr.endsWith('d')) maxAge = parseInt(expiryStr) * 24 * 60 * 60 * 1000
//   else if (expiryStr.endsWith('h')) maxAge = parseInt(expiryStr) * 60 * 60 * 1000
//   else if (expiryStr.endsWith('m')) maxAge = parseInt(expiryStr) * 60 * 1000
//   else if (expiryStr.endsWith('s')) maxAge = parseInt(expiryStr) * 1000
//   else if (!isNaN(expiryStr)) maxAge = parseInt(expiryStr)

//   // Determine if we should use secure/none cookies (required for cross-site Vercel->Render)
//   // Default to true unless explicitly in development mode without overrides
//   const isProduction = process.env.NODE_ENV === 'production'
//   // Browsers require Secure: true only if SameSite is None.
//   // ALLOW OVERRIDES for specific deployment scenarios
//   const cookieSameSite = process.env.COOKIE_SAME_SITE || 'none'
//   const cookieSecure = process.env.COOKIE_SECURE === 'true' || true

//   res.cookie('refreshToken', token, {
//     httpOnly: true,
//     secure: cookieSecure,
//     sameSite: cookieSameSite,
//     maxAge: maxAge,
//     path: '/'
//   })
// }

// const clearRefreshCookie = (res) => {
//   const isProduction = process.env.NODE_ENV === 'production'
//   const cookieSameSite = process.env.COOKIE_SAME_SITE || 'none'
//   const cookieSecure = process.env.COOKIE_SECURE === 'true' || true

//   res.clearCookie('refreshToken', {
//     httpOnly: true,
//     secure: cookieSecure,
//     sameSite: cookieSameSite,
//     path: '/'
//   })
// }

// // Register
// router.post('/register', authLimiter, [
//   body('name').trim().notEmpty().escape().withMessage('Name is required'),
//   body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
//   body('password')
//     .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
//     .matches(/[A-Za-z]/).withMessage('Password must contain at least one letter')
//     .matches(/[0-9]/).withMessage('Password must contain at least one number'),
//   body('hospitalSlug').optional().trim().escape()
// ], async (req, res) => {
//   try {
//     const errors = validationResult(req)
//     if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

//     const { name, email, password, hospitalSlug } = req.body
//     const existing = await User.findOne({ email })
//     if (existing) return res.status(409).json({ error: 'Email already registered' })

//     // If registering via a specific hospital portal, user belongs to that tenant
//     let tenantId = undefined
//     if (hospitalSlug) {
//       const tenant = await Tenant.findOne({ slug: hospitalSlug })
//       if (!tenant) return res.status(404).json({ error: 'Hospital not found' })
//       tenantId = tenant._id
//     }

//     // Prevent elevation to admin via public registration
//     const finalRole = 'patient'
//     const passwordHash = await bcrypt.hash(password, 10)
//     const sessionId = crypto.randomUUID()

//     // Create user with tenant association
//     const user = await User.create({ name, email, username: email, passwordHash, role: finalRole, sessionId, tenantId })

//     // Auto-create Patient record for self-registered users so they appear in lists
//     try {
//       const nameParts = (name || '').trim().split(/\s+/)
//       const firstName = nameParts[0]
//       const lastName = nameParts.slice(1).join(' ')
//       await req.db(Patient).create({
//         firstName,
//         lastName,
//         email: email.toLowerCase(),
//         user: user._id,
//         tenantId: user.tenantId,
//         // No createdBy implies self-registration
//       })
//     } catch (e) {
//       console.warn('Failed to auto-create patient record during registration', e)
//     }

//     // Augment returned user with patient avatar if a Patient record exists
//     const safe = user.toSafeJSON()
//     try {
//       const patient = await req.db(Patient).findOne({ email: user.email }).select('avatarUrl')
//       if (patient && patient.avatarUrl) safe.avatarUrl = patient.avatarUrl
//     } catch (e) { }
//     // include tenantId/role/plan in token where applicable
//     let tenant = null
//     if (user.tenantId) tenant = await Tenant.findById(user.tenantId).populate('plan')
//     if (tenant && tenant.plan) {
//       safe.tenantPlan = {
//         name: tenant.plan.name,
//         roleFeatures: tenant.plan.roleFeatures,
//         limits: tenant.plan.limits
//       }
//     }
//     const tokenPayload = { sub: user._id, sid: sessionId, role: user.role }
//     if (tenant) tokenPayload.tenantId = String(tenant._id)
//     if (tenant && tenant.plan) tokenPayload.plan = String(tenant.plan._id)
//     const accessSecret = process.env.ACCESS_TOKEN_SECRET
//     const refreshSecret = process.env.REFRESH_TOKEN_SECRET

//     if (!accessSecret || !refreshSecret) {
//       throw new Error('JWT secrets are not properly configured')
//     }

//     const accessExpiry = process.env.ACCESS_TOKEN_EXPIRY || '1d'
//     const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d'

//     const accessToken = jwt.sign({ ...tokenPayload, type: 'access' }, accessSecret, { expiresIn: accessExpiry })
//     const refreshToken = jwt.sign({ ...tokenPayload, type: 'refresh' }, refreshSecret, { expiresIn: refreshExpiry })

//     setRefreshCookie(res, refreshToken)
//     res.status(201).json({ token: accessToken, user: safe })
//   } catch (err) {
//     console.error(err)
//     res.status(500).json({ error: 'Server error' })
//   }
// })

// // Login
// router.post('/login', authLimiter, [
//   body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
//   body('password').notEmpty().withMessage('Password required'),
//   body('hospitalSlug').optional().trim().escape()
// ], async (req, res) => {
//   try {
//     const errors = validationResult(req)
//     if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

//     const { email, password, hospitalSlug } = req.body

//     let user = await User.findOne({ email })
//     if (!user) return res.status(401).json({ error: 'Invalid credentials' })

//     // SaaS Tenant Validation
//     let currentTenant = null
//     if (hospitalSlug) {
//       currentTenant = await Tenant.findOne({ slug: hospitalSlug })
//       if (!currentTenant) return res.status(404).json({ error: 'Hospital not found' })

//       // Directors should not login via tenant portals
//       if (user.role === 'director') {
//         return res.status(403).json({ error: 'Directors must login via the main director portal.' })
//       }

//       // User MUST have a tenantId and it MUST match the current tenant
//       if (!user.tenantId || user.tenantId.toString() !== currentTenant._id.toString()) {
//         return res.status(403).json({ error: 'Access denied: You are not a registered user of this hospital.' })
//       }
//     } else {
//       // Global Login (no hospitalSlug)
//       // STRICT: ONLY Director can login globally
//       if (user.role !== 'director') {
//         return res.status(403).json({
//           error: 'Please login via your specific hospital portal URL.',
//           requiresPortal: true // Flag for frontend to show helpful message
//         })
//       }
//     }

//     const ok = await bcrypt.compare(password, user.passwordHash)

//     if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
//     // Invalidate previous sessions by overwriting sessionId
//     user.sessionId = crypto.randomUUID()
//     await user.save()
//     const safe = user.toSafeJSON()

//     try {
//       const patient = await req.db(Patient).findOne({ email: user.email }).select('avatarUrl')
//       if (patient && patient.avatarUrl) safe.avatarUrl = patient.avatarUrl
//     } catch (e) { }
//     safe.mustChangePassword = user.mustChangePassword || false

//     let tenant = null
//     if (user.tenantId) tenant = await Tenant.findById(user.tenantId).populate('plan')

//     if (tenant) {
//       safe.tenantSlug = tenant.slug
//     }

//     if (tenant && tenant.plan) {
//       safe.tenantPlan = {
//         name: tenant.plan.name,
//         slug: tenant.slug, // Include slug in response
//         roleFeatures: tenant.plan.roleFeatures,
//         limits: tenant.plan.limits
//       }
//     }
//     const tokenPayload = { sub: user._id, sid: user.sessionId, role: user.role }
//     if (tenant) tokenPayload.tenantId = String(tenant._id)
//     if (tenant && tenant.plan) tokenPayload.plan = String(tenant.plan._id)
//     const accessSecret = process.env.ACCESS_TOKEN_SECRET
//     const refreshSecret = process.env.REFRESH_TOKEN_SECRET

//     if (!accessSecret || !refreshSecret) {
//       throw new Error('JWT secrets are not properly configured')
//     }
//     const accessExpiry = process.env.ACCESS_TOKEN_EXPIRY || '1d'
//     const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d'

//     const accessToken = jwt.sign({ ...tokenPayload, type: 'access' }, accessSecret, { expiresIn: accessExpiry })
//     const refreshToken = jwt.sign({ ...tokenPayload, type: 'refresh' }, refreshSecret, { expiresIn: refreshExpiry })
//     setRefreshCookie(res, refreshToken)
//     res.json({ token: accessToken, user: safe })
//   } catch (err) {
//     console.error(err)
//     res.status(500).json({ error: 'Server error' })
//   }
// })

// // Forgot password - initiate reset
// router.post('/forgot-password', authLimiter, [
//   body('email').isEmail().normalizeEmail().withMessage('Valid email required')
// ], async (req, res) => {
//   try {
//     const errors = validationResult(req)
//     if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

//     const { email } = req.body
//     const user = await User.findOne({ email })
//     // Always respond ok to avoid email enumeration; only proceed if user exists
//     if (user) {
//       const rawToken = crypto.randomBytes(32).toString('hex')
//       const hashed = crypto.createHash('sha256').update(rawToken).digest('hex')
//       user.passwordResetToken = hashed
//       user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
//       await user.save()
//       // Use FRONTEND_URL for production, fallback to COMPANY_PORTAL_URL or localhost for dev
//       const base = process.env.FRONTEND_URL || process.env.COMPANY_PORTAL_URL || 'http://localhost:5173'
//       const resetUrl = `${base}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`
//       const { html, attachments } = passwordResetTemplate(user, resetUrl)
//       await sendEmail(email, 'Password Reset Instructions', html, { attachments })
//     }
//     res.json({ ok: true })
//   } catch (err) {
//     console.error(err)
//     res.status(500).json({ error: 'Server error' })
//   }
// })

// // Reset password - consume token
// router.post('/reset-password', authLimiter, [
//   body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
//   body('token').notEmpty().withMessage('Token required'),
//   body('password')
//     .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
//     .matches(/[A-Za-z]/).withMessage('Password must contain at least one letter')
//     .matches(/[0-9]/).withMessage('Password must contain at least one number')
// ], async (req, res) => {
//   try {
//     const errors = validationResult(req)
//     if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

//     const { email, token, password } = req.body
//     const user = await User.findOne({ email })
//     if (!user || !user.passwordResetToken || !user.passwordResetExpires) {
//       return res.status(400).json({ error: 'Invalid or expired token' })
//     }
//     if (user.passwordResetExpires.getTime() < Date.now()) {
//       return res.status(400).json({ error: 'Invalid or expired token' })
//     }
//     const hashed = crypto.createHash('sha256').update(token).digest('hex')
//     if (hashed !== user.passwordResetToken) {
//       return res.status(400).json({ error: 'Invalid or expired token' })
//     }
//     // Update password
//     user.passwordHash = await bcrypt.hash(password, 10)
//     user.passwordResetToken = undefined
//     user.passwordResetExpires = undefined
//     // Invalidate existing sessions
//     user.sessionId = crypto.randomUUID()
//     await user.save()

//     clearRefreshCookie(res)
//     res.json({ ok: true, message: 'Password reset successful. Please log in.' })
//   } catch (err) {
//     console.error(err)
//     res.status(500).json({ error: 'Server error' })
//   }
// })

// // Me
// router.get('/me', protect, async (req, res) => {
//   const user = await User.findById(req.userId)
//   if (!user) return res.status(404).json({ error: 'User not found' })
//   const safe = user.toSafeJSON()
//   try {
//     const patient = await req.db(Patient).findOne({ email: user.email }).select('avatarUrl')
//     if (patient && patient.avatarUrl) safe.avatarUrl = patient.avatarUrl
//   } catch (e) { }
//   // include locale preference if present
//   if (user.locale) safe.locale = user.locale
//   // include tenantId and mustChangePassword for client to act on first-login flows
//   safe.tenantId = user.tenantId
//   if (user.tenantId) {
//     try {
//       const tenant = await Tenant.findById(user.tenantId).populate('plan')
//       if (tenant) {
//         safe.tenantSlug = tenant.slug // Add slug for frontend routing
//         if (tenant.plan) {
//           safe.tenantPlan = {
//             name: tenant.plan.name,
//             roleFeatures: tenant.plan.roleFeatures,
//             limits: tenant.plan.limits
//           }
//         }
//       }
//     } catch (e) { /* ignore */ }
//   }
//   safe.mustChangePassword = user.mustChangePassword || false
//   res.json({ user: safe })
// })

// // Update own profile (allow updating locale preference)
// router.put('/me', protect, async (req, res) => {
//   try {
//     const user = await User.findById(req.userId)
//     if (!user) return res.status(404).json({ error: 'User not found' })
//     const { locale } = req.body || {}
//     if (locale && ['en', 'hi'].includes(locale)) user.locale = locale
//     await user.save()
//     const safe = user.toSafeJSON()
//     try {
//       const patient = await req.db(Patient).findOne({ email: user.email }).select('avatarUrl')
//       if (patient && patient.avatarUrl) safe.avatarUrl = patient.avatarUrl
//     } catch (e) { }
//     if (user.locale) safe.locale = user.locale
//     res.json({ user: safe })
//   } catch (e) {
//     console.error(e)
//     res.status(500).json({ error: 'Server error' })
//   }
// })

// // Change password (authenticated)
// router.put('/change-password', protect, [
//   body('currentPassword').notEmpty().withMessage('Current password is required'),
//   body('newPassword')
//     .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
//     .matches(/[A-Za-z]/).withMessage('Password must contain at least one letter')
//     .matches(/[0-9]/).withMessage('Password must contain at least one number')
// ], async (req, res) => {
//   try {
//     const errors = validationResult(req)
//     if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

//     const { currentPassword, newPassword } = req.body

//     const user = await User.findById(req.userId)
//     if (!user) return res.status(404).json({ error: 'User not found' })

//     const ok = await bcrypt.compare(currentPassword, user.passwordHash)
//     if (!ok) return res.status(401).json({ error: 'Invalid current password' })

//     user.passwordHash = await bcrypt.hash(newPassword, 10)
//     user.mustChangePassword = false
//     // Rotate sessionId to logout other devices securely
//     user.sessionId = crypto.randomUUID()
//     await user.save()

//     res.json({ ok: true, message: 'Password updated successfully' })
//   } catch (e) {
//     console.error(e)
//     res.status(500).json({ error: 'Server error' })
//   }
// })

// // Logout (invalidate current session)
// router.post('/logout', async (req, res) => {
//   try {
//     const authHeader = req.headers.authorization || ''
//     const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
//     let userId = null

//     if (token) {
//       try {
//         const accessSecret = process.env.ACCESS_TOKEN_SECRET
//         if (!accessSecret) throw new Error('ACCESS_TOKEN_SECRET is not configured')
//         const payload = jwt.verify(token, accessSecret)
//         if (payload && payload.sub) {
//           userId = payload.sub
//         }
//       } catch (e) { /* ignore verification error, still clear cookie */ }
//     }

//     if (userId) {
//       const user = await User.findById(userId)
//       if (user) {
//         user.sessionId = crypto.randomUUID()
//         await user.save()
//       }
//     }
//     clearRefreshCookie(res)
//     res.json({ ok: true })
//   } catch (e) {
//     console.error(e)
//     res.status(500).json({ error: 'Server error' })
//   }
// })

// // Refresh Token (Protected by CSRF Double-Submit)
// router.post('/refresh-token', authLimiter, requireCsrf, async (req, res) => {
//   try {
//     const refreshToken = req.cookies.refreshToken
//     if (!refreshToken) {
//       console.warn('[auth] Refresh attempt with no cookie')
//       return res.status(401).json({ error: 'No refresh token' })
//     }

//     const refreshSecret = process.env.REFRESH_TOKEN_SECRET

//     if (!refreshSecret) {
//       return res.status(500).json({ error: 'JWT secrets are not properly configured' })
//     }
//     let payload
//     try {
//       payload = jwt.verify(refreshToken, refreshSecret)
//     } catch (ve) {
//       console.error('[auth] Refresh token verification failed:', ve.message)
//       clearRefreshCookie(res)
//       return res.status(401).json({ error: 'Invalid token' })
//     }

//     if (payload.type !== 'refresh') {
//       console.warn('[auth] Refresh attempt with non-refresh token')
//       return res.status(401).json({ error: 'Invalid token type' })
//     }

//     const user = await User.findById(payload.sub)

//     if (!user) {
//       console.warn('[auth] Refresh attempt: user not found', payload.sub)
//       return res.status(401).json({ error: 'User not found' })
//     }

//     if (user.sessionId && payload.sid !== user.sessionId) {
//       console.warn('[auth] Refresh attempt: session ID mismatch', { tokenSid: payload.sid, userSid: user.sessionId })
//       return res.status(401).json({ error: 'Session invalidated' })
//     }

//     // Check tenant status if applicable
//     if (user.tenantId) {
//       const tenant = await Tenant.findById(user.tenantId)
//       if (tenant && tenant.status !== 'active') return res.status(403).json({ error: 'Tenant suspended' })
//     }

//     // Issue new access token
//     const tokenPayload = {
//       sub: user._id,
//       sid: user.sessionId,
//       role: user.role,
//       tenantId: user.tenantId ? String(user.tenantId) : undefined,
//     }

//     const safe = user.toSafeJSON()
//     try {
//       const patient = await req.db(Patient).findOne({ email: user.email }).select('avatarUrl')
//       if (patient && patient.avatarUrl) safe.avatarUrl = patient.avatarUrl
//     } catch (e) { }

//     // Re-populate plan info if needed, or just include minimal info
//     // For simplicity, we trust the DB state for the new access token
//     if (user.tenantId) {
//       const tenant = await Tenant.findById(user.tenantId).populate('plan')
//       if (tenant) {
//         safe.tenantSlug = tenant.slug
//         if (tenant.plan) {
//           tokenPayload.plan = String(tenant.plan._id)
//           safe.tenantPlan = {
//             name: tenant.plan.name,
//             slug: tenant.slug,
//             roleFeatures: tenant.plan.roleFeatures,
//             limits: tenant.plan.limits
//           }
//         }
//       }
//     }

//     const accessSecret = process.env.ACCESS_TOKEN_SECRET

//     if (!accessSecret || !refreshSecret) {
//       return res.status(500).json({ error: 'JWT secrets are not properly configured' })
//     }

//     const accessExpiry = process.env.ACCESS_TOKEN_EXPIRY || '1d'
//     const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d'

//     const newAccessToken = jwt.sign({ ...tokenPayload, type: 'access' }, accessSecret, { expiresIn: accessExpiry })
//     const newRefreshToken = jwt.sign({ ...tokenPayload, type: 'refresh' }, refreshSecret, { expiresIn: refreshExpiry })

//     // Rotate refresh token securely
//     setRefreshCookie(res, newRefreshToken)
//     res.json({ token: newAccessToken, user: safe })
//   } catch (e) {
//     if (e.name === 'TokenExpiredError') {
//       clearRefreshCookie(res)
//       return res.status(401).json({ error: 'Refresh token expired' })
//     }
//     console.error('Refresh token error', e)
//     res.status(401).json({ error: 'Invalid refresh token' })
//   }
// })

// export default router




import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import Tenant from '../models/Tenant.js'
import crypto from 'crypto'
import User from '../models/User.js'
import Patient from '../models/Patient.js'
import { protect } from '../utils/auth.js'
import { sendEmail } from '../utils/notify.js'
import { buildPublicFrontendUrl } from '../utils/publicUrl.js'
import { passwordResetTemplate } from '../utils/emailTemplates.js'
import rateLimit from 'express-rate-limit'
import { body, validationResult } from 'express-validator'

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Limit each IP to 10000 requests per windowMs to remove safety constraint during development
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Disable the trust-proxy validation check introduced in v7/v8.
  // Render sets X-Forwarded-For correctly (app.set('trust proxy', 1) in app.js),
  // but the validator can throw ERR_ERL_PERMISSIVE_TRUST_PROXY on first request.
  validate: { trustProxy: false, xForwardedForHeader: false },
})

const router = express.Router()

const normalizeEmailInput = (value) => String(value || '').trim().toLowerCase()

function emailLookupCandidates(inputEmail) {
  const email = normalizeEmailInput(inputEmail)
  if (!email || !email.includes('@')) return email ? [email] : []
  const [localRaw, domainRaw] = email.split('@')
  const local = String(localRaw || '').trim()
  const domain = String(domainRaw || '').trim()
  const out = [email]

  // Support mixed legacy storage styles for Gmail aliases.
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const localNoPlus = local.split('+')[0]
    const localNoDots = localNoPlus.replace(/\./g, '')
    const variants = [
      `${localNoPlus}@gmail.com`,
      `${localNoDots}@gmail.com`,
      `${localNoPlus}@googlemail.com`,
      `${localNoDots}@googlemail.com`
    ]
    for (const v of variants) {
      if (!out.includes(v)) out.push(v)
    }
  }
  return out
}

async function findUserByEmailFlexible(inputEmail, tenantId = null) {
  const candidates = emailLookupCandidates(inputEmail)
  
  // If tenantId is provided, try to find a user in that tenant first
  if (tenantId) {
    const tenantUsers = await User.find({ email: { $in: candidates }, tenantId })
    
    // First try to find an admin in this tenant (highest priority)
    for (const candidate of candidates) {
      const user = tenantUsers.find(u => u.email === candidate && u.role === 'admin')
      if (user) return { user, matchedEmail: candidate, candidates }
    }
    // Then try any user in this tenant
    for (const candidate of candidates) {
      const user = tenantUsers.find(u => u.email === candidate)
      if (user) return { user, matchedEmail: candidate, candidates }
    }
  }

  // Fallback to global search (for directors, or users without tenant)
  const globalUsers = await User.find({ email: { $in: candidates } })
  for (const candidate of candidates) {
    const user = globalUsers.find(u => u.email === candidate)
    if (user) return { user, matchedEmail: candidate, candidates }
  }
  return { user: null, matchedEmail: null, candidates }
}

// Custom CSRF Protection for sensitive cookie-based endpoints
export const requireCsrf = (req, res, next) => {
  const cookieToken = req.cookies?._csrf
  const headerToken = req.headers['x-csrf-token']

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    console.warn('[auth] CSRF token mismatch or missing. Cookie:', !!cookieToken, 'Header:', !!headerToken)
    return res.status(403).json({ error: 'CSRF token mismatch' })
  }
  next()
}

// CSRF Token Generation Endpoint
router.get('/csrf', (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === 'production'
    const cookieSameSite = process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax')
    const cookieSecure = process.env.COOKIE_SECURE === 'true' || (isProduction && cookieSameSite === 'none')

    const token = crypto.randomBytes(32).toString('hex')
    res.cookie('_csrf', token, {
      httpOnly: false, // JavaScript must be able to read this for double-submit pattern
      secure: cookieSecure,
      sameSite: cookieSameSite,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    })
    res.json({ csrfToken: token })
  } catch (err) {
    console.error('[auth] /csrf route error:', err)
    // Return a token anyway so the frontend can proceed (graceful degradation)
    res.status(500).json({ error: 'Failed to generate CSRF token', csrfToken: null })
  }
})

// DEBUG endpoint removed

const setRefreshCookie = (res, token) => {
  const expiryStr = process.env.REFRESH_TOKEN_EXPIRY || '7d'
  let maxAge = 7 * 24 * 60 * 60 * 1000 // default 7 days

  // Simple parsing for 'd' (days), 'h' (hours), 'm' (minutes), 's' (seconds)
  if (expiryStr.endsWith('d')) maxAge = parseInt(expiryStr) * 24 * 60 * 60 * 1000
  else if (expiryStr.endsWith('h')) maxAge = parseInt(expiryStr) * 60 * 60 * 1000
  else if (expiryStr.endsWith('m')) maxAge = parseInt(expiryStr) * 60 * 1000
  else if (expiryStr.endsWith('s')) maxAge = parseInt(expiryStr) * 1000
  else if (!isNaN(expiryStr)) maxAge = parseInt(expiryStr)

  // Determine if we should use secure/none cookies (required for cross-site Vercel->Render)
  // Default to true unless explicitly in development mode without overrides
  const isProduction = process.env.NODE_ENV === 'production'
  // Browsers require Secure: true only if SameSite is None.
  // ALLOW OVERRIDES for specific deployment scenarios
  const cookieSameSite = process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax')
  const cookieSecure = process.env.COOKIE_SECURE === 'true' || (isProduction && cookieSameSite === 'none')

  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    maxAge: maxAge,
    path: '/'
  })
}

const clearRefreshCookie = (res) => {
  const isProduction = process.env.NODE_ENV === 'production'
  const cookieSameSite = process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax')
  const cookieSecure = process.env.COOKIE_SECURE === 'true' || (isProduction && cookieSameSite === 'none')

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: '/'
  })
}

// Register
router.post('/register', authLimiter, [
  body('name').trim().notEmpty().escape().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required').bail().customSanitizer(normalizeEmailInput),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Za-z]/).withMessage('Password must contain at least one letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('hospitalSlug').optional().trim().escape()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

    const { name, email, password, hospitalSlug } = req.body
    // If registering via a specific hospital portal, user belongs to that tenant
    let tenantId = undefined
    if (hospitalSlug) {
      const tenant = await Tenant.findOne({ slug: hospitalSlug })
      if (!tenant) return res.status(404).json({ error: 'Hospital not found' })
      tenantId = tenant._id

      // Check Plan Limits for Patients
      try {
        const Plan = (await import('../models/Plan.js')).default
        if (tenant.plan) {
          const planDoc = await Plan.findById(String(tenant.plan))
          if (planDoc && planDoc.limits && typeof planDoc.limits.patients !== 'undefined') {
            const currentPatients = await User.countDocuments({ tenantId: tenant._id, role: 'patient' })
            if (currentPatients >= Number(planDoc.limits.patients)) {
              return res.status(403).json({ error: 'Patient limit reached for this hospital. Please contact the administrator.' })
            }
          }
        }
      } catch (e) {
        console.warn('[auth] registration limit check failed', e.message)
      }
    }

    const { user: existing } = await findUserByEmailFlexible(email, tenantId)
    
    // Prevent elevation to admin via public registration
    const finalRole = 'patient'
    
    // Only block if an ADMIN exists with this email, or if a user with the SAME ROLE already exists in the SAME TENANT
    if (existing) {
      if (existing.role === 'admin') {
        return res.status(409).json({ error: 'This email is already registered as an administrator.' })
      }
      if (existing.role === finalRole && String(existing.tenantId) === String(tenantId)) {
        return res.status(409).json({ error: `You are already registered as a ${finalRole} here.` })
      }
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const sessionId = crypto.randomUUID()

    // Create user with tenant association
    const user = await User.create({ name, email, username: email, passwordHash, role: finalRole, sessionId, tenantId })
    req.tenantId = user.tenantId

    // Auto-create Patient record for self-registered users so they appear in lists
    try {
      const nameParts = (name || '').trim().split(/\s+/)
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ')
      await req.db(Patient).create({
        firstName,
        lastName,
        email: email.toLowerCase(),
        user: user._id,
        tenantId: user.tenantId,
        // No createdBy implies self-registration
      })
    } catch (e) {
      console.warn('Failed to auto-create patient record during registration', e)
    }

    // Augment returned user with patient avatar if a Patient record exists
    const safe = user.toSafeJSON()
    try {
      const patient = await req.db(Patient).findOne({ email: user.email }).select('avatarUrl')
      if (patient && patient.avatarUrl) safe.avatarUrl = patient.avatarUrl
    } catch (e) { }
    // include tenantId/role/plan in token where applicable
    let tenant = null
    if (user.tenantId) tenant = await Tenant.findById(user.tenantId).populate('plan')
    if (tenant && tenant.plan) {
      safe.tenantPlan = {
        name: tenant.plan.name,
        roleFeatures: tenant.plan.roleFeatures,
        limits: tenant.plan.limits
      }
    }
    const tokenPayload = { sub: user._id, sid: sessionId, role: user.role }
    if (tenant) tokenPayload.tenantId = String(tenant._id)
    if (tenant && tenant.plan) tokenPayload.plan = String(tenant.plan._id)
    const accessSecret = process.env.ACCESS_TOKEN_SECRET
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET

    if (!accessSecret || !refreshSecret) {
      throw new Error('JWT secrets are not properly configured')
    }

    const accessExpiry = process.env.ACCESS_TOKEN_EXPIRY || '1d'
    const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d'

    const accessToken = jwt.sign({ ...tokenPayload, type: 'access' }, accessSecret, { expiresIn: accessExpiry })
    const refreshToken = jwt.sign({ ...tokenPayload, type: 'refresh' }, refreshSecret, { expiresIn: refreshExpiry })

    setRefreshCookie(res, refreshToken)
    res.status(201).json({ token: accessToken, user: safe })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Login
router.post('/login', authLimiter, [
  body('email').trim().isEmail().withMessage('Valid email required').bail().customSanitizer(normalizeEmailInput),
  body('password').notEmpty().withMessage('Password required'),
  body('hospitalSlug').optional().trim().escape()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

    const { email, password, hospitalSlug } = req.body

    let currentTenant = null
    if (hospitalSlug) {
      currentTenant = await Tenant.findOne({ slug: hospitalSlug }).populate('plan')
      if (!currentTenant) return res.status(404).json({ error: 'Hospital not found' })
    }

    const lookup = await findUserByEmailFlexible(email, currentTenant?._id)
    let user = lookup.user
    if (!user) {
      console.log('[auth] login failed: user not found', { email, candidatesTried: lookup.candidates })
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    req.tenantId = user.tenantId

    if (user.blocked) {
      console.log('[auth] login failed: user is blocked', { email: user.email })
      return res.status(403).json({ error: 'Your account has been blocked. Please contact support.' })
    }

    console.log('[auth] login attempt', { email, role: user.role, hasPasswordHash: !!user.passwordHash, tenantId: user.tenantId })

    // SaaS Tenant Validation
    if (hospitalSlug) {
      if (!currentTenant) {
        currentTenant = await Tenant.findOne({ slug: hospitalSlug }).populate('plan')
        if (!currentTenant) return res.status(404).json({ error: 'Hospital not found' })
      }

      // Directors should not login via tenant portals
      if (user.role === 'director') {
        return res.status(403).json({ error: 'Directors must login via the main director portal.' })
      }

      // User MUST have a tenantId and it MUST match the current tenant
      if (!user.tenantId || user.tenantId.toString() !== currentTenant._id.toString()) {
        return res.status(403).json({ error: 'Access denied: You are not a registered user of this hospital.' })
      }
    } else {
      // Global Login (no hospitalSlug)
      // STRICT: ONLY Director can login globally
      if (user.role !== 'director') {
        console.log('[auth] login failed: non-director tried global login', { email: user.email, role: user.role })
        // Get tenant slug for redirect
        let tenantSlug = null
        if (user.tenantId) {
          const userTenant = await Tenant.findById(user.tenantId)
          if (userTenant) tenantSlug = userTenant.slug
        }
        return res.status(403).json({
          error: 'Please login via your specific hospital portal URL.',
          requiresPortal: true,
          tenantSlug
        })
      }
    }

    // Debug: Log password comparison details
    console.log('[auth] password comparison', {
      email: user.email,
      providedPassword: password,
      passwordLength: password?.length,
      hasPasswordHash: !!user.passwordHash,
      passwordHashLength: user.passwordHash?.length
    })

    const ok = await bcrypt.compare(password, user.passwordHash)

    if (!ok) {
      console.log('[auth] login failed: password mismatch', { email: user.email, hasPasswordHash: !!user.passwordHash })
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    // Invalidate previous sessions by overwriting sessionId
    user.sessionId = crypto.randomUUID()
    await user.save()
    const safe = user.toSafeJSON()

    try {
      const patient = await req.db(Patient).findOne({ email: user.email }).select('avatarUrl')
      if (patient && patient.avatarUrl) safe.avatarUrl = patient.avatarUrl
    } catch (e) { }
    safe.mustChangePassword = user.mustChangePassword || false

    let tenant = null
    if (user.tenantId) {
      if (currentTenant && currentTenant._id.toString() === user.tenantId.toString()) {
        tenant = currentTenant
      } else {
        tenant = await Tenant.findById(user.tenantId).populate('plan')
      }
    }

    if (tenant) {
      safe.tenantSlug = tenant.slug
    }

    if (tenant && tenant.plan) {
      safe.tenantPlan = {
        name: tenant.plan.name,
        slug: tenant.slug, // Include slug in response
        roleFeatures: tenant.plan.roleFeatures,
        limits: tenant.plan.limits
      }
    }
    const tokenPayload = { sub: user._id, sid: user.sessionId, role: user.role }
    if (tenant) tokenPayload.tenantId = String(tenant._id)
    if (tenant && tenant.plan) tokenPayload.plan = String(tenant.plan._id)
    const accessSecret = process.env.ACCESS_TOKEN_SECRET
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET

    if (!accessSecret || !refreshSecret) {
      throw new Error('JWT secrets are not properly configured')
    }
    const accessExpiry = process.env.ACCESS_TOKEN_EXPIRY || '1d'
    const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d'

    const accessToken = jwt.sign({ ...tokenPayload, type: 'access' }, accessSecret, { expiresIn: accessExpiry })
    const refreshToken = jwt.sign({ ...tokenPayload, type: 'refresh' }, refreshSecret, { expiresIn: refreshExpiry })
    setRefreshCookie(res, refreshToken)
    res.json({ token: accessToken, user: safe })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Forgot password - initiate reset
router.post('/forgot-password', authLimiter, [
  body('email').trim().isEmail().withMessage('Valid email required').bail().customSanitizer(normalizeEmailInput)
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

    const { email } = req.body
    const { user } = await findUserByEmailFlexible(email)
    // Always respond ok to avoid email enumeration; only proceed if user exists
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex')
      const hashed = crypto.createHash('sha256').update(rawToken).digest('hex')
      user.passwordResetToken = hashed
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      await user.save()
      let tenantQuery = ''
      if (user.tenantId) {
        const t = await Tenant.findById(user.tenantId).select('slug')
        if (t?.slug) tenantQuery = `&hospitalSlug=${encodeURIComponent(t.slug)}`
      }
      const resetUrl = buildPublicFrontendUrl(`/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}${tenantQuery}`)
      const { html, attachments } = passwordResetTemplate(user, resetUrl)
      await sendEmail(email, 'Password Reset Instructions', html, { attachments })
    }
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Reset password - consume token
router.post('/reset-password', authLimiter, [
  body('email').trim().isEmail().withMessage('Valid email required').bail().customSanitizer(normalizeEmailInput),
  body('token').notEmpty().withMessage('Token required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Za-z]/).withMessage('Password must contain at least one letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

    const { email, token, password } = req.body
    const { user } = await findUserByEmailFlexible(email)
    if (!user || !user.passwordResetToken || !user.passwordResetExpires) {
      return res.status(400).json({ error: 'Invalid or expired token' })
    }
    if (user.passwordResetExpires.getTime() < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired token' })
    }
    const hashed = crypto.createHash('sha256').update(token).digest('hex')
    if (hashed !== user.passwordResetToken) {
      return res.status(400).json({ error: 'Invalid or expired token' })
    }
    // Update password
    user.passwordHash = await bcrypt.hash(password, 10)
    user.passwordResetToken = null
    user.passwordResetExpires = null
    // Invalidate existing sessions
    user.sessionId = crypto.randomUUID()
    await user.save()

    let tenantSlug = null
    if (user.tenantId) {
      const tenant = await Tenant.findById(user.tenantId).select('slug')
      if (tenant?.slug) tenantSlug = tenant.slug
    }

    clearRefreshCookie(res)
    res.json({ ok: true, message: 'Password reset successful. Please log in.', tenantSlug })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Me
router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.userId)
  if (!user) return res.status(404).json({ error: 'User not found' })
  const safe = user.toSafeJSON()
  try {
    const patient = await req.db(Patient).findOne({ email: user.email }).select('avatarUrl')
    if (patient && patient.avatarUrl) safe.avatarUrl = patient.avatarUrl
  } catch (e) { }
  // include locale preference if present
  if (user.locale) safe.locale = user.locale
  // include tenantId and mustChangePassword for client to act on first-login flows
  safe.tenantId = user.tenantId
  if (user.tenantId) {
    try {
      const tenant = await Tenant.findById(user.tenantId).populate('plan')
      if (tenant) {
        safe.tenantSlug = tenant.slug // Add slug for frontend routing
        if (tenant.plan) {
          safe.tenantPlan = {
            name: tenant.plan.name,
            roleFeatures: tenant.plan.roleFeatures,
            limits: tenant.plan.limits
          }
        }
      }
    } catch (e) { /* ignore */ }
  }
  safe.mustChangePassword = user.mustChangePassword || false
  res.json({ user: safe })
})

// Update own profile (allow updating locale preference)
router.put('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ error: 'User not found' })
    const { locale } = req.body || {}
    if (locale && ['en', 'hi'].includes(locale)) user.locale = locale
    await user.save()
    const safe = user.toSafeJSON()
    try {
      const patient = await req.db(Patient).findOne({ email: user.email }).select('avatarUrl')
      if (patient && patient.avatarUrl) safe.avatarUrl = patient.avatarUrl
    } catch (e) { }
    if (user.locale) safe.locale = user.locale
    res.json({ user: safe })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Change password (authenticated)
router.put('/change-password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Za-z]/).withMessage('Password must contain at least one letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg })

    const { currentPassword, newPassword } = req.body

    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const ok = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid current password' })

    user.passwordHash = await bcrypt.hash(newPassword, 10)
    user.mustChangePassword = false
    // Rotate sessionId to logout other devices if desired, or keep it same.
    // user.sessionId = crypto.randomUUID() 
    await user.save()

    res.json({ ok: true, message: 'Password updated successfully' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Logout (invalidate current session)
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    let userId = null

    if (token) {
      try {
        const accessSecret = process.env.ACCESS_TOKEN_SECRET
        if (!accessSecret) throw new Error('ACCESS_TOKEN_SECRET is not configured')
        const payload = jwt.verify(token, accessSecret)
        if (payload && payload.sub) {
          userId = payload.sub
        }
      } catch (e) { /* ignore verification error, still clear cookie */ }
    }

    if (userId) {
      const user = await User.findById(userId)
      if (user) {
        user.sessionId = crypto.randomUUID()
        await user.save()
      }
    }
    clearRefreshCookie(res)
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

// Refresh Token (Protected by CSRF Double-Submit)
router.post('/refresh-token', authLimiter, async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken
    if (!refreshToken) {
      console.warn('[auth] Refresh attempt with no cookie')
      return res.status(401).json({ error: 'No refresh token' })
    }

    const refreshSecret = process.env.REFRESH_TOKEN_SECRET

    if (!refreshSecret) {
      return res.status(500).json({ error: 'JWT secrets are not properly configured' })
    }
    let payload
    try {
      payload = jwt.verify(refreshToken, refreshSecret)
    } catch (ve) {
      console.error('[auth] Refresh token verification failed:', ve.message)
      clearRefreshCookie(res)
      return res.status(401).json({ error: 'Invalid token' })
    }

    if (payload.type !== 'refresh') {
      console.warn('[auth] Refresh attempt with non-refresh token')
      return res.status(401).json({ error: 'Invalid token type' })
    }

    const user = await User.findById(payload.sub)

    if (!user) {
      console.warn('[auth] Refresh attempt: user not found', payload.sub)
      return res.status(401).json({ error: 'User not found' })
    }
    req.tenantId = user.tenantId

    if (user.sessionId && payload.sid !== user.sessionId) {
      console.warn('[auth] Refresh attempt: session ID mismatch', { tokenSid: payload.sid, userSid: user.sessionId })
      return res.status(401).json({ error: 'Session invalidated' })
    }

    // Check tenant status if applicable
    let tenant = null
    if (user.tenantId) {
      tenant = await Tenant.findById(user.tenantId).populate('plan')
      if (tenant && tenant.status !== 'active') return res.status(403).json({ error: 'Tenant suspended' })
    }

    if (user.blocked) {
      console.warn('[auth] Refresh attempt failed: user is blocked', { userId: user._id })
      return res.status(403).json({ error: 'Your account has been blocked. Please contact support.' })
    }

    // Issue new access token
    const tokenPayload = {
      sub: user._id,
      sid: user.sessionId,
      role: user.role,
      tenantId: user.tenantId ? String(user.tenantId) : undefined,
    }

    const safe = user.toSafeJSON()
    try {
      const patient = await req.db(Patient).findOne({ email: user.email }).select('avatarUrl')
      if (patient && patient.avatarUrl) safe.avatarUrl = patient.avatarUrl
    } catch (e) { }

    // Re-populate plan info if needed, or just include minimal info
    // For simplicity, we trust the DB state for the new access token
    if (tenant) {
      safe.tenantSlug = tenant.slug
      if (tenant.plan) {
        tokenPayload.plan = String(tenant.plan._id)
        safe.tenantPlan = {
          name: tenant.plan.name,
          slug: tenant.slug,
          roleFeatures: tenant.plan.roleFeatures,
          limits: tenant.plan.limits
        }
      }
    }

    const accessSecret = process.env.ACCESS_TOKEN_SECRET

    if (!accessSecret || !refreshSecret) {
      return res.status(500).json({ error: 'JWT secrets are not properly configured' })
    }

    const accessExpiry = process.env.ACCESS_TOKEN_EXPIRY || '1d'
    const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d'

    const newAccessToken = jwt.sign({ ...tokenPayload, type: 'access' }, accessSecret, { expiresIn: accessExpiry })
    const newRefreshToken = jwt.sign({ ...tokenPayload, type: 'refresh' }, refreshSecret, { expiresIn: refreshExpiry })

    // Rotate refresh token securely
    setRefreshCookie(res, newRefreshToken)
    res.json({ token: newAccessToken, user: safe })
  } catch (e) {
    if (e.name === 'TokenExpiredError') {
      clearRefreshCookie(res)
      return res.status(401).json({ error: 'Refresh token expired' })
    }
    console.error('Refresh token error', e)
    res.status(401).json({ error: 'Invalid refresh token' })
  }
})

// Debug endpoint to verify user credentials (remove in production)
router.post('/debug-check-user', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      return res.json({ exists: false, message: 'User not found' })
    }

    const hasPasswordHash = !!user.passwordHash
    const passwordHashLength = user.passwordHash?.length

    // Test bcrypt comparison
    let passwordMatch = false
    if (password && user.passwordHash) {
      passwordMatch = await bcrypt.compare(password, user.passwordHash)
    }

    res.json({
      exists: true,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      hasPasswordHash,
      passwordHashLength,
      passwordMatch,
      providedPasswordLength: password?.length
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

export default router
