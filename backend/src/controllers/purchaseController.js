import { PurchaseService } from "../services/purchaseService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class PurchaseController {
  static async create(req, res, next) {
    try {
      const purchase = await PurchaseService.createPurchaseOrder({
        tenantId: req.currentTenantId,
        userId: req.userId,
        ...req.body,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Purchase order created successfully",
        data: purchase,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const purchase = await PurchaseService.updatePurchaseStatus({
        tenantId: req.currentTenantId,
        userId: req.userId,
        purchaseId: req.params.id,
        status: req.body.status,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Purchase order status updated successfully",
        data: purchase,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await PurchaseService.getPurchases({
        tenantId: req.currentTenantId,
        query: req.query,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
}
