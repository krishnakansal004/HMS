import { ExpenseRepository } from "../repositories/expenseRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class ExpenseService {
  static async createExpense({
    tenantId,
    userId,
    title,
    category,
    amount,
    expenseDate,
    ipAddress,
  }) {
    if (amount <= 0) {
      throw new AppError(
        "Expense amount must be greater than zero.",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const formattedAmount = Number(amount);

    const expense = await ExpenseRepository.create(tenantId, {
      title,
      category, // e.g., SALARY, MAINTENANCE, UTILITIES, EQUIPMENT, MARKETING, RENT, MISCELLANEOUS
      amount: formattedAmount,
      expense_date: expenseDate ? new Date(expenseDate) : new Date(),
      created_by: userId,
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "CREATE_EXPENSE",
      entityType: "EXPENSE",
      entityId: expense.expense_id,
      newValue: { title, category, amount: formattedAmount, expenseDate },
      ipAddress,
    });

    return expense;
  }

  static async deleteExpense({ tenantId, userId, expenseId, ipAddress }) {
    const expense = await ExpenseRepository.findByIdAndTenant(
      tenantId,
      expenseId,
    );
    if (!expense) {
      throw new AppError("Expense record not found.", HTTP_STATUS.NOT_FOUND);
    }

    await ExpenseRepository.softDelete(tenantId, expenseId);

    AuditService.logAction({
      tenantId,
      userId,
      action: "SOFT_DELETE_EXPENSE",
      entityType: "EXPENSE",
      entityId: expenseId,
      oldValue: { title: expense.title, amount: expense.amount },
      newValue: { deleted_at: new Date() },
      ipAddress,
    });

    return { expense_id: expenseId, deleted: true };
  }

  static async getExpenses({ tenantId, query }) {
    const { category, startDate, endDate, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, expenses] = await ExpenseRepository.findManyPaginated({
      tenantId,
      category,
      startDate,
      endDate,
      skip,
      take,
    });

    return {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: expenses,
    };
  }
}
