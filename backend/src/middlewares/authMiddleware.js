import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { db, tenantStorage } from "../config/db.js";

export const protect = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json({ success: false, message: "Not authorized, token missing" });
    }

    const decoded = jwt.verify(token, env.jwt.accessSecret);

    if (!decoded.sub || !decoded.tenantId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: "Not authorized, token context missing" });
    }

    const user = await tenantStorage.run({ tenantId: decoded.tenantId }, () =>
      db.users.findUnique({
        where: { user_id: decoded.sub },
        include: { role: true, tenant: true },
      }),
    );

    if (!user || user.deleted_at) {
      return res
        .status(HTTP_STATUS.UNAUTHORIZED)
        .json({ success: false, message: "User no longer exists" });
    }

    // PRODUCTION FIX: bind identity to both signed claims so a valid token cannot cross a tenant boundary.
    if (user.tenant_id !== decoded.tenantId) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: "Not authorized, tenant context invalid" });
    }

    // Inject identity onto request object
    req.userId = user.user_id;
    req.userRole = user.role.name;
    req.currentTenantId = user.tenant_id;
    req.user = user;

    next();
  } catch (error) {
    return res
      .status(HTTP_STATUS.UNAUTHORIZED)
      .json({ success: false, message: "Not authorized, token failed" });
  }
};

export const requireRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        message: "Access forbidden: Insufficient permissions",
      });
    }
    next();
  };
};
