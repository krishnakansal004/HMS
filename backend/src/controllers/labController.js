import { LabService } from "../services/labService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class LabController {
  static async createCatalogItem(req, res, next) {
    try {
      const test = await LabService.createTestCatalogItem({
        tenantId: req.currentTenantId,
        userId: req.userId,
        data: req.body,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Lab test added to catalog successfully",
        data: test,
      });
    } catch (error) {
      next(error);
    }
  }

  static async order(req, res, next) {
    try {
      const order = await LabService.orderLabTest({
        tenantId: req.currentTenantId,
        userId: req.userId,
        patientId: req.body.patientId,
        testId: req.body.testId,
        doctorProfileId: req.body.doctorProfileId,
        prescriptionId: req.body.prescriptionId,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Lab test ordered successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateResults(req, res, next) {
    try {
      const order = await LabService.updateLabResults({
        tenantId: req.currentTenantId,
        userId: req.userId,
        orderId: req.params.id,
        sampleStatus: req.body.sampleStatus,
        technicianNotes: req.body.technicianNotes,
        results: req.body.results,
        invoiceId: req.body.invoiceId,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Lab order updated successfully",
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await LabService.getOrders({
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
