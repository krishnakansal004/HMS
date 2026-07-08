import express from 'express'
import bcrypt from 'bcryptjs'
import Tenant from '../models/Tenant.js'
import Plan from '../models/Plan.js'
import User from '../models/User.js'
import { protect, requireRoles } from '../utils/auth.js'
import { loadTenant, enforcePlanLimit } from '../utils/saas.js'
import { allowRolesWithSubadminFeature } from '../utils/permissions.js'
import { sendEmail } from '../utils/notify.js'
import { subadminCreatedTemplate, subadminCredentialsTemplate } from '../utils/emailTemplates.js'

const router = express.Router()

// Return current user's tenant (requires auth + loadTenant middleware)
router.get('/me', protect, loadTenant, async (req, res) => {
  try {
    if (!req.tenant) return res.json({ tenant: null })
    let tenant = { ...req.tenant }
    // loadTenant already populated req.tenant.plan as an object, but if it didn't:
    if (tenant.plan && typeof tenant.plan === 'string') {
      const planDoc = await Plan.findById(tenant.plan)
      if (planDoc) tenant.plan = planDoc
    }
    res.json({ tenant })
  } catch (e) {
    console.error('[tenants] me error', e)
    res.status(500).json({ error: 'Server error' })
  }
})

// List sub-admins for a tenant (searchable)
router.get('/:tenantId/subadmins', protect, loadTenant, allowRolesWithSubadminFeature(['director', 'admin', 'subadmin'], 'view_subadmins'), async (req, res) => {
  try {
    const tenant = req.tenant
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
    const q = req.query.q && String(req.query.q).trim()
    const query = { tenantId: tenant._id, role: 'subadmin' }
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      query.$or = [{ name: re }, { email: re }, { phone: re }]
    }
    const users = await User.find(query).sort({ createdAt: -1 }).limit(200)
    res.json(users.map(u => u.toSafeJSON()))
  } catch (err) {
    console.error('[tenants] list subadmins error', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Create a tenant (director becomes the tenant owner)
router.post('/', protect, requireRoles('director'), async (req, res) => {
  try {
    const { name, planId } = req.body
    if (!name || !planId) return res.status(400).json({ error: 'Missing fields' })
    const plan = await Plan.findById(planId)
    if (!plan) return res.status(404).json({ error: 'Plan not found' })
    // create tenant owned by the SaaS owner (if configured) or by current director
    // If `SAAS_OWNER_ID` env var is set, use that single owner as the director for all tenants.
    const ownerId = process.env.SAAS_OWNER_ID || req.userId
    // Use the owner's user id as the Tenant _id when owner is the current user
    const tenantData = { _id: ownerId === req.userId ? req.userId : undefined, name, director: ownerId, plan: plan._id }

    // Generate slug
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `hospital-${Date.now()}`

    // Ensure uniqueness
    const existingSlug = await Tenant.findOne({ slug })
    if (existingSlug) return res.status(409).json({ error: 'Hospital name is already taken (slug conflict). Please choose a different name.' })
    tenantData.slug = slug

    // If a tenant document already exists for this owner (and we used owner's id as _id), prevent accidental overwrite
    let tenant = null
    if (tenantData._id) tenant = await Tenant.findById(tenantData._id)
    if (!tenant) tenant = await Tenant.create(tenantData)
    // If the created tenant is owned by the current user, attach tenantId to director (ensures user.tenantId === user._id)
    if (String(ownerId) === String(req.userId)) {
      const u = await User.findById(req.userId)
      if (u) await User.update(req.userId, { tenantId: tenant._id })
    }
    res.status(201).json({ tenant })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Add an admin under a tenant - must be director of that tenant
router.post('/:tenantId/admins', protect, loadTenant, requireRoles('director'), enforcePlanLimit('admins'), async (req, res) => {
  try {
    const { tenantId } = req.params
    const tenant = req.tenant
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
    // Only tenant director may create admins for their tenant
    if (String(tenant.director) !== String(req.userId)) return res.status(403).json({ error: 'Forbidden' })
    const { name, email, password, phone, designation } = req.body
    // Optionally create the new admin under a separate, empty tenant for isolation
    const explicitSeparate = req.body && (req.body.separateTenant === true || String(req.body.separateTenant) === 'true')
    const newTenantName = req.body && req.body.newTenantName ? String(req.body.newTenantName).trim() : null
    // Auto-isolate admins when the tenant's plan grants admin credentials (plan.limits.admins > 0)
    let autoSeparate = false
    if (tenant && tenant.plan) {
      try {
        const planDoc = await Plan.findById(tenant.plan)
        if (planDoc && planDoc.limits && (planDoc.limits.admins || 0) > 0) autoSeparate = true
      } catch (e) {
        console.warn('Failed to load plan for auto-isolate check', e?.message || e)
      }
    }
    const separate = explicitSeparate || autoSeparate
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' })
    const existing = await User.findOne({ email, tenantId: tenant._id })
    if (existing) return res.status(409).json({ error: 'Email already registered' })
    const passwordHash = await bcrypt.hash(password, 10)
    let targetTenant = tenant
    if (separate) {
      // create a fresh tenant document owned by the same director but empty of data
      const ntName = newTenantName || `${name} — ${process.env.COMPANY_NAME || 'Instance'}`
      targetTenant = await Tenant.create({ name: ntName, director: req.userId, plan: tenant.plan || null, status: 'active' })
      // initialize usage counters
      targetTenant.usage = { admins: 0, subAdmins: 0, doctors: 0, patients: 0 }
      await targetTenant.save()
    }

    const admin = await User.create({ name, email, passwordHash, role: 'admin', tenantId: targetTenant._id })
    // update tenant usage counter (best-effort)
    targetTenant.usage.admins = (targetTenant.usage.admins || 0) + 1
    await targetTenant.save()
    res.status(201).json({ admin: admin.toSafeJSON(), tenant: { id: targetTenant._id, name: targetTenant.name } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Add sub-admin by an admin (enforced by role)
router.post('/:tenantId/subadmins', protect, loadTenant, allowRolesWithSubadminFeature(['director', 'admin', 'subadmin'], 'manage_subadmins'), enforcePlanLimit('subAdmins'), async (req, res) => {
  try {
    const tenant = req.tenant
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
    const { name, email, password, phone, designation } = req.body
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' })
    const existing = await User.findOne({ email, tenantId: tenant._id })
    if (existing) {
      // Idempotency: If created recently (<2m) by the same user, return it instead of 409.
      // This handles gateway retries (Vercel/Render) where the first request succeeded at DB but timed out at client.
      const age = Date.now() - new Date(existing.createdAt || 0).getTime()
      if (age < 120000 && String(existing.createdBy) === String(req.userId)) {
        return res.status(201).json({ subadmin: existing.toSafeJSON(), idempotent: true })
      }
      return res.status(409).json({ error: 'Email already registered' })
    }
    const passwordHash = await bcrypt.hash(password, 10)
    // Allow passing feature grants from admin (optional)
    const features = Array.isArray(req.body.features) ? req.body.features : []
    const subadmin = await User.create({ name, email, passwordHash, role: 'subadmin', tenantId: tenant._id, phone, designation, features, createdBy: req.userId, mustChangePassword: true })
    tenant.usage = tenant.usage || {}
    tenant.usage.subAdmins = (tenant.usage.subAdmins || 0) + 1
    // Use direct update to avoid issues with populated fields in tenant.save()
    await Tenant.update(tenant._id, { usage: tenant.usage })
    // send credentials email to new subadmin (best-effort)
    try {
      const tpl = subadminCreatedTemplate({ name, email }, password, tenant)
      await sendEmail(email, `${process.env.COMPANY_NAME || 'HMS'} — Subadmin Account Created`, tpl.html, { attachments: tpl.attachments })
    } catch (e) { console.error('Failed to send subadmin email', e) }

    res.status(201).json({ subadmin: subadmin.toSafeJSON() })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Delete a sub-admin
router.delete('/:tenantId/subadmins/:id', protect, loadTenant, allowRolesWithSubadminFeature(['director', 'admin', 'subadmin'], 'manage_subadmins'), async (req, res) => {
  try {
    const tenant = req.tenant
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
    const subId = req.params.id
    const sub = await User.findOne({ _id: subId, tenantId: tenant._id, role: 'subadmin' })
    if (!sub) return res.status(404).json({ error: 'Subadmin not found' })
    // Prevent deleting the current user
    if (String(sub._id) === String(req.userId)) return res.status(400).json({ error: 'Cannot delete yourself' })
    await User.delete(sub._id)
    tenant.usage = tenant.usage || {}
    tenant.usage.subAdmins = Math.max(0, (tenant.usage.subAdmins || 0) - 1)
    await Tenant.update(tenant._id, { usage: tenant.usage })
    res.json({ ok: true })
  } catch (err) {
    console.error('[tenants] delete subadmin error', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Update a sub-admin (name, phone, designation, features)
router.patch('/:tenantId/subadmins/:id', protect, loadTenant, allowRolesWithSubadminFeature(['director', 'admin', 'subadmin'], 'manage_subadmins'), async (req, res) => {
  try {
    const tenant = req.tenant
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
    const subId = req.params.id
    const sub = await User.findOne({ _id: subId, tenantId: tenant._id, role: 'subadmin' })
    if (!sub) return res.status(404).json({ error: 'Subadmin not found' })
    const { name, phone, designation, features } = req.body
    const updates = {}
    if (name) updates.name = name
    if (phone !== undefined) updates.phone = phone
    if (designation !== undefined) updates.designation = designation
    if (Array.isArray(features)) updates.features = features
    await User.update(subId, updates)
    const updated = await User.findOne({ _id: subId, tenantId: tenant._id })
    res.json({ subadmin: updated?.toSafeJSON ? updated.toSafeJSON() : updated })
  } catch (err) {
    console.error('[tenants] update subadmin error', err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Resend login credentials to a sub-admin (generates a new temp password)
router.post('/:tenantId/subadmins/:id/resend-credentials', protect, loadTenant, allowRolesWithSubadminFeature(['director', 'admin', 'subadmin'], 'manage_subadmins'), async (req, res) => {
  try {
    const tenant = req.tenant
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
    const subId = req.params.id
    const sub = await User.findOne({ _id: subId, tenantId: tenant._id, role: 'subadmin' })
    if (!sub) return res.status(404).json({ error: 'Subadmin not found' })
    // Generate new temp password
    const newPassword = Math.random().toString(36).slice(-10)
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await User.update(subId, { passwordHash, mustChangePassword: true })
    // Email credentials
    try {
      const tpl = subadminCredentialsTemplate(sub, newPassword, tenant)
      await sendEmail(sub.email, `${process.env.COMPANY_NAME || 'HMS'} — New Login Credentials`, tpl.html, { attachments: tpl.attachments })
    } catch (e) {
      console.error('[tenants] failed to send credentials email:', e?.message || e)
    }
    res.json({ ok: true, message: `Credentials sent to ${sub.email}` })
  } catch (err) {
    console.error('[tenants] resend credentials error', err)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
