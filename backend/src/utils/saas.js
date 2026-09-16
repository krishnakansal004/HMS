import { db } from '../config/db.js';
import { PLAN_FEATURE_LABELS, PLAN_LIMIT_LABELS } from '../config/planEntitlements.js';

const PLAN_RESOURCE_BY_ROLE = Object.freeze({
  HOSPITAL_ADMIN: 'admin',
  DOCTOR: 'doctor',
  PATIENT: 'patient',
});

function canRequestUpgrade(req) {
  return req.userRole === 'HOSPITAL_ADMIN';
}

function upgradeAction(req) {
  return {
    available: canRequestUpgrade(req),
    action: 'REQUEST_PLAN_UPGRADE',
    label: canRequestUpgrade(req) ? 'Upgrade plan' : null,
  };
}

function resourceLabel(limitKey, count) {
  const singularLabels = {
    admins: 'administrator account',
    doctors: 'doctor',
    staff: 'staff member',
    patients: 'patient',
    subAdmins: 'sub-administrator account',
  };
  return count === 1
    ? (singularLabels[limitKey] || 'account')
    : (PLAN_LIMIT_LABELS[limitKey] || 'accounts');
}

function planConfigurationError(req, res, plan) {
  return res.status(403).json({
    success: false,
    code: 'PLAN_CONFIGURATION_REQUIRED',
    plan: plan?.name || null,
    message: 'Your hospital subscription needs attention before this action can continue. Please contact your HMS administrator.',
  });
}

function parsePlanLimits(plan) {
  try {
    return typeof plan?.limits === 'string' ? JSON.parse(plan.limits) : (plan?.limits || null);
  } catch {
    return null;
  }
}

export function planResourceForRole(roleName) {
  return PLAN_RESOURCE_BY_ROLE[roleName] || 'staff';
}

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
      if (!tenant?.plan) return planConfigurationError(req, res, null);

      const limits = parsePlanLimits(tenant.plan);
      if (!limits) return planConfigurationError(req, res, tenant.plan);
      
      let limitKey = resource;
      if (resource === 'subadmin' || resource === 'subadmins') limitKey = 'subAdmins';
      if (resource === 'admin') limitKey = 'admins';
      if (resource === 'doctor') limitKey = 'doctors';
      if (resource === 'patient') limitKey = 'patients';

      const allowed = Number(limits[limitKey] ?? limits[resource]);

      if (!Number.isInteger(allowed) || allowed < 1) {
        return planConfigurationError(req, res, tenant.plan);
      }

      let current = 0;
      
      if (limitKey === 'staff' || limitKey === 'admins' || limitKey === 'subAdmins' || limitKey === 'doctors' || limitKey === 'patients') {
         const roleFilter = limitKey === 'staff'
           ? { name: { notIn: ['PATIENT', 'DOCTOR', 'HOSPITAL_ADMIN', 'SYSTEM_OWNER'] } }
           : { name: limitKey === 'doctors' ? 'DOCTOR' : limitKey === 'admins' ? 'HOSPITAL_ADMIN' : limitKey === 'patients' ? 'PATIENT' : 'SUBADMIN' };

         current = await db.users.count({
           where: {
             tenant_id: tenant.tenant_id,
             role: roleFilter,
             deleted_at: null,
           },
         });
      }

      if (current >= allowed) {
        const limitLabel = resourceLabel(limitKey, allowed);
        const message = canRequestUpgrade(req)
          ? `Your ${tenant.plan.name} plan includes up to ${allowed} ${limitLabel}. Upgrade your plan to add another.`
          : `Your hospital has reached its ${limitLabel} limit. Ask a hospital administrator to upgrade the plan.`;
        return res.status(403).json({
          success: false,
          code: 'PLAN_LIMIT_REACHED',
          resource: limitKey,
          limit: allowed,
          plan: tenant.plan.name,
          message,
          upgrade: upgradeAction(req),
        });
      }

      next();
    } catch (err) {
      console.error('[SaaS Middleware] enforcePlanLimit error', err);
      res.status(500).json({ success: false, message: 'We could not check your plan limits. Please try again.' });
    }
  }
}

/** Select the correct plan bucket from a requested role (e.g. admin vs staff). */
export function enforcePlanLimitForRole(field = 'roleName') {
  return (req, res, next) => {
    const resource = planResourceForRole(req.body?.[field]);
    return enforcePlanLimit(resource)(req, res, next);
  };
}

/** Enforce a server-owned module entitlement from the tenant plan. */
export function requirePlanFeature(feature) {
  return (req, res, next) => {
    const plan = req.plan || req.tenant?.plan;
    const limits = parsePlanLimits(plan);
    const features = limits?.features;

    // Fail closed: a plan without an explicit entitlement contract cannot
    // access a metered module. This prevents legacy rows or malformed JSON
    // from silently receiving every paid capability.
    if (features && features[feature] === true) {
      return next();
    }

    return res.status(403).json({
      success: false,
      code: 'PLAN_FEATURE_REQUIRED',
      feature,
      plan: plan?.name || null,
      upgrade: upgradeAction(req),
      message: features
        ? canRequestUpgrade(req)
          ? `${PLAN_FEATURE_LABELS[feature] || 'This module'} is not included in your ${plan?.name || 'current'} plan. Upgrade to unlock it.`
          : `${PLAN_FEATURE_LABELS[feature] || 'This module'} is not included in your hospital's plan. Ask a hospital administrator to upgrade.`
        : 'Your hospital subscription needs attention before this module can be used. Please contact your HMS administrator.',
    });
  };
}
