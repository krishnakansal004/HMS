import rateLimit from 'express-rate-limit';

// Shared, named rate limiters.

// Login / register: cheap per-attempt cost, but brute-forceable — tight
// window, tight ceiling.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 5,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Tenant provisioning: each successful call creates a full hospital
// tenant + admin user, not just a login attempt — a much bigger unit of
// abuse than a failed password guess, so this stays stricter for longer.
export const tenantProvisionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { success: false, message: 'Too many hospital signup attempts from this network. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
