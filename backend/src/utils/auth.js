import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';

export async function protect(req, res, next) {
  const auth = req.headers.authorization || '';
  let token = (auth.startsWith('Bearer ') ? auth.slice(7) : null) || req.query.token;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
  }

  try {
    const accessSecret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_ACCESS_SECRET;
    const payload = jwt.verify(token, accessSecret);
    
    req.userId = payload.sub || payload.id;

    // Strict Prisma query, entirely ignoring deleted accounts
    const user = await db.users.findUnique({
      where: { user_id: req.userId },
      include: { role: true }
    });

    if (!user || user.deleted_at) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token' });
    }

    // Attach verified context
    req.user = user;
    req.userId = user.user_id;
    req.userRole = user.role?.name;
    req.tenantId = user.tenant_id;

    if (user.must_change_password) {
      // Allow them to hit the password change route, but block standard API access
      if (!req.originalUrl.includes('/auth/change-password')) {
        return res.status(403).json({ success: false, error: 'Password change required.' });
      }
    }

    next();
  } catch (e) {
    if (e.name === 'JsonWebTokenError' || e.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: `Invalid token: ${e.message}` });
    }
    console.error('[Auth Middleware Error]', e);
    return res.status(500).json({ success: false, error: 'Server error during authentication' });
  }
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.userRole) return res.status(403).json({ success: false, error: 'Forbidden: No role assigned' });
    if (!roles.includes(req.userRole)) return res.status(403).json({ success: false, error: 'Forbidden: Insufficient privileges' });
    next();
  };
}

export const admin = requireRoles('DIRECTOR', 'HOSPITAL_ADMIN');
export const doctor = requireRoles('DIRECTOR', 'HOSPITAL_ADMIN', 'DOCTOR');
export const staff = requireRoles('DIRECTOR', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST');
export const authMiddleware = protect;