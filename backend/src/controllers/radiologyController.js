import { RadiologyService } from "../services/radiologyService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class RadiologyController {
  static async order(req, res, next) {
    try {
      const order = await RadiologyService.orderRadiologyStudy({
        tenantId: req.currentTenantId,
        userId: req.userId,
        userRole: req.userRole,
        ...req.body,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Radiology study ordered successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const order = await RadiologyService.updateRadiologyStatus({
        tenantId: req.currentTenantId,
        userId: req.userId,
        orderId: req.params.id,
        status: req.body.status,
        findings: req.body.findings,
        impression: req.body.impression,
        scanMetadata: req.body.scanMetadata,
        invoiceId: req.body.invoiceId,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Radiology order updated successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await RadiologyService.getOrders({
        tenantId: req.currentTenantId,
        userId: req.userId,
        userRole: req.userRole,
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
