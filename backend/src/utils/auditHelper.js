import AuditLog from '../models/AuditLog.js';

/**
 * Log user activity to the tenant-scoped audit log collection
 * @param {Object} req Express request object
 * @param {string} action Action description (e.g. 'CREATE', 'UPDATE', 'DELETE')
 * @param {string} resourceType Affected resource type (e.g. 'patient', 'laborder')
 * @param {string} resourceId Affected resource identifier
 * @param {Object} details Additional key-value details about the action
 */
export async function logActivity(req, action, resourceType, resourceId, details = {}) {
  try {
    const tenantId = req.tenant?._id || req.user?.tenantId || null;
    const createdBy = req.userId || 'system';
    const role = req.user?.role || 'system';
    const ip = req.ip || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;

    if (!req.db) {
      console.warn('[auditHelper] req.db is missing. Skipping audit log write.');
      return;
    }

    await req.db(AuditLog).create({
      tenantId,
      action,
      resourceType,
      resourceId: String(resourceId || ''),
      details,
      createdBy,
      role,
      ip,
      userAgent,
      status: 'active'
    });
  } catch (e) {
    console.error('[auditHelper] Failed to write audit log:', e.message);
  }
}

export default logActivity;
