import fs from 'node:fs';
import path from 'node:path';
import { jest, describe, expect, it } from '@jest/globals';

const countUsers = jest.fn();
jest.unstable_mockModule('../src/config/db.js', () => ({ db: { users: { count: countUsers } } }));
const { enforcePlanLimitForRole, requirePlanFeature } = await import('../src/utils/saas.js');
const { getMissingPlanFeatures, getMissingPlanContractFields, hasCompletePlanContract } = await import('../src/config/planEntitlements.js');

function runMiddleware(feature, plan) {
  const req = { plan, userRole: 'HOSPITAL_ADMIN' };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  requirePlanFeature(feature)(req, res, next);
  return { res, next };
}

async function runRoleLimit(roleName, limits, currentCount) {
  countUsers.mockResolvedValueOnce(currentCount);
  const req = { userRole: 'HOSPITAL_ADMIN', body: { roleName }, tenant: { tenant_id: 'tenant-a', plan: { name: 'Free', limits } } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  await enforcePlanLimitForRole('roleName')(req, res, next);
  return { res, next };
}

describe('plan entitlements', () => {
  it('blocks a module explicitly excluded from a plan', () => {
    const { res, next } = runMiddleware('inventory', {
      name: 'Free',
      limits: { features: { inventory: false } },
    });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'PLAN_FEATURE_REQUIRED',
      feature: 'inventory',
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('allows enabled modules and blocks unconfigured plans', () => {
    expect(runMiddleware('inventory', { name: 'Elite', limits: { features: { inventory: true } } }).next)
      .toHaveBeenCalled();
    expect(runMiddleware('inventory', { name: 'Unconfigured', limits: {} }).res.status)
      .toHaveBeenCalledWith(403);
  });

  it('fails closed when the stored plan contract is malformed', () => {
    const { res, next } = runMiddleware('inventory', { name: 'Broken', limits: '{not-json}' });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('identifies incomplete contracts instead of inventing defaults', () => {
    expect(getMissingPlanFeatures({ features: { inventory: true } })).toContain('billing');
    expect(getMissingPlanContractFields({ features: { inventory: true } })).toEqual(expect.arrayContaining(['admins', 'doctors', 'staff', 'patients']));
    expect(hasCompletePlanContract({ limits: { features: { inventory: true } } })).toBe(false);
  });

  it('uses the admin limit—not the staff limit—when inviting an administrator', async () => {
    const { res, next } = await runRoleLimit('HOSPITAL_ADMIN', {
      admins: 1, doctors: 1, staff: 99, patients: 1,
    }, 1);

    expect(countUsers).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ role: { name: 'HOSPITAL_ADMIN' } }),
    }));
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'PLAN_LIMIT_REACHED',
      resource: 'admins',
      limit: 1,
      message: 'Your Free plan includes up to 1 administrator account. Upgrade your plan to add another.',
      upgrade: expect.objectContaining({ available: true, label: 'Upgrade plan' }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('returns a clear upgrade action for a paid module that is not included', () => {
    const { res } = runMiddleware('inventory', { name: 'Free', limits: { features: { inventory: false } } });

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Pharmacy and inventory is not included in your Free plan. Upgrade to unlock it.',
      upgrade: expect.objectContaining({ available: true, label: 'Upgrade plan' }),
    }));
  });

  it('attaches paid-module gates to every route belonging to a paid module', () => {
    const root = path.resolve(process.cwd(), 'src/routes');
    const expectedGates = {
      'staff.js': 'hrms', 'attendance.js': 'hrms', 'doctorAttendance.js': 'hrms',
      'inventory.js': 'inventory', 'purchases.js': 'inventory', 'suppliers.js': 'inventory',
      'lab.js': 'lab_radiology', 'radiology.js': 'lab_radiology',
      'invoices.js': 'billing', 'payments.js': 'billing', 'insurance.js': 'billing', 'expenses.js': 'billing',
      'documents.js': 'clinical_media', 'voiceNotes.js': 'voice_notes', 'analytics.js': 'advanced_analytics',
    };

    for (const [file, feature] of Object.entries(expectedGates)) {
      expect(fs.readFileSync(path.join(root, file), 'utf8')).toContain(`requirePlanFeature("${feature}")`);
    }
  });
});
