import { HTTP_STATUS } from '../constants/httpStatus.js';

export const requireTenant = (req, res, next) => {
  // System Owners bypass tenant scoping
  if (req.userRole === 'SYSTEM_OWNER') {
    return next();
  }

  if (!req.currentTenantId) {
    return res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      message: 'Access denied: Tenant context could not be established.'
    });
  }

  next();
};