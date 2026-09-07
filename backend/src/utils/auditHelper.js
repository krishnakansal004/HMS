import { AuditService } from '../services/auditService.js';

export async function logActivity(req, action, resourceType, resourceId, details = {}) {
  try {
    const tenantId = req.tenant?._id || req.tenantId || req.user?.tenantId || null;
    const userId = req.userId || null;
    
    await AuditService.logAction({
      tenantId,
      userId,
      action,
      entityType: resourceType.toUpperCase(),
      entityId: String(resourceId || ''),
      newValue: details,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || null
    });
  } catch (e) {
    console.error('[auditHelper] Failed to write audit log:', e.message);
  }
}
export default logActivity;