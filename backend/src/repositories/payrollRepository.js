import { db } from "../config/db.js";

export class PayrollRepository {
  static async upsertCompensation({ tenantId, userId, monthlyGrossPaise, employmentStartDate, employmentEndDate }) {
    return db.staff_compensation.upsert({
      where: { tenant_id_user_id: { tenant_id: tenantId, user_id: userId } },
      create: {
        tenant_id: tenantId,
        user_id: userId,
        monthly_gross_paise: monthlyGrossPaise,
        employment_start_date: employmentStartDate,
        employment_end_date: employmentEndDate || null,
      },
      update: {
        monthly_gross_paise: monthlyGrossPaise,
        employment_start_date: employmentStartDate,
        employment_end_date: employmentEndDate || null,
        updated_at: new Date(),
      },
      include: { user: { select: { user_id: true, name: true, email: true, role: { select: { name: true } } } } },
    });
  }

  static async listCompensation({ tenantId, userId }) {
    return db.staff_compensation.findMany({
      where: { tenant_id: tenantId, ...(userId ? { user_id: userId } : {}) },
      orderBy: { created_at: "desc" },
      include: { user: { select: { user_id: true, name: true, email: true, role: { select: { name: true } } } } },
    });
  }

  static async createRun({ tenantId, createdBy, period, items, transaction }) {
    const create = async (tx) => {
      const run = await tx.payroll_run.create({
        data: {
          tenant_id: tenantId,
          period_start: new Date(`${period.localStartDate}T00:00:00Z`),
          period_end: new Date(`${period.localEndDateExclusive}T00:00:00Z`),
          timezone: period.timezone,
          created_by: createdBy,
          items: {
            create: items.map((item) => ({
              tenant_id: tenantId,
              user_id: item.userId,
              employee_name_snapshot: item.name || "Unnamed staff",
              employee_email_snapshot: item.email,
              role_name_snapshot: item.roleName,
              monthly_gross_paise: BigInt(item.monthlyGrossPaise),
              calendar_days: period.daysInMonth,
              active_days: item.activeDays,
              present_days: item.presentDays,
              half_days: item.halfDays,
              approved_leave_days: item.approvedLeaveDays,
              paid_days: item.paidDays,
              gross_payable_paise: BigInt(item.grossPayablePaise),
              net_pay_paise: BigInt(item.grossPayablePaise),
            })),
          },
        },
        include: { items: true },
      });
      return run;
    };
    return transaction ? create(transaction) : db.$transaction(create);
  }

  static async listRuns({ tenantId, skip, take }) {
    return db.$transaction(async (tx) => Promise.all([
      tx.payroll_run.count({ where: { tenant_id: tenantId } }),
      tx.payroll_run.findMany({
        where: { tenant_id: tenantId },
        skip,
        take,
        orderBy: { period_start: "desc" },
        include: { _count: { select: { items: true } } },
      }),
    ]));
  }

  static async findRun({ tenantId, payrollRunId }) {
    return db.payroll_run.findFirst({
      where: { payroll_run_id: payrollRunId, tenant_id: tenantId },
      include: {
        items: { orderBy: { employee_name_snapshot: "asc" } },
      },
    });
  }

  static async updateItemAdjustments({ tenantId, payrollRunId, payrollItemId, additionsPaise, deductionsPaise, adjustmentNote }) {
    return db.$transaction(async (tx) => {
      const item = await tx.payroll_item.findFirst({
        where: { payroll_item_id: payrollItemId, payroll_run_id: payrollRunId, tenant_id: tenantId },
      });
      if (!item) return null;
      const netPayPaise = Number(item.gross_payable_paise) + additionsPaise - deductionsPaise;
      if (netPayPaise < 0) return { invalid: true };
      return tx.payroll_item.update({
        where: { payroll_item_id: payrollItemId },
        data: {
          additions_paise: BigInt(additionsPaise),
          deductions_paise: BigInt(deductionsPaise),
          net_pay_paise: BigInt(netPayPaise),
          adjustment_note: adjustmentNote || null,
        },
      });
    });
  }

  static async freezeRun({ tenantId, payrollRunId, approvedBy }) {
    return db.payroll_run.updateMany({
      where: { payroll_run_id: payrollRunId, tenant_id: tenantId, status: "DRAFT" },
      data: { status: "FROZEN", approved_by: approvedBy, approved_at: new Date(), updated_at: new Date() },
    });
  }

  static async markItemPaid({ tenantId, payrollRunId, payrollItemId, paidBy }) {
    return db.$transaction(async (tx) => {
      const run = await tx.payroll_run.findFirst({ where: { payroll_run_id: payrollRunId, tenant_id: tenantId } });
      if (!run || !["FROZEN", "PARTIALLY_PAID"].includes(run.status)) return { error: "RUN_NOT_PAYABLE" };
      const result = await tx.payroll_item.updateMany({
        where: { payroll_item_id: payrollItemId, payroll_run_id: payrollRunId, tenant_id: tenantId, payment_status: "UNPAID" },
        data: { payment_status: "PAID", paid_at: new Date(), paid_by: paidBy, updated_at: new Date() },
      });
      if (result.count === 0) return { error: "ITEM_NOT_PAYABLE" };
      const unpaid = await tx.payroll_item.count({ where: { payroll_run_id: payrollRunId, tenant_id: tenantId, payment_status: "UNPAID" } });
      await tx.payroll_run.update({ where: { payroll_run_id: payrollRunId }, data: { status: unpaid === 0 ? "PAID" : "PARTIALLY_PAID", updated_at: new Date() } });
      return { count: result.count };
    });
  }

  static async markAllPaid({ tenantId, payrollRunId, paidBy }) {
    return db.$transaction(async (tx) => {
      const run = await tx.payroll_run.findFirst({ where: { payroll_run_id: payrollRunId, tenant_id: tenantId } });
      if (!run || !["FROZEN", "PARTIALLY_PAID"].includes(run.status)) return { error: "RUN_NOT_PAYABLE" };
      const result = await tx.payroll_item.updateMany({
        where: { payroll_run_id: payrollRunId, tenant_id: tenantId, payment_status: "UNPAID" },
        data: { payment_status: "PAID", paid_at: new Date(), paid_by: paidBy, updated_at: new Date() },
      });
      await tx.payroll_run.update({ where: { payroll_run_id: payrollRunId }, data: { status: "PAID", updated_at: new Date() } });
      return { count: result.count };
    });
  }

  static async listPayslips({ tenantId, userId, skip, take }) {
    const where = { tenant_id: tenantId, ...(userId ? { user_id: userId } : {}) };
    return db.$transaction(async (tx) => Promise.all([
      tx.payroll_item.count({ where }),
      tx.payroll_item.findMany({ where, skip, take, orderBy: { created_at: "desc" }, include: { run: { select: { period_start: true, period_end: true, timezone: true, status: true } } } }),
    ]));
  }
}
