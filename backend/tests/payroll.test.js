import { jest, describe, beforeEach, expect, it } from "@jest/globals";
import { payrollPeriod } from "../src/utils/payrollTime.js";

const repository = {
  createRun: jest.fn(),
  upsertCompensation: jest.fn(),
  listCompensation: jest.fn(),
};
const audit = { logAction: jest.fn() };
const setting = { findFirst: jest.fn() };
const users = { findFirst: jest.fn() };
const db = {
  setting,
  users,
  $transaction: jest.fn(),
};

jest.unstable_mockModule("../src/repositories/payrollRepository.js", () => ({ PayrollRepository: repository }));
jest.unstable_mockModule("../src/services/auditService.js", () => ({ AuditService: audit }));
jest.unstable_mockModule("../src/config/db.js", () => ({ db }));

const { PayrollService } = await import("../src/services/payrollService.js");

describe("payroll timezone and attendance calculation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setting.findFirst.mockResolvedValue({ value: "Asia/Kolkata" });
    repository.createRun.mockResolvedValue({ payroll_run_id: "run-a", items: [] });
  });

  it("creates precise local month boundaries in UTC", () => {
    const period = payrollPeriod("2026-01", "Asia/Kolkata");
    expect(period.daysInMonth).toBe(31);
    expect(period.startUtc.toISOString()).toBe("2025-12-31T18:30:00.000Z");
    expect(period.endUtc.toISOString()).toBe("2026-01-31T18:30:00.000Z");
  });

  it("rejects a missing or invalid tenant timezone before payroll calculation", async () => {
    setting.findFirst.mockResolvedValueOnce(null);
    await expect(PayrollService.createRun({ tenantId: "tenant-a", userId: "admin-a", month: "2026-01" }))
      .rejects.toMatchObject({ statusCode: 422 });

    setting.findFirst.mockResolvedValueOnce({ value: "Not/A-Timezone" });
    await expect(PayrollService.createRun({ tenantId: "tenant-a", userId: "admin-a", month: "2026-01" }))
      .rejects.toMatchObject({ statusCode: 422 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("calculates present, half-day, approved leave, and employment proration", async () => {
    const transaction = {
      users: {
        findMany: jest.fn().mockResolvedValue([{
          user_id: "staff-a",
          name: "Nurse A",
          email: "nurse@example.test",
          role: { name: "NURSE" },
          staff_compensation: {
            monthly_gross_paise: 310000n,
            employment_start_date: new Date("2026-01-01T00:00:00.000Z"),
            employment_end_date: null,
          },
        }]),
      },
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([
          { user_id: "staff-a", attendance_date: new Date("2026-01-01T00:00:00.000Z"), status: "PRESENT" },
          { user_id: "staff-a", attendance_date: new Date("2026-01-02T00:00:00.000Z"), status: "HALF_DAY" },
        ])
        .mockResolvedValueOnce([
          { user_id: "staff-a", start_date: new Date("2026-01-03T00:00:00.000Z"), end_date: new Date("2026-01-03T00:00:00.000Z") },
        ]),
    };
    db.$transaction.mockImplementationOnce((callback) => callback(transaction));

    await PayrollService.createRun({ tenantId: "tenant-a", userId: "admin-a", month: "2026-01" });

    expect(repository.createRun).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant-a",
      period: expect.objectContaining({ startUtc: expect.any(Date), endUtc: expect.any(Date), daysInMonth: 31 }),
      items: [expect.objectContaining({
        userId: "staff-a",
        activeDays: 31,
        presentDays: 1,
        halfDays: 1,
        approvedLeaveDays: 1,
        paidDays: 2.5,
        grossPayablePaise: 25000,
      })],
    }));
  });
});
