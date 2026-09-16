// Server-owned entitlement keys. Plan records store the selected values;
// this list prevents UI-only labels from silently becoming permissions.
export const PLAN_FEATURE_KEYS = Object.freeze([
  'billing',
  'lab_radiology',
  'inventory',
  'hrms',
  'payroll',
  'clinical_media',
  'voice_notes',
  'advanced_analytics',
  'abdm',
  'priority_support',
]);

export const PLAN_LIMIT_KEYS = Object.freeze([
  'admins',
  'doctors',
  'staff',
  'patients',
]);

// These labels are deliberately server-owned too. Entitlement failures are
// shown directly to hospital users, so internal keys such as `lab_radiology`
// must never leak into the product UI.
export const PLAN_FEATURE_LABELS = Object.freeze({
  billing: 'Billing and online payments',
  lab_radiology: 'Lab and radiology',
  inventory: 'Pharmacy and inventory',
  hrms: 'Staff and HR management',
  payroll: 'Payroll',
  clinical_media: 'Clinical documents and media',
  voice_notes: 'Patient voice notes',
  advanced_analytics: 'Advanced analytics',
  abdm: 'ABDM readiness',
  priority_support: 'Priority support',
});

export const PLAN_LIMIT_LABELS = Object.freeze({
  admins: 'administrator accounts',
  doctors: 'doctors',
  staff: 'staff members',
  patients: 'patients',
  subAdmins: 'sub-administrator accounts',
});

export function normalizePlanLimits(limits) {
  if (!limits || typeof limits !== 'object' || Array.isArray(limits)) return null;

  const features = limits.features && typeof limits.features === 'object' && !Array.isArray(limits.features)
    ? Object.fromEntries(PLAN_FEATURE_KEYS.map((key) => [key, limits.features[key] === true]))
    : null;
  const customFeatures = Array.isArray(limits.customFeatures)
    ? [...new Set(limits.customFeatures.map((item) => String(item).trim()).filter(Boolean))].slice(0, 20)
    : [];

  return { ...limits, features, customFeatures };
}

export function getMissingPlanFeatures(limits) {
  const features = limits?.features;
  if (!features || typeof features !== 'object' || Array.isArray(features)) {
    return [...PLAN_FEATURE_KEYS];
  }

  return PLAN_FEATURE_KEYS.filter((key) => typeof features[key] !== 'boolean');
}

export function getMissingPlanLimits(limits) {
  return PLAN_LIMIT_KEYS.filter((key) => {
    const value = limits?.[key];
    return !Number.isInteger(value) || value < 1;
  });
}

export function getMissingPlanContractFields(limits) {
  return [
    ...getMissingPlanLimits(limits),
    ...getMissingPlanFeatures(limits).map((key) => `features.${key}`),
  ];
}

export function hasCompletePlanContract(plan) {
  let limits = plan?.limits;
  if (typeof limits === 'string') {
    try {
      limits = JSON.parse(limits);
    } catch {
      return false;
    }
  }
  return getMissingPlanContractFields(limits).length === 0;
}
