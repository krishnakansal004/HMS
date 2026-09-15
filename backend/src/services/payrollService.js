import { PayrollRepository } from "../repositories/payrollRepository.js";
import { db } from "../config/db.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { assertValidTimeZone, dateKey, enumerateDateKeys, payrollPeriod } from "../utils/payrollTime.js";

const NON_PAYROLL_ROLES = ["DOCTOR", "PATIENT", "SYSTEM_OWNER"];

function toPaise(value, fieldName) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new AppError(`${fieldName} must be a non-negative amount.`, HTTP_STATUS.BAD_REQUEST);
  }
  return Math.round(amount * 100);
}

function asNumber(value) {
  return typeof value === "bigint" ? Number(value) : Number(value || 0);
}

function addOneDay(key) {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function serializeCompensation(compensation) {
  return {
    ...compensation,
    monthly_gross_paise: asNumber(compensation.monthly_gross_paise),
  };
}

function serializeItem(item) {
  return {
    ...item,
    monthly_gross_paise: asNumber(item.monthly_gross_paise),
    gross_payable_paise: asNumber(item.gross_payable_paise),
    additions_paise: asNumber(item.additions_paise),
    deductions_paise: asNumber(item.deductions_paise),
    net_pay_paise: asNumber(item.net_pay_paise),
  };
}

function serializeRun(run) {
  return { ...run, items: run.items?.map(serializeItem) };
}

export class PayrollService {
  static async setCompensation({ tenantId, userId, targetUserId, monthlyGross, employmentStartDate, employmentEndDate, actorId, ipAddress }) {
    const target = await db.users.findFirst({
      where: { tenant_id: tenantId, user_id: targetUserId, deleted_at: null },
      include: { role: true },
    });
    if (!target || NON_PAYROLL_ROLES.includes(target.role.name)) {
      throw new AppError("Only active non-doctor staff can receive a salary profile.", HTTP_STATUS.BAD_REQUEST);
    }

    const start = new Date(employmentStartDate);
    const end = employmentEndDate ? new Date(employmentEndDate) : null;
    if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime())) || (end && end < start)) {
      throw new AppError("Employment dates are invalid.", HTTP_STATUS.BAD_REQUEST);
    }

    const compensation = await PayrollRepository.upsertCompensation({
      tenantId,
      userId: targetUserId,
      monthlyGrossPaise: BigInt(toPaise(monthlyGross, "Monthly gross salary")),
      employmentStartDate: start,
      employmentEndDate: end,
    });
    AuditService.logAction({
      tenantId,
      userId: actorId || userId,
      action: "UPSERT_STAFF_COMPENSATION",
      entityType: "STAFF_COMPENSATION",
      entityId: compensation.compensation_id,
      newValue: { targetUserId, monthlyGross, employmentStartDate, employmentEndDate },
      ipAddress,
    });
    return serializeCompensation(compensation);
  }

  static async listCompensation({ tenantId, userId }) {
    return (await PayrollRepository.listCompensation({ tenantId, userId })).map(serializeCompensation);
  }

  static async createRun({ tenantId, userId, month, ipAddress }) {
    const setting = await db.setting.findFirst({ where: { tenant_id: tenantId, key: "TIMEZONE" } });
    const timezone = setting?.value?.trim();
    assertValidTimeZone(timezone);
    const period = payrollPeriod(month, timezone);

    const run = await db.$transaction(async (tx) => {
      const staff = await tx.users.findMany({
        where: { tenant_id: tenantId, deleted_at: null, role: { name: { notIn: NON_PAYROLL_ROLES } } },
        include: { role: true, staff_compensation: true },
      });
      const missingSalary = staff.filter((member) => !member.staff_compensation).map((member) => member.name || member.email);
      if (missingSalary.length > 0) {
        throw new AppError(`Salary profile missing for: ${missingSalary.slice(0, 5).join(", ")}.`, HTTP_STATUS.UNPROCESSABLE_ENTITY);
      }

      const [attendanceRows, leaveRows] = await Promise.all([
        tx.$queryRaw`
          SELECT user_id, attendance_date, status
          FROM attendance
          WHERE tenant_id = ${tenantId}::uuid
            AND attendance_date >= ((${period.startUtc}::timestamptz AT TIME ZONE ${period.timezone})::date)
            AND attendance_date < ((${period.endUtc}::timestamptz AT TIME ZONE ${period.timezone})::date)
        `,
        tx.$queryRaw`
          SELECT user_id, start_date, end_date
          FROM leave
          WHERE tenant_id = ${tenantId}::uuid
            AND status = 'APPROVED'
            AND start_date < ((${period.endUtc}::timestamptz AT TIME ZONE ${period.timezone})::date)
            AND end_date >= ((${period.startUtc}::timestamptz AT TIME ZONE ${period.timezone})::date)
        `,
      ]);

      const attendanceByUser = new Map();
      for (const row of attendanceRows) {
        if (!attendanceByUser.has(row.user_id)) attendanceByUser.set(row.user_id, new Map());
        attendanceByUser.get(row.user_id).set(dateKey(row.attendance_date), String(row.status || "").toUpperCase());
      }
      const leaveByUser = new Map();
      for (const leave of leaveRows) {
        const start = dateKey(leave.start_date) < period.localStartDate ? period.localStartDate : dateKey(leave.start_date);
        const end = dateKey(leave.end_date) >= period.localEndDateExclusive ? addOneDay(period.localEndDateExclusive) : addOneDay(dateKey(leave.end_date));
        const days = enumerateDateKeys(start, end);
        if (!leaveByUser.has(leave.user_id)) leaveByUser.set(leave.user_id, new Set());
        days.forEach((day) => leaveByUser.get(leave.user_id).add(day));
      }

      const allDays = enumerateDateKeys(period.localStartDate, period.localEndDateExclusive);
      const items = staff.map((member) => {
        const compensation = member.staff_compensation;
        const employmentStart = dateKey(compensation.employment_start_date) > period.localStartDate ? dateKey(compensation.employment_start_date) : period.localStartDate;
        const employmentEnd = compensation.employment_end_date && dateKey(compensation.employment_end_date) < addOneDay(period.localEndDateExclusive)
          ? addOneDay(dateKey(compensation.employment_end_date))
          : period.localEndDateExclusive;
        const activeDays = allDays.filter((day) => day >= employmentStart && day < employmentEnd);
        const attendance = attendanceByUser.get(member.user_id) || new Map();
        const approvedLeave = leaveByUser.get(member.user_id) || new Set();
        let presentDays = 0;
        let halfDays = 0;
        let approvedLeaveDays = 0;
        for (const day of activeDays) {
          const status = attendance.get(day);
          if (status === "PRESENT") presentDays += 1;
          else if (status === "HALF_DAY") halfDays += 1;
          else if (approvedLeave.has(day)) approvedLeaveDays += 1;
        }
        const paidDays = presentDays + (halfDays * 0.5) + approvedLeaveDays;
        const monthlyGrossPaise = asNumber(compensation.monthly_gross_paise);
        return {
          userId: member.user_id,
          name: member.name,
          email: member.email,
          roleName: member.role.name,
          monthlyGrossPaise,
          activeDays: activeDays.length,
          presentDays,
          halfDays,
          approvedLeaveDays,
          paidDays,
          grossPayablePaise: Math.round((monthlyGrossPaise * paidDays) / period.daysInMonth),
        };
      });

      return PayrollRepository.createRun({ tenantId, createdBy: userId, period, items, transaction: tx });
    });

    AuditService.logAction({ tenantId, userId, action: "CREATE_PAYROLL_RUN", entityType: "PAYROLL_RUN", entityId: run.payroll_run_id, newValue: { month, timezone }, ipAddress });
    return serializeRun(run);
  }

  static async listRuns({ tenantId, query }) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 50);
    const [total, data] = await PayrollRepository.listRuns({ tenantId, skip: (page - 1) * limit, take: limit });
    return { total, page, pages: Math.ceil(total / limit), data };
  }

  static async getRun({ tenantId, payrollRunId }) {
    const run = await PayrollRepository.findRun({ tenantId, payrollRunId });
    if (!run) throw new AppError("Payroll run not found.", HTTP_STATUS.NOT_FOUND);
    return serializeRun(run);
  }

  static async updateAdjustments({ tenantId, payrollRunId, payrollItemId, additions, deductions, adjustmentNote, ipAddress, userId }) {
    const run = await PayrollRepository.findRun({ tenantId, payrollRunId });
    if (!run) throw new AppError("Payroll run not found.", HTTP_STATUS.NOT_FOUND);
    if (run.status !== "DRAFT") throw new AppError("Only draft payroll runs can be adjusted.", HTTP_STATUS.CONFLICT);
    const result = await PayrollRepository.updateItemAdjustments({
      tenantId, payrollRunId, payrollItemId,
      additionsPaise: toPaise(additions || 0, "Manual additions"),
      deductionsPaise: toPaise(deductions || 0, "Manual deductions"),
      adjustmentNote,
    });
    if (!result) throw new AppError("Payroll item not found.", HTTP_STATUS.NOT_FOUND);
    if (result.invalid) throw new AppError("Manual deductions cannot exceed payable salary and additions.", HTTP_STATUS.BAD_REQUEST);
    AuditService.logAction({ tenantId, userId, action: "UPDATE_PAYROLL_ADJUSTMENTS", entityType: "PAYROLL_ITEM", entityId: payrollItemId, newValue: { additions, deductions, adjustmentNote }, ipAddress });
    return serializeItem(result);
  }

  static async freezeRun({ tenantId, payrollRunId, userId, ipAddress }) {
    const result = await PayrollRepository.freezeRun({ tenantId, payrollRunId, approvedBy: userId });
    if (result.count === 0) throw new AppError("Only a draft payroll run can be frozen.", HTTP_STATUS.CONFLICT);
    AuditService.logAction({ tenantId, userId, action: "FREEZE_PAYROLL_RUN", entityType: "PAYROLL_RUN", entityId: payrollRunId, ipAddress });
    return this.getRun({ tenantId, payrollRunId });
  }

  static async markPaid({ tenantId, payrollRunId, payrollItemId, userId, ipAddress }) {
    const result = await PayrollRepository.markItemPaid({ tenantId, payrollRunId, payrollItemId, paidBy: userId });
    if (result.error === "RUN_NOT_PAYABLE") throw new AppError("Payroll run must be frozen before marking payments.", HTTP_STATUS.CONFLICT);
    if (result.error === "ITEM_NOT_PAYABLE") throw new AppError("Payroll item is already paid or not found.", HTTP_STATUS.CONFLICT);
    AuditService.logAction({ tenantId, userId, action: "MARK_PAYROLL_ITEM_PAID", entityType: "PAYROLL_ITEM", entityId: payrollItemId, ipAddress });
    return result;
  }

  static async markAllPaid({ tenantId, payrollRunId, userId, ipAddress }) {
    const result = await PayrollRepository.markAllPaid({ tenantId, payrollRunId, paidBy: userId });
    if (result.error) throw new AppError("Payroll run must be frozen before marking payments.", HTTP_STATUS.CONFLICT);
    AuditService.logAction({ tenantId, userId, action: "MARK_ALL_PAYROLL_ITEMS_PAID", entityType: "PAYROLL_RUN", entityId: payrollRunId, newValue: result, ipAddress });
    return result;
  }

  static async listPayslips({ tenantId, userId, userRole, query }) {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 50);
    const targetUserId = ["HOSPITAL_ADMIN", "HR"].includes(userRole) ? query.userId : userId;
    const [total, data] = await PayrollRepository.listPayslips({ tenantId, userId: targetUserId, skip: (page - 1) * limit, take: limit });
    return { total, page, pages: Math.ceil(total / limit), data: data.map(serializeItem) };
  }
}
