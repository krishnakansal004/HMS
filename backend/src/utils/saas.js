import { db } from '../config/db.js';

// Load tenant for the current user's tenantId, attach to req.tenant
export async function loadTenant(req, res, next) {
  try {
    if (req.tenant) return next();
    
    const tId = req.user?.tenant_id || req.params.tenantId;
    if (!tId) return next();

    const tenant = await db.tenant.findUnique({
      where: { tenant_id: String(tId) },
      include: { plan: true }
    });

    if (!tenant) return res.status(404).json({ success: false, error: 'Tenant not found' });

    const now = new Date();
    const subscriptionEnd = tenant.subscription_end || null;
    const isPlanActive = subscriptionEnd ? (now < new Date(subscriptionEnd)) : true;

    tenant.isPlanActive = isPlanActive;
    req.tenant = tenant;
    req.plan = tenant.plan;
    
    next();
  } catch (err) {
    console.error('[SaaS Middleware] loadTenant error', err);
    res.status(500).json({ success: false, error: 'Server error loading tenant context' });
  }
}

// Enforce numeric limits defined by plan for a given resource type
export function enforcePlanLimit(resource) {
  return async (req, res, next) => {
    try {
      const tenant = req.tenant;
      if (!tenant || !tenant.plan) {
        return next();
      }

      const limits = typeof tenant.plan.limits === 'string' ? JSON.parse(tenant.plan.limits) : (tenant.plan.limits || {});
      
      let limitKey = resource;
      if (resource === 'subadmin' || resource === 'subadmins') limitKey = 'subAdmins';
      if (resource === 'admin') limitKey = 'admins';
      if (resource === 'doctor') limitKey = 'doctors';
      if (resource === 'patient') limitKey = 'patients';

      const allowed = Number(limits[limitKey] || limits[resource]);

      if (isNaN(allowed) || allowed <= 0) {
        return next();
      }

      let current = 0;
      
      if (limitKey === 'staff' || limitKey === 'admins' || limitKey === 'subAdmins' || limitKey === 'doctors' || limitKey === 'patients') {
         let roleNameLookup = limitKey.toUpperCase();
         if (limitKey === 'doctors') roleNameLookup = 'DOCTOR';
         if (limitKey === 'admins') roleNameLookup = 'HOSPITAL_ADMIN';
         if (limitKey === 'patients') roleNameLookup = 'PATIENT';

         current = await db.users.count({
           where: { 
             tenant_id: tenant.tenant_id,
             role: { name: roleNameLookup },
             deleted_at: null
           }
         });
      }

      if (current >= allowed) {
        return res.status(403).json({ success: false, error: `Plan limit reached for ${limitKey} (Limit: ${allowed})` });
      }

      next();
    } catch (err) {
      console.error('[SaaS Middleware] enforcePlanLimit error', err);
      res.status(500).json({ success: false, error: 'Server error checking limits' });
    }
  }
}