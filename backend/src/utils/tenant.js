import { db } from '../config/db.js';
import { tenantContext } from '../config/tenantContext.js';

export async function tenantMiddleware(req, res, next) {
  try {
    const tenantId = req.tenantId || req.user?.tenant_id;

    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Bad Request: Missing tenant context' });
    }

    // Wrap the entire lifecycle of this request in the AsyncLocalStorage thread
    tenantContext.run(tenantId, async () => {
      
      // Because we are inside the context, this query will automatically apply RLS!
      const tenant = await db.tenant.findUnique({
        where: { tenant_id: tenantId },
        include: { plan: true }
      });

      if (!tenant || tenant.deleted_at) {
        return res.status(404).json({ success: false, error: 'Tenant not found' });
      }

      if (tenant.status !== 'active') {
        return res.status(403).json({ success: false, error: 'Tenant access suspended' });
      }

      req.tenant = tenant;
      req.plan = tenant.plan;
      req.currentTenantId = tenant.tenant_id;

      next();
    });
  } catch (e) {
    console.error('[Tenant Middleware Error]', e);
    res.status(500).json({ success: false, error: 'Server error processing tenant context' });
  }
}

export const requireTenant = tenantMiddleware;
export default tenantMiddleware;