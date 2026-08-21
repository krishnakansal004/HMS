import { db } from '../config/db.js';

export class ExpenseRepository {
  
  static async create(tenantId, data) {
    return db.expense.create({
      data: {
        tenant_id: tenantId,
        ...data
      },
      include: {
        users: { select: { name: true, email: true } }
      }
    });
  }

  static async findByIdAndTenant(tenantId, expenseId) {
    return db.expense.findFirst({
      where: { expense_id: expenseId, tenant_id: tenantId },
      include: {
        users: { select: { name: true, email: true } }
      }
    });
  }

  static async softDelete(tenantId, expenseId) {
    return db.expense.updateMany({
      where: { expense_id: expenseId, tenant_id: tenantId },
      data: { deleted_at: new Date(), updated_at: new Date() }
    });
  }

static async findManyPaginated({ tenantId, category, startDate, endDate, skip, take }) {
    const where = { tenant_id: tenantId };
    
    if (category) where.category = category;
    if (startDate || endDate) {
      where.expense_date = {};
      if (startDate) where.expense_date.gte = new Date(startDate);
      if (endDate) where.expense_date.lte = new Date(endDate);
    }

    return db.$transaction(async (tx) => {
      const [total, expenses] = await Promise.all([
        tx.expense.count({ where }),
        tx.expense.findMany({
          where,
          skip,
          take,
          orderBy: { expense_date: 'desc' },
          include: {
            users: { select: { name: true, email: true } }
          }
        })
      ]);
      return [total, expenses];
    });
  }
}