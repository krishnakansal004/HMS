import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Tenant from '../models/Tenant.js'
import FirestoreModel from '../models/firestore/FirestoreModel.js'

export async function protect(req, res, next) {
  const auth = req.headers.authorization || ''
  let token = (auth.startsWith('Bearer ') ? auth.slice(7) : null) || req.query.token
  if (token && token.startsWith('Bearer ')) {
    token = token.slice(7)
  }
  if (!token) {
    console.log('[Auth] No token found in headers or query')
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const accessSecret = process.env.ACCESS_TOKEN_SECRET
    console.log('[Auth] Server Time:', new Date().toISOString(), 'Token prefix:', token.substring(0, 15))
    if (!accessSecret) throw new Error('ACCESS_TOKEN_SECRET is not configured')
    const payload = jwt.verify(token, accessSecret)
    console.log('[Auth] Token Payload:', JSON.stringify(payload))
    req.userId = payload.sub
    let user = req.cachedUser
    if (!user) {
      user = await User.findById(req.userId, 'role sessionId blocked tenantId features email')
      if (user) {
        req.cachedUser = user
      }
    }
    if (!user) {
      console.log('[Auth] User not found for ID:', req.userId)
      return res.status(401).json({ error: 'Invalid token' })
    }
    // Enforce single active session: sid in token must match stored sessionId
    if (!payload.sid || !user.sessionId || payload.sid !== user.sessionId) {
      return res.status(401).json({ error: 'Session invalidated' })
    }
    // Attach user and role for downstream handlers
    req.user = user
    // Attach tenantId for convenience (derived from DB, not trusted from token)
    req.tenantId = user.tenantId
    // Attach a scoped db accessor for subcollection-based isolation
    req.db = (modelOrName) => {
      if (typeof modelOrName === 'string') {
         return new FirestoreModel(modelOrName, req.tenantId || null)
      }
      return modelOrName.forHospital(req.tenantId || null)
    }
    // If user belongs to a tenant, ensure tenant is active and subscription not expired
    if (user.tenantId) {
      try {
        let tenant = req.cachedTenant
        if (!tenant) {
          tenant = await Tenant.findById(user.tenantId).populate('plan')
          if (tenant) {
            req.cachedTenant = tenant
          }
        }
        if (tenant) {
          req.tenant = tenant
          req.plan = tenant.plan
          const now = new Date()
          if (tenant.status !== 'active') {
            return res.status(403).json({ error: 'Tenant access suspended' })
          }
          // Check SaaS subscription status if present
          if (tenant.subscriptionStatus && !['active', 'trialing'].includes(tenant.subscriptionStatus)) {
            return res.status(403).json({ error: 'Subscription is not active' })
          }

          if (tenant.subscriptionEnd && tenant.subscriptionEnd < now) {
            // If we have strict status, we might rely on that, but double check date too
            try {
              tenant.status = 'suspended';
              if (tenant.subscriptionStatus === 'active') tenant.subscriptionStatus = 'past_due';
              await tenant.save();
            } catch (e) { /* ignore */ }
            return res.status(403).json({ error: 'Tenant subscription expired' })
          }
        }
      } catch (e) {
        console.warn('tenant check failed', e?.message || e)
      }
    }
    // Deny access if account is blocked
    if (user.blocked) return res.status(403).json({ error: 'Account blocked' })
    if (!req.userRole) req.userRole = user.role
    next()
  } catch (e) {
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
      console.log('[Auth] JWT Error:', e.name, e.message)
      return res.status(401).json({ error: 'Invalid token: ' + e.message })
    }
    console.error('Auth middleware error', e)
    return res.status(500).json({ error: 'Server error during authentication' })
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.userRole) return res.status(403).json({ error: 'Forbidden' })
    if (!roles.includes(req.userRole)) return res.status(403).json({ error: 'Forbidden' })
    next()
  }
}

export const director = requireRoles('director')
export const admin = requireRoles('director', 'admin', 'subadmin')
export const doctor = requireRoles('director', 'admin', 'subadmin', 'doctor')
export const staff = requireRoles('director', 'admin', 'subadmin', 'staff')
export const patient = requireRoles('director', 'admin', 'subadmin', 'doctor', 'staff', 'patient')

// Backward compatibility alias: some routes still import authMiddleware
export const authMiddleware = protect
