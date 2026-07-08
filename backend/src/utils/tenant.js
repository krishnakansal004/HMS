// Middleware to attach tenant information to request
import Tenant from '../models/Tenant.js'
import FirestoreModel from '../models/firestore/FirestoreModel.js'

export async function tenantMiddleware(req, res, next) {
  try {
    if (req.tenant) return next()
    // req.tenantId should be set by auth middleware (derived from DB)
    // req.tenantId should be set by auth middleware (derived from DB)
    let tenantId = (req.tenantId || (req.user && req.user.tenantId)) ? (req.tenantId || req.user.tenantId) : null

    // Safely convert to string
    if (tenantId && typeof tenantId !== 'string') {
      try {
        tenantId = String(tenantId)
      } catch (e) {
        console.warn('Failed to convert tenantId to string', e)
        tenantId = null
      }
    }

    if (!tenantId) return next()

    // prevent crash on invalid ID
    if (typeof tenantId !== 'string' || !tenantId.match(/^[a-zA-Z0-9_\-]{15,40}$/)) {
      console.warn('Invalid tenantId in middleware', tenantId)
      return next() // treat as no tenant
    }
    let tenant = req.cachedTenant
    if (!tenant) {
      tenant = await Tenant.findById(tenantId).populate('plan')
      if (tenant) {
        req.cachedTenant = tenant
      }
    }
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' })
    req.tenant = tenant
    req.plan = tenant.plan
    // ensure req.tenantId is normalized to ObjectId/string
    req.tenantId = tenant._id
    
    // Attach a scoped db accessor for subcollection-based isolation
    if (!req.db) {
      req.db = (modelOrName) => {
        if (typeof modelOrName === 'string') {
           return new FirestoreModel(modelOrName, req.tenantId)
        }
        return modelOrName.forHospital(req.tenantId)
      }
    }
    
    next()
  } catch (e) {
    console.error('tenantMiddleware error', e)

    res.status(500).json({ error: 'Server error' })
  }
}

export default tenantMiddleware
