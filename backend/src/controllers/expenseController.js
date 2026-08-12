import { ExpenseService } from '../services/expenseService.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class ExpenseController {
  
  static async create(req, res, next) {
    try {
      const expense = await ExpenseService.createExpense({
        tenantId: req.currentTenantId,
        userId: req.userId,
        ...req.body,
        ipAddress: req.ip
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Expense recorded successfully',
        data: expense
      });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      const result = await ExpenseService.deleteExpense({
        tenantId: req.currentTenantId,
        userId: req.userId,
        expenseId: req.params.id,
        ipAddress: req.ip
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Expense removed successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await ExpenseService.getExpenses({
        tenantId: req.currentTenantId,
        query: req.query
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }
}