import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { jest, describe, beforeEach, expect, it } from '@jest/globals';

const repository = {
  findTenantBySlug: jest.fn(),
  findUserByEmail: jest.fn(),
};
const users = {
  update: jest.fn(),
  findFirst: jest.fn(),
};
const db = { users };
const sendEmail = jest.fn();
const passwordResetTemplate = jest.fn(() => ({ html: '<p>reset</p>', attachments: [] }));

jest.unstable_mockModule('../src/repositories/userRepository.js', () => ({ UserRepository: repository }));
jest.unstable_mockModule('../src/config/db.js', () => ({
  db,
  tenantStorage: { run: (_context, callback) => callback() },
}));
jest.unstable_mockModule('../src/config/env.js', () => ({
  env: {
    nodeEnv: 'test',
    jwt: { refreshSecret: 'refresh-secret', accessSecret: 'access-secret' },
  },
}));
jest.unstable_mockModule('../src/config/redis.js', () => ({ redisConnection: { get: jest.fn() } }));
jest.unstable_mockModule('../src/utils/notify.js', () => ({ sendEmail }));
jest.unstable_mockModule('../src/utils/emailTemplates.js', () => ({ passwordResetTemplate }));
jest.unstable_mockModule('../src/utils/publicUrl.js', () => ({
  buildPublicFrontendUrl: (value) => `https://hms.example${value}`,
}));

const { AuthService } = await import('../src/services/authService.js');
const { generateSetupToken, hashSetupToken } = await import('../src/utils/setupToken.js');

const tenant = { tenant_id: 'tenant-a', slug: 'sunrise', status: 'active' };
const user = {
  user_id: 'user-a',
  tenant_id: tenant.tenant_id,
  email: 'staff@sunrise.test',
  name: 'Staff Member',
  password_hash: 'existing-hash',
  deleted_at: null,
  role: { name: 'HOSPITAL_ADMIN' },
  tenant,
};

describe('password reset security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repository.findTenantBySlug.mockResolvedValue(tenant);
    repository.findUserByEmail.mockResolvedValue(user);
    users.update.mockResolvedValue(user);
    users.findFirst.mockResolvedValue(null);
    sendEmail.mockResolvedValue({ ok: true, queued: true });
  });

  it('creates a high-entropy token with a ten-minute expiry', () => {
    const before = Date.now();
    const result = generateSetupToken(10 * 60 * 1000);
    const after = Date.now();

    expect(result.plainToken).toHaveLength(64);
    expect(result.tokenHash).toBe(crypto.createHash('sha256').update(result.plainToken).digest('hex'));
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 10 * 60 * 1000);
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(after + 10 * 60 * 1000);
  });

  it('stores only a hash and emails a single-use ten-minute reset link', async () => {
    await AuthService.requestPasswordReset({ email: user.email, hospitalSlug: tenant.slug });

    const updateData = users.update.mock.calls[0][0].data;
    const emailHtml = passwordResetTemplate.mock.calls[0][1];
    expect(updateData.password_reset_token).toMatch(/^[a-f0-9]{64}$/);
    const rawToken = new URL(emailHtml).searchParams.get('token');
    expect(rawToken).toHaveLength(64);
    expect(updateData.password_reset_token).toBe(hashSetupToken(rawToken));
    expect(updateData.password_reset_expires.getTime() - Date.now()).toBeGreaterThan(9 * 60 * 1000);
    expect(updateData.password_reset_expires.getTime() - Date.now()).toBeLessThanOrEqual(10 * 60 * 1000);
    expect(emailHtml).toContain('/portal/sunrise/reset-password?token=');
    expect(sendEmail).toHaveBeenCalledWith(user.email, 'Reset your HMS password', '<p>reset</p>', { attachments: [] });
  });

  it('does not disclose or mutate another tenant account', async () => {
    repository.findUserByEmail.mockResolvedValueOnce(null);

    await AuthService.requestPasswordReset({ email: user.email, hospitalSlug: 'other-hospital' });

    expect(users.update).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('clears the token and changes the password exactly once', async () => {
    const rawToken = 'a'.repeat(64);
    const resetUser = { ...user, password_reset_token: hashSetupToken(rawToken) };
    users.findFirst.mockResolvedValueOnce(resetUser);

    await expect(AuthService.resetPassword({
      token: rawToken,
      hospitalSlug: tenant.slug,
      newPassword: 'NewPassword1',
    })).resolves.toEqual({ success: true });

    const updateData = users.update.mock.calls[0][0].data;
    expect(updateData.password_hash).not.toBe('NewPassword1');
    expect(updateData.password_reset_token).toBeNull();
    expect(updateData.password_reset_expires).toBeNull();
    expect(updateData.password_changed_at).toBeInstanceOf(Date);

    users.findFirst.mockResolvedValueOnce(null);
    await expect(AuthService.resetPassword({
      token: rawToken,
      hospitalSlug: tenant.slug,
      newPassword: 'NewPassword1',
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  it('keeps the reset endpoints public but rate-limited and tenant-aware', () => {
    const route = fs.readFileSync(path.resolve(process.cwd(), 'src/routes/auth.js'), 'utf8');
    expect(route).toMatch(/"\/forgot-password"[\s\S]*authLimiter[\s\S]*forgotPasswordValidator/);
    expect(route).toMatch(/"\/reset-password"[\s\S]*authLimiter[\s\S]*resetPasswordValidator/);
  });
});
