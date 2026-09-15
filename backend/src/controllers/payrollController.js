import { PayrollService } from "../services/payrollService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class PayrollController {
  static async setCompensation(req, res, next) {
    try {
      const data = await PayrollService.setCompensation({
        ...req.body,
        tenantId: req.currentTenantId,
        userId: req.userId,
        actorId: req.userId,
        targetUserId: req.params.userId,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, data });
    } catch (error) { next(error); }
  }

  static async listCompensation(req, res, next) {
    try {
      const data = await PayrollService.listCompensation({ tenantId: req.currentTenantId });
      res.status(HTTP_STATUS.OK).json({ success: true, data });
    } catch (error) { next(error); }
  }

  static async createRun(req, res, next) {
    try {
      const data = await PayrollService.createRun({ tenantId: req.currentTenantId, userId: req.userId, month: req.body.month, ipAddress: req.ip });
      res.status(HTTP_STATUS.CREATED).json({ success: true, data });
    } catch (error) { next(error); }
  }

  static async listRuns(req, res, next) {
    try {
      const data = await PayrollService.listRuns({ tenantId: req.currentTenantId, query: req.query });
      res.status(HTTP_STATUS.OK).json({ success: true, ...data });
    } catch (error) { next(error); }
  }

  static async getRun(req, res, next) {
    try {
      const data = await PayrollService.getRun({ tenantId: req.currentTenantId, payrollRunId: req.params.id });
      res.status(HTTP_STATUS.OK).json({ success: true, data });
    } catch (error) { next(error); }
  }

  static async updateAdjustments(req, res, next) {
    try {
      const data = await PayrollService.updateAdjustments({ ...req.body, tenantId: req.currentTenantId, payrollRunId: req.params.id, payrollItemId: req.params.itemId, userId: req.userId, ipAddress: req.ip });
      res.status(HTTP_STATUS.OK).json({ success: true, data });
    } catch (error) { next(error); }
  }

  static async freezeRun(req, res, next) {
    try {
      const data = await PayrollService.freezeRun({ tenantId: req.currentTenantId, payrollRunId: req.params.id, userId: req.userId, ipAddress: req.ip });
      res.status(HTTP_STATUS.OK).json({ success: true, data });
    } catch (error) { next(error); }
  }

  static async markPaid(req, res, next) {
    try {
      const data = await PayrollService.markPaid({ tenantId: req.currentTenantId, payrollRunId: req.params.id, payrollItemId: req.params.itemId, userId: req.userId, ipAddress: req.ip });
      res.status(HTTP_STATUS.OK).json({ success: true, data });
    } catch (error) { next(error); }
  }

  static async markAllPaid(req, res, next) {
    try {
      const data = await PayrollService.markAllPaid({ tenantId: req.currentTenantId, payrollRunId: req.params.id, userId: req.userId, ipAddress: req.ip });
      res.status(HTTP_STATUS.OK).json({ success: true, data });
    } catch (error) { next(error); }
  }

  static async listPayslips(req, res, next) {
    try {
      const data = await PayrollService.listPayslips({ tenantId: req.currentTenantId, userId: req.userId, userRole: req.userRole, query: req.query });
      res.status(HTTP_STATUS.OK).json({ success: true, ...data });
    } catch (error) { next(error); }
  }
}
