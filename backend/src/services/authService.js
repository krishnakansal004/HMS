import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/userRepository.js';
import { env } from '../config/env.js';

export class AuthService {
  static async registerPatient({ firstName, lastName, email, password, phone, gender, dob, hospitalSlug }) {
    // Validate Tenant
    const tenant = await UserRepository.findTenantBySlug(hospitalSlug);
    if (!tenant || tenant.status !== 'active') {
      const err = new Error('Hospital not found or is currently inactive.');
      err.statusCode = 404;
      throw err;
    }

    // Prevent Duplicate Emails within the system
    const existingUser = await UserRepository.findUserByEmail(email);
    if (existingUser) {
      const err = new Error('Email is already registered.');
      err.statusCode = 409;
      throw err;
    }

    // Resolve Role (Assuming 'PATIENT' role exists in DB)
    const role = await UserRepository.findRoleByName('PATIENT');
    if (!role) {
      const err = new Error('System configuration error: Patient role not found.');
      err.statusCode = 500;
      throw err;
    }

    // Secure Password Hashing 
    const passwordHash = await bcrypt.hash(password, 12);
    const fullName = `${firstName} ${lastName}`.trim();

    // Prepare Data matching exact Schema fields
    const userData = {
      tenant_id: tenant.tenant_id,
      role_id: role.role_id,
      email: email.toLowerCase(),
      name: fullName,
      password_hash: passwordHash,
      must_change_password: false
    };

    const patientData = {
      tenant_id: tenant.tenant_id,
      first_name: firstName,
      last_name: lastName,
      email: email.toLowerCase(),
      phone: phone,
      gender: gender,
      date_of_birth: new Date(dob),
      is_admitted: false
    };

    const user = await UserRepository.createPatientUser(userData, patientData);

    return {
      id: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role.name
    };
  }

  static async login({ email, password, hospitalSlug }) {
    // Fetch User
    const user = await UserRepository.findUserByEmail(email.toLowerCase());
    if (!user || !user.password_hash) {
      const err = new Error('Invalid credentials.');
      err.statusCode = 401;
      throw err;
    }

    // 1b. Soft-deleted / offboarded users must not be able to log in.
    // findUserByEmail() doesn't filter deleted_at (it's used by registration's
    // duplicate-email check too, where a soft-deleted user's email SHOULD
    // still count as taken), so the check has to happen here instead.
    if (user.deleted_at) {
      const err = new Error('Invalid credentials.');
      err.statusCode = 401;
      throw err;
    }

    // Verify Password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const err = new Error('Invalid credentials.');
      err.statusCode = 401;
      throw err;
    }

    // Strict Tenant Isolation Check
    // If the user is not a global System Owner, they MUST provide the correct hospital slug.
    if (user.role.name !== 'SYSTEM_OWNER') {
      if (!hospitalSlug) {
        const err = new Error('Hospital identifier is required for login.');
        err.statusCode = 400;
        throw err;
      }
      if (!user.tenant || user.tenant.slug !== hospitalSlug) {
        const err = new Error('You are not registered with this hospital.');
        err.statusCode = 403;
        throw err;
      }
      if (user.tenant.status !== 'active') {
        const err = new Error('This hospital account is suspended.');
        err.statusCode = 403;
        throw err;
      }
    }

    // Generate JWT Tokens
   const tokenPayload = {
      id: user.user_id,    
      sub: user.user_id,
      userId: user.user_id, 
      role: user.role.name,
      tenantId: user.tenant_id
    };

    const accessToken = jwt.sign(tokenPayload, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpiresIn });
    const refreshToken = jwt.sign(tokenPayload, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpiresIn });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role.name,
        tenantSlug: user.tenant?.slug || null,
        tenantName: user.tenant?.name || null,
        mustChangePassword: user.must_change_password
      }
    };
  }

  /**
   * Exchanges a valid refresh token (read from the httpOnly cookie by the
   * controller) for a new access token. Deliberately does NOT rotate the
   * refresh token itself — that would need a revocation/reuse-detection
   * store this schema doesn't have yet. Re-runs the same tenant/role
   * checks login does, so a refresh can't silently keep a session alive
   * for a tenant that's since been suspended or a user that's since been
   * removed -- a stale-but-unexpired refresh token shouldn't outlive
   * those checks just because it's a different code path from login.
   */
  static async refresh(refreshToken) {
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, env.jwt.refreshSecret);
    } catch {
      const err = new Error('Session expired. Please log in again.');
      err.statusCode = 401;
      throw err;
    }

    const user = await UserRepository.findUserById(decoded.sub);
    if (!user || user.deleted_at) {
      const err = new Error('Session expired. Please log in again.');
      err.statusCode = 401;
      throw err;
    }

    if (user.role.name !== 'SYSTEM_OWNER') {
      if (!user.tenant || user.tenant.status !== 'active') {
        const err = new Error('This hospital account is suspended.');
        err.statusCode = 403;
        throw err;
      }
    }

    const tokenPayload = {
      id: user.user_id,
      sub: user.user_id,
      userId: user.user_id,
      role: user.role.name,
      tenantId: user.tenant_id
    };

    const accessToken = jwt.sign(tokenPayload, env.jwt.accessSecret, { expiresIn: env.jwt.accessExpiresIn });

    return {
      accessToken,
      user: {
        id: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role.name,
        tenantSlug: user.tenant?.slug || null,
        tenantName: user.tenant?.name || null,
        mustChangePassword: user.must_change_password
      }
    };
  }
}