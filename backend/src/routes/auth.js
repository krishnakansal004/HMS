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
import FirestoreModel from '../models/firestore/FirestoreModel.js'

const router = express.Router()

// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

const isProduction = process.env.NODE_ENV === 'production'
const cookieSameSite = process.env.COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax')
const cookieSecure = process.env.COOKIE_SECURE === 'true' || (isProduction && cookieSameSite === 'none')

// Rate limiting - Strict for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 attempts per 15 minutes
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false, xForwardedForHeader: false },
  skip: (req) => {
    // Skip rate limiting for health checks or admin overrides
    return false
  }
})

// Rate limiting for password reset (more lenient)
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 attempts per hour
  message: { error: 'Too many password reset attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
})

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Normalize email input: trim, lowercase, and validate format
 */
const normalizeEmailInput = (value) => {
  return String(value || '').trim().toLowerCase()
}

/**
 * Generate email lookup candidates to handle Gmail aliases and variants
 * Supports: example@gmail.com, example.name@gmail.com, example+tag@gmail.com
 */
function emailLookupCandidates(inputEmail) {
  const email = normalizeEmailInput(inputEmail)
  if (!email || !email.includes('@')) return email ? [email] : []

  const [localRaw, domainRaw] = email.split('@')
  const local = String(localRaw || '').trim()
  const domain = String(domainRaw || '').trim()
  const candidates = [email]

  // Support Gmail aliases for users who previously registered with different variants
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    const localNoPlus = local.split('+')[0]
    const localNoDots = localNoPlus.replace(/\./g, '')
    const variants = [
      `${localNoPlus}@gmail.com`,
      `${localNoDots}@gmail.com`,
      `${localNoPlus}@googlemail.com`,
      `${localNoDots}@googlemail.com`,
    ]
    for (const v of variants) {
      if (!candidates.includes(v)) candidates.push(v)
    }
  }
  return candidates
}

/**
 * Flexible user lookup by email with tenant scoping
 * Prioritizes: tenant admins > tenant users > global users
 */
async function findUserByEmailFlexible(inputEmail, tenantId = null) {
  const candidates = emailLookupCandidates(inputEmail)

  // If tenantId provided, search tenant-scoped users first
  if (tenantId) {
    const tenantUsers = await User.find({
      email: { $in: candidates },
      tenantId,
    })

    // Prioritize admins
    for (const candidate of candidates) {
      const user = tenantUsers.find((u) => u.email === candidate && u.role === 'admin')
      if (user) return { user, matchedEmail: candidate, candidates }
    }

    // Then any user in tenant
    for (const candidate of candidates) {
      const user = tenantUsers.find((u) => u.email === candidate)
      if (user) return { user, matchedEmail: candidate, candidates }
    }
  }

  // Fallback: global search
  const globalUsers = await User.find({ email: { $in: candidates } })
  for (const candidate of candidates) {
    const user = globalUsers.find((u) => u.email === candidate)
    if (user) return { user, matchedEmail: candidate, candidates }
  }

  return { user: null, matchedEmail: null, candidates }
}

/**
 * Set secure refresh token cookie
 */
const setRefreshCookie = (res, token) => {
  const expiryStr = process.env.REFRESH_TOKEN_EXPIRY || '7d'
  let maxAge = 7 * 24 * 60 * 60 * 1000 // default 7 days

  if (expiryStr.endsWith('d')) maxAge = parseInt(expiryStr) * 24 * 60 * 60 * 1000
  else if (expiryStr.endsWith('h')) maxAge = parseInt(expiryStr) * 60 * 60 * 1000
  else if (expiryStr.endsWith('m')) maxAge = parseInt(expiryStr) * 60 * 1000
  else if (expiryStr.endsWith('s')) maxAge = parseInt(expiryStr) * 1000
  else if (!isNaN(expiryStr)) maxAge = parseInt(expiryStr)

  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    maxAge,
    path: '/',
  })
}

/**
 * Clear refresh token cookie
 */
const clearRefreshCookie = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: '/',
  })
}

/**
 * Augment user response with patient avatar and tenant plan info
 */
export const augmentUserResponse = async (req, user, tenant = null) => {
  const safe = user.toSafeJSON()

  // Add avatar from patient record
  try {
    const patientModel = getScopedModel(req, Patient, user?.tenantId)
    const patient = await patientModel.findOne({ email: user.email }).select('avatarUrl')
    if (patient?.avatarUrl) safe.avatarUrl = patient.avatarUrl
  } catch (e) {
    // Silently fail - avatar is optional
  }

  // Add tenant plan info
  if (tenant) {
    safe.tenantSlug = tenant.slug
    if (tenant.plan) {
      safe.tenantPlan = {
        name: tenant.plan.name,
        roleFeatures: tenant.plan.roleFeatures,
        limits: tenant.plan.limits,
      }
    }
  }

  safe.tenantId = user.tenantId
  safe.mustChangePassword = user.mustChangePassword || false

  return safe
}

/**
 * Validate JWT secrets configuration
 */
const validateJWTSecrets = () => {
  const accessSecret = process.env.ACCESS_TOKEN_SECRET
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET

  if (!accessSecret || !refreshSecret) {
    throw new Error('JWT secrets are not properly configured in environment')
  }

  return { accessSecret, refreshSecret }
}

const getScopedModel = (req, modelOrName, fallbackTenantId = null) => {
  if (req?.db) {
    return req.db(modelOrName)
  }

  const tenantId = fallbackTenantId ?? req?.tenantId ?? null
  if (typeof modelOrName === 'string') {
    return new FirestoreModel(modelOrName, tenantId)
  }

  return modelOrName.forHospital(tenantId)
}

// ============================================================================
// CSRF PROTECTION
// ============================================================================

/**
 * Custom CSRF Protection using double-submit pattern
 * Cookie token is httpOnly: false so JavaScript can read it
 * Header token must match cookie token
 */
export const requireCsrf = (req, res, next) => {
  const cookieToken = req.cookies?._csrf
  const headerToken = req.headers['x-csrf-token']

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF token validation failed' })
  }
  next()
}

/**
 * CSRF Token Generation Endpoint
 * Generates and sets CSRF token in cookie, also returns in response body
 */
router.get('/csrf', (req, res) => {
  try {
    const token = crypto.randomBytes(32).toString('hex')

    res.cookie('_csrf', token, {
      httpOnly: false, // Allow JavaScript to read for double-submit pattern
      secure: cookieSecure,
      sameSite: cookieSameSite,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    })

    res.json({ csrfToken: token })
  } catch (err) {
    console.error('[auth] CSRF token generation error:', err.message)
    res.status(500).json({ error: 'Failed to generate CSRF token' })
  }
})

// ============================================================================
// REGISTRATION
// ============================================================================

router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().escape().withMessage('Name is required'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Valid email is required')
      .bail()
      .customSanitizer(normalizeEmailInput),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Za-z]/)
      .withMessage('Password must contain at least one letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number'),
    body('hospitalSlug').optional().trim().escape(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg })
      }

      const { name, email, password, hospitalSlug } = req.body

      // Resolve tenant if registering via hospital portal
      let tenantId = undefined
      if (hospitalSlug) {
        const tenant = await Tenant.findOne({ slug: hospitalSlug })
        if (!tenant) {
          return res.status(404).json({ error: 'Hospital not found' })
        }
        tenantId = tenant._id

        // Check patient limits
        try {
          const Plan = (await import('../models/Plan.js')).default
          if (tenant.plan) {
            const planDoc = await Plan.findById(String(tenant.plan))
            if (planDoc?.limits?.patients !== undefined) {
              const currentPatients = await User.countDocuments({
                tenantId: tenant._id,
                role: 'patient',
              })
              if (currentPatients >= Number(planDoc.limits.patients)) {
                return res.status(403).json({
                  error: 'Patient limit reached for this hospital. Contact administration.',
                })
              }
            }
          }
        } catch (e) {
          console.warn('[auth] patient limit check failed:', e.message)
        }
      }

      // Check if user already exists
      const { user: existing } = await findUserByEmailFlexible(email, tenantId)
      if (existing) {
        if (existing.role === 'admin') {
          return res.status(409).json({
            error: 'This email is already registered as an administrator.',
          })
        }
        if (existing.role === 'patient' && String(existing.tenantId) === String(tenantId)) {
          return res.status(409).json({
            error: 'You are already registered with this email at this hospital.',
          })
        }
      }

      // Create user
      const passwordHash = await bcrypt.hash(password, 10)
      const sessionId = crypto.randomUUID()

      const user = await User.create({
        name,
        email,
        username: email,
        passwordHash,
        role: 'patient',
        sessionId,
        tenantId,
      })

      // Auto-create patient record
      try {
        const nameParts = (name || '').trim().split(/\s+/)
        const firstName = nameParts[0] || ''
        const lastName = nameParts.slice(1).join(' ')

        const patientModel = getScopedModel(req, Patient, tenantId)
        await patientModel.create({
          firstName,
          lastName,
          email: email.toLowerCase(),
          user: user._id,
          tenantId: user.tenantId,
        })
      } catch (e) {
        console.warn('[auth] auto-create patient record failed:', e.message)
      }
    }

      // Build response
      let tenant = null
      if (user.tenantId) {
        tenant = await Tenant.findById(user.tenantId).populate('plan')
      }

      const safe = await augmentUserResponse(req, user, tenant)

      // Generate tokens
      const { accessSecret, refreshSecret } = validateJWTSecrets()
      const tokenPayload = {
        sub: user._id,
        sid: sessionId,
        role: user.role,
      }
      if (tenant) {
        tokenPayload.tenantId = String(tenant._id)
        if (tenant.plan) tokenPayload.plan = String(tenant.plan._id)
      }

      const accessExpiry = process.env.ACCESS_TOKEN_EXPIRY || '1d'
      const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d'

      const accessToken = jwt.sign({ ...tokenPayload, type: 'access' }, accessSecret, {
        expiresIn: accessExpiry,
      })
      const refreshToken = jwt.sign({ ...tokenPayload, type: 'refresh' }, refreshSecret, {
        expiresIn: refreshExpiry,
      })

      setRefreshCookie(res, refreshToken)

      res.status(201).json({ token: accessToken, user: safe })
    } catch (err) {
      console.error('[auth] registration error:', err.message)
      res.status(500).json({ error: 'Server error' })
    }
  }
)

// ============================================================================
// LOGIN
// ============================================================================

router.post(
  '/login',
  authLimiter,
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Valid email required')
      .bail()
      .customSanitizer(normalizeEmailInput),
    body('password').notEmpty().withMessage('Password required'),
    body('hospitalSlug').optional().trim().escape(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg })
      }

      const { email, password, hospitalSlug } = req.body

      // Resolve current tenant
      let currentTenant = null
      if (hospitalSlug) {
        currentTenant = await Tenant.findOne({ slug: hospitalSlug }).populate('plan')
        if (!currentTenant) {
          return res.status(404).json({ error: 'Hospital not found' })
        }
      }

      // Find user
      const lookup = await findUserByEmailFlexible(email, currentTenant?._id)
      const user = lookup.user

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      // Check if user is blocked
      if (user.blocked) {
        return res.status(403).json({
          error: 'Your account has been blocked. Please contact support.',
        })
      }

      // Tenant validation
      if (hospitalSlug) {
        // User logging in via tenant portal
        if (!currentTenant) {
          currentTenant = await Tenant.findOne({ slug: hospitalSlug }).populate('plan')
          if (!currentTenant) {
            return res.status(404).json({ error: 'Hospital not found' })
          }
        }

        if (user.role === 'director') {
          return res.status(403).json({
            error: 'Directors must login via the main director portal.',
          })
        }

        if (!user.tenantId || user.tenantId.toString() !== currentTenant._id.toString()) {
          return res.status(403).json({
            error: 'You are not registered with this hospital.',
          })
        }
      } else {
        // Global login - only directors allowed
        if (user.role !== 'director') {
          let tenantSlug = null
          if (user.tenantId) {
            const userTenant = await Tenant.findById(user.tenantId)
            if (userTenant) tenantSlug = userTenant.slug
          }

          return res.status(403).json({
            error: 'Please login via your hospital portal.',
            requiresPortal: true,
            tenantSlug,
          })
        }
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.passwordHash)
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      // Invalidate previous sessions
      user.sessionId = crypto.randomUUID()
      await user.save()

      // Build response
      let tenant = currentTenant
      if (!tenant && user.tenantId) {
        tenant = await Tenant.findById(user.tenantId).populate('plan')
      }

      const safe = await augmentUserResponse(req, user, tenant)

      // Generate tokens
      const { accessSecret, refreshSecret } = validateJWTSecrets()
      const tokenPayload = {
        sub: user._id,
        sid: user.sessionId,
        role: user.role,
      }
      if (tenant) {
        tokenPayload.tenantId = String(tenant._id)
        if (tenant.plan) tokenPayload.plan = String(tenant.plan._id)
      }

      const accessExpiry = process.env.ACCESS_TOKEN_EXPIRY || '1d'
      const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d'

      const accessToken = jwt.sign({ ...tokenPayload, type: 'access' }, accessSecret, {
        expiresIn: accessExpiry,
      })
      const refreshToken = jwt.sign({ ...tokenPayload, type: 'refresh' }, refreshSecret, {
        expiresIn: refreshExpiry,
      })

      setRefreshCookie(res, refreshToken)

      res.json({ token: accessToken, user: safe })
    } catch (err) {
      console.error('[auth] login error:', err.message)
      res.status(500).json({ error: 'Server error' })
    }
  }
)

// ============================================================================
// PASSWORD MANAGEMENT
// ============================================================================

/**
 * Forgot Password - Initiate reset
 */
router.post(
  '/forgot-password',
  passwordResetLimiter,
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Valid email required')
      .bail()
      .customSanitizer(normalizeEmailInput),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg })
      }

      const { email } = req.body
      const { user } = await findUserByEmailFlexible(email)

      // Always respond ok to prevent email enumeration
      if (user) {
        const rawToken = crypto.randomBytes(32).toString('hex')
        const hashed = crypto.createHash('sha256').update(rawToken).digest('hex')

        user.passwordResetToken = hashed
        user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        user.passwordResetAttempts = 0
        await user.save()

        // Build reset URL with tenant info
        let tenantQuery = ''
        if (user.tenantId) {
          const t = await Tenant.findById(user.tenantId).select('slug')
          if (t?.slug) tenantQuery = `&hospitalSlug=${encodeURIComponent(t.slug)}`
        }

        const resetUrl = buildPublicFrontendUrl(
          `/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}${tenantQuery}`
        )

        const { html, attachments } = passwordResetTemplate(user, resetUrl)
        await sendEmail(email, 'Password Reset Instructions', html, { attachments })
      }

      res.json({ ok: true })
    } catch (err) {
      console.error('[auth] forgot-password error:', err.message)
      res.status(500).json({ error: 'Server error' })
    }
  }
)

/**
 * Reset Password - Consume token
 */
router.post(
  '/reset-password',
  passwordResetLimiter,
  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Valid email required')
      .bail()
      .customSanitizer(normalizeEmailInput),
    body('token').notEmpty().withMessage('Token required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Za-z]/)
      .withMessage('Password must contain at least one letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg })
      }

      const { email, token, password } = req.body
      const { user } = await findUserByEmailFlexible(email)

      // Validate reset token exists and not expired
      if (!user || !user.passwordResetToken || !user.passwordResetExpires) {
        return res.status(400).json({ error: 'Invalid or expired token' })
      }

      if (user.passwordResetExpires.getTime() < Date.now()) {
        return res.status(400).json({ error: 'Token has expired' })
      }

      // Track failed attempts (max 5)
      if ((user.passwordResetAttempts || 0) >= 5) {
        return res.status(429).json({
          error: 'Too many failed attempts. Please request a new password reset link.',
        })
      }

      // Verify token
      const hashed = crypto.createHash('sha256').update(token).digest('hex')
      if (hashed !== user.passwordResetToken) {
        user.passwordResetAttempts = (user.passwordResetAttempts || 0) + 1

        // Lock token after 5 failed attempts
        if (user.passwordResetAttempts >= 5) {
          user.passwordResetToken = null
          user.passwordResetExpires = null
        }
        await user.save()

        return res.status(400).json({
          error:
            user.passwordResetAttempts >= 5
              ? 'Too many failed attempts. Please request a new password reset link.'
              : 'Invalid or expired token',
        })
      }

      // Update password and invalidate all sessions
      user.passwordHash = await bcrypt.hash(password, 10)
      user.passwordResetToken = null
      user.passwordResetExpires = null
      user.passwordResetAttempts = 0
      user.sessionId = crypto.randomUUID()
      await user.save()

      // Get tenant slug for redirect info
      let tenantSlug = null
      if (user.tenantId) {
        const tenant = await Tenant.findById(user.tenantId).select('slug')
        if (tenant?.slug) tenantSlug = tenant.slug
      }

      clearRefreshCookie(res)

      res.json({
        ok: true,
        message: 'Password reset successful. Please log in.',
        tenantSlug,
      })
    } catch (err) {
      console.error('[auth] reset-password error:', err.message)
      res.status(500).json({ error: 'Server error' })
    }
  }
)

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

/**
 * Get current user profile
 */
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    let tenant = null
    if (user.tenantId) {
      tenant = await Tenant.findById(user.tenantId).populate('plan')
    }

    const safe = await augmentUserResponse(req, user, tenant)

    // Include locale preference
    if (user.locale) safe.locale = user.locale

    res.json({ user: safe })
  } catch (err) {
    console.error('[auth] /me error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

/**
 * Update user profile (locale, preferences)
 */
router.put('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const { locale } = req.body || {}

    // Validate locale
    if (locale && ['en', 'hi'].includes(locale)) {
      user.locale = locale
    }

    await user.save()

    let tenant = null
    if (user.tenantId) {
      tenant = await Tenant.findById(user.tenantId).populate('plan')
    }

    const safe = await augmentUserResponse(req, user, tenant)
    if (user.locale) safe.locale = user.locale

    res.json({ user: safe })
  } catch (err) {
    console.error('[auth] update profile error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

/**
 * Change password (for authenticated users)
 */
router.put(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[A-Za-z]/)
      .withMessage('Password must contain at least one letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg })
      }

      const { currentPassword, newPassword } = req.body

      const user = await User.findById(req.userId)
      if (!user) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Verify current password
      const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' })
      }

      // Update password (note: NOT invalidating session to allow user to stay logged in)
      user.passwordHash = await bcrypt.hash(newPassword, 10)
      user.mustChangePassword = false
      await user.save()

      res.json({ ok: true, message: 'Password updated successfully' })
    } catch (err) {
      console.error('[auth] change-password error:', err.message)
      res.status(500).json({ error: 'Server error' })
    }
  }
)

// ============================================================================
// LOGOUT & REFRESH
// ============================================================================

/**
 * Logout - Invalidate current session
 */
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    let userId = null

    if (token) {
      try {
        const { accessSecret } = validateJWTSecrets()
        const payload = jwt.verify(token, accessSecret)
        if (payload?.sub) userId = payload.sub
      } catch (e) {
        // Token invalid, but still clear cookie
      }
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
  } catch (err) {
    console.error('[auth] logout error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

/**
 * Refresh Token - Issue new access token using refresh token
 */
router.post('/refresh-token', authLimiter, async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken
    if (!refreshToken) {
      console.warn('[auth] refresh attempt without token')
      return res.status(401).json({ error: 'No refresh token' })
    }

    const { refreshSecret } = validateJWTSecrets()

    let payload
    try {
      payload = jwt.verify(refreshToken, refreshSecret)
    } catch (ve) {
      console.error('[auth] refresh token verification failed:', ve.message)
      clearRefreshCookie(res)
      return res.status(401).json({ error: 'Invalid refresh token' })
    }

    // Validate token type
    if (payload.type !== 'refresh') {
      console.warn('[auth] non-refresh token used for refresh')
      return res.status(401).json({ error: 'Invalid token type' })
    }

    // Find user
    const user = await User.findById(payload.sub)
    if (!user) {
      console.warn('[auth] refresh attempt: user not found')
      return res.status(401).json({ error: 'User not found' })
    }

    // Validate session ID
    if (user.sessionId && payload.sid !== user.sessionId) {
      console.warn('[auth] session ID mismatch on refresh')
      return res.status(401).json({ error: 'Session invalidated' })
    }

    // Check if user is blocked
    if (user.blocked) {
      return res.status(403).json({
        error: 'Your account has been blocked. Please contact support.',
      })
    }

    // Check tenant status
    let tenant = null
    if (user.tenantId) {
      tenant = await Tenant.findById(user.tenantId).populate('plan')
      if (tenant && tenant.status !== 'active') {
        return res.status(403).json({ error: 'Tenant suspended' })
      }
    }

    // Build new access token
    const { accessSecret } = validateJWTSecrets()
    const tokenPayload = {
      sub: user._id,
      sid: user.sessionId,
      role: user.role,
    }

    if (tenant) {
      tokenPayload.tenantId = String(tenant._id)
      if (tenant.plan) tokenPayload.plan = String(tenant.plan._id)
    }

    const safe = await augmentUserResponse(req, user, tenant)

    const accessExpiry = process.env.ACCESS_TOKEN_EXPIRY || '1d'
    const refreshExpiry = process.env.REFRESH_TOKEN_EXPIRY || '7d'

    const newAccessToken = jwt.sign({ ...tokenPayload, type: 'access' }, accessSecret, {
      expiresIn: accessExpiry,
    })

    const newRefreshToken = jwt.sign({ ...tokenPayload, type: 'refresh' }, refreshSecret, {
      expiresIn: refreshExpiry,
    })

    // Rotate refresh token
    setRefreshCookie(res, newRefreshToken)

    res.json({ token: newAccessToken, user: safe })
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      clearRefreshCookie(res)
      return res.status(401).json({ error: 'Refresh token expired' })
    }
    console.error('[auth] refresh token error:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
