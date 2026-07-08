import Tenant from '../models/Tenant.js'
import Plan from '../models/Plan.js'
import User from '../models/User.js'
import Staff from '../models/Staff.js'

// Load tenant for the current user's tenantId, attach to req.tenant
export async function loadTenant(req, res, next) {
  try {
    if (req.tenant) return next()
    const user = req.user
    // If user has a tenantId, use it. Otherwise, check if a tenantId is provided in the URL params.
    const tId = user?.tenantId || req.params.tenantId
    if (!tId) return next()
    const tIdStr = String(tId)
    // Basic validation for ID string (Firestore IDs are usually long, but let's just ensure it's not a tiny/corrupt string)
    if (!tIdStr || tIdStr.length < 5) return next()
    let tenant = req.cachedTenant
    if (!tenant) {
      tenant = await Tenant.findById(tId)
      if (tenant && tenant.plan && (typeof tenant.plan === 'string' || !tenant.plan._id)) {
        const planDoc = await Plan.findById(String(tenant.plan))
        if (planDoc) tenant.plan = planDoc
      }
      if (tenant) {
        req.cachedTenant = tenant
      }
    }
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
    // Compute a derived flag whether the subscription window is currently active
    const now = new Date()
    const subscriptionEnd = tenant.subscriptionEnd || null
    const isPlanActive = subscriptionEnd ? (now < new Date(subscriptionEnd)) : true
    // Attach tenant and convenience properties to the request
    tenant.isPlanActive = isPlanActive
    req.tenant = tenant
    req.plan = tenant.plan
    next()
  } catch (err) {
    console.error('loadTenant error', err)

    res.status(500).json({ error: 'Server error loading tenant context' })
  }
}

// Enforce numeric limits defined by plan for a given resource type
// resource: one of 'admins','subAdmins','doctors','patients','staff'
export function enforcePlanLimit(resource) {
  return async (req, res, next) => {
    try {
      const tenant = req.tenant
      if (!tenant || !tenant.plan) {
        // If no tenant context found (e.g. global director), skip limit check
        return next()
      }
      const limits = tenant.plan.limits || {}
      
      // Normalize resource name for limit lookup
      // Support patterns like 'subAdmins', 'subadmin', 'subadmins'
      let limitKey = resource;
      if (resource === 'subadmin' || resource === 'subadmins') limitKey = 'subAdmins';
      if (resource === 'admin') limitKey = 'admins';
      if (resource === 'doctor') limitKey = 'doctors';
      if (resource === 'patient') limitKey = 'patients';

      const allowed = Number(limits[limitKey] || limits[resource]);
      if (isNaN(allowed) || allowed < 0) {
        console.log(`[saas] No limit found for ${limitKey} / ${resource}, skipping check.`, { limits });
        return next();
      }

      // If tenant subscription has expired, return a clear error instructing renewal
      const now = new Date()
      if (tenant.subscriptionEnd) {
        const end = new Date(tenant.subscriptionEnd)
        if (now >= end) {
          console.warn(`[saas] Subscription expired for tenant ${tenant._id}`, { end, now })
          return res.status(403).json({ error: 'Subscription expired. Please renew or upgrade your plan.' })
        }
      }

      // Count existing entities
      if (limitKey === 'staff') {
        const currentStaff = await Staff.countDocuments({ tenantId: tenant._id })
        console.log(`[saas] Limit check: staff, current: ${currentStaff}, allowed: ${allowed}`)
        if (currentStaff >= allowed) return res.status(403).json({ error: `Plan limit reached for staff (Limit: ${allowed})` })
        return next()
      }

      let query = { tenantId: tenant._id }
      if (limitKey === 'admins') query.role = 'admin'
      else if (limitKey === 'subAdmins') query.role = 'subadmin'
      else if (limitKey === 'doctors') query.role = 'doctor'
      else if (limitKey === 'patients') query.role = 'patient'
      
      const current = await User.countDocuments(query)
      console.log(`[saas] Limit check: ${limitKey}, current: ${current}, allowed: ${allowed}`, query)
      if (current >= allowed) {
        return res.status(403).json({ error: `Plan limit reached for ${limitKey} (Limit: ${allowed})` })
      }
      next()
    } catch (err) {
      console.error('enforcePlanLimit error', err)
      res.status(500).json({ error: 'Server error check limits' })
    }
  }
}
