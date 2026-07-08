import express from 'express'
import Plan from '../models/Plan.js'
import Tenant from '../models/Tenant.js'
import { protect, requireRoles } from '../utils/auth.js'

const router = express.Router()

// List plans for public site (include director-created plans)
router.get('/', async (req, res) => {
  try {
    // Return all plans created by directors (no active/public filter)
    // The user expects the Home page to show every plan created in the director panel.
    const plans = await Plan.find({})

    // Hide accessCode from public callers
    const sanitized = plans.map(p => {
      const copy = { ...p }
      if (!req.user || req.user.role !== 'director') delete copy.accessCode
      return copy
    })
    res.json({ plans: sanitized })
  } catch (e) {
    console.error('list plans error', e)
    res.status(500).json({ error: 'Failed to load plans' })
  }
})

// Director: list all plans (including non-public)
router.get('/all', protect, requireRoles('director'), async (req, res) => {
  try {
    const plans = await Plan.find({})
    res.json({ plans })
  } catch (e) {
    console.error('list all plans error', e)
    res.status(500).json({ error: 'Failed to load plans' })
  }
})

// Create a plan (protected) - only global directors
router.post('/', protect, requireRoles('director'), async (req, res) => {
  try {
    const { name, description, prices, limits, features, roleFeatures, public: isPublic, customized, durations, accessCode, visibility } = req.body
    // Basic validation
    if (!name) return res.status(400).json({ error: 'Plan name required' })
    // Compute flattened features as union of roleFeatures or use provided features
    let flat = features || []
    if (roleFeatures) {
      const set = new Set(flat)
      for (const k of ['admin', 'doctor', 'patient']) {
        const arr = roleFeatures[k] || []
        for (const f of arr) set.add(f)
      }
      flat = Array.from(set)
    }
    // Build plan data
    const planData = { name, description, prices, limits, features: flat, roleFeatures, public: typeof isPublic === 'undefined' ? true : !!isPublic }
    if (customized) {
      planData.customized = true
      planData.durations = Array.isArray(durations) ? durations.map(d => ({ unit: d.unit, length: Number(d.length) || 0, price: Number(d.price) || 0 })) : []
      // Generate access code if none provided
      if (accessCode && String(accessCode).trim()) planData.accessCode = String(accessCode).trim()
      else planData.accessCode = Math.random().toString(36).slice(2, 10).toUpperCase()
      // visibility field maps to `public` for compatibility if provided
      if (typeof visibility !== 'undefined') planData.public = visibility === 'public' || visibility === true
    }
    const plan = await Plan.create(planData)
    res.status(201).json({ plan })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Update a plan (protected)
router.put('/:id', protect, requireRoles('director'), async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, prices, limits, features, roleFeatures, active, customized, durations, accessCode, visibility } = req.body
    const update = {}
    if (name) update.name = name
    if (description) update.description = description
    if (typeof active !== 'undefined') update.active = active
    if (prices) update.prices = prices
    if (limits) update.limits = limits
    if (roleFeatures) {
      // Update both roleFeatures and flattened features
      update.roleFeatures = roleFeatures
      const set = new Set()
      for (const k of ['admin', 'doctor', 'patient']) {
        const arr = roleFeatures[k] || []
        for (const f of arr) set.add(f)
      }
      update.features = Array.from(set)
    } else if (features) {
      update.features = features
    }
    if (typeof customized !== 'undefined') update.customized = !!customized
    if (typeof durations !== 'undefined') update.durations = Array.isArray(durations) ? durations.map(d => ({ unit: d.unit, length: Number(d.length) || 0, price: Number(d.price) || 0 })) : []
    if (typeof accessCode !== 'undefined' && accessCode) update.accessCode = accessCode
    if (typeof visibility !== 'undefined') update.public = visibility === 'public' || visibility === true
    const planDoc = await Plan.findById(id)
    if (!planDoc) return res.status(404).json({ error: 'Plan not found' })
    const plan = await Plan.update(id, update)
    res.json({ plan })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Server error' })
  }
})

// Validate access code for a customized plan
router.post('/validate-access', async (req, res) => {
  try {
    const { planId, code } = req.body
    if (!planId || !code) return res.status(400).json({ error: 'Missing parameters' })
    const plan = await Plan.findById(planId)
    if (!plan) return res.status(404).json({ error: 'Plan not found' })
    if (!plan.customized) return res.status(400).json({ error: 'Plan is not customized' })
    if (!plan.accessCode) return res.status(400).json({ error: 'Plan access code not set' })
    const provided = String(code).trim()
    const saved = String(plan.accessCode).trim()
    // Compare case-insensitive to avoid mismatches due to letter case
    if (saved.toUpperCase() === provided.toUpperCase()) {
      console.info(`validate-access success for plan ${planId}`)
      return res.json({ ok: true })
    }
    // Log a short hint (do not log full codes in production)
    console.info(`validate-access failed for plan ${planId} (provided=${provided.slice(0, 4)}...)`)
    return res.status(403).json({ error: 'Invalid access code' })
  } catch (e) {
    console.error('validate access error', e)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router

// DELETE /api/plans/:id
// Delete a plan if not in use by any tenant
router.delete('/:id', protect, requireRoles('director'), async (req, res) => {
  try {
    const { id } = req.params
    const force = req.query.force === '1' || req.query.force === 'true'
    // Check if plan is assigned to any tenant
    const tenantCount = await Tenant.countDocuments({ plan: id })
    if (tenantCount > 0 && !force) {
      return res.status(400).json({ error: 'Plan is in use by one or more tenants', inUseCount: tenantCount })
    }

    if (tenantCount > 0 && force) {
      // Force delete: remove plan reference from tenants
      // Use a direct update to avoid triggering validation on Tenant model (which requires plan).
      await Tenant.updateMany({ plan: id }, { $unset: { plan: '' } })
    }

    const planDoc = await Plan.findById(id)
    if (!planDoc) return res.status(404).json({ error: 'Plan not found' })
    await Plan.delete(id)
    const plan = planDoc
    res.json({ ok: true, forceApplied: !!force, affectedTenants: tenantCount })
  } catch (e) {
    console.error('delete plan error', e)
    res.status(500).json({ error: 'Failed to delete plan' })
  }
})
