import { PlanReceiptService } from "../services/planReceiptService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class PlanReceiptController {
  static async generate(req, res, next) {
    try {
      const receipt = await PlanReceiptService.generateReceipt({
        tenantId: req.currentTenantId,
        userId: req.userId,
        userRole: req.userRole,
        invoiceId: req.body.invoiceId,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.CREATED).json({ success: true, data: receipt });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const receipt = await PlanReceiptService.getReceipt({
        tenantId: req.currentTenantId,
        userRole: req.userRole,
        receiptId: req.params.id,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, data: receipt });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await PlanReceiptService.listReceipts({
        tenantId: req.currentTenantId,
        userRole: req.userRole,
        query: req.query,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}
