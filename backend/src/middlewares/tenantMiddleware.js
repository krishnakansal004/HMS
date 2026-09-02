import { db, tenantStorage } from "../config/db.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export const tenantMiddleware = async (req, res, next) => {
  try {
    // SYSTEM_OWNER Bypass
    if (req.userRole === "SYSTEM_OWNER") {
      return next();
    }

    const tenantId = req.tenantId || req.user?.tenant_id;

    if (!tenantId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        message: "Bad Request: Missing tenant context",
      });
    }

    // Real-time Tenant Validation
    const tenant = await db.tenant.findUnique({
      where: { tenant_id: tenantId },
      include: { plan: true },
    });

    if (!tenant || tenant.deleted_at) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: "Tenant not found or has been removed.",
      });
    }

    if (tenant.status !== "active") {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: "Access denied: Tenant account is currently suspended.",
      });
    }

    // Attach validated tenant data to the request
    req.tenant = tenant;
    req.plan = tenant.plan;
    req.currentTenantId = tenant.tenant_id;

    // Use the correct DB-linked AsyncLocalStorage instance and object signature
    tenantStorage.run({ tenantId: req.currentTenantId }, () => {
      next();
    });
  } catch (e) {
    console.error("[Tenant Middleware Error]", e);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Server error processing tenant context",
    });
  }
};

export const requireTenant = tenantMiddleware;
export default tenantMiddleware;
