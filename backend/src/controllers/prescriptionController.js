import { PrescriptionService } from "../services/prescriptionService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class PrescriptionController {
  static async create(req, res, next) {
    try {
      const { doctorProfileId, ...rest } = req.body;
      const prescription = await PrescriptionService.createPrescription({
        tenantId: req.currentTenantId,
        userId: req.userId,
        ...req.body,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Prescription created successfully",
        data: prescription,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const prescription = await PrescriptionService.getPrescriptionById({
        tenantId: req.currentTenantId,
        prescriptionId: req.params.id,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: prescription,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateApproval(req, res, next) {
    try {
      const result = await PrescriptionService.updateApproval({
        tenantId: req.currentTenantId,
        userId: req.userId,
        prescriptionId: req.params.id,
        status: req.body.status,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: `Prescription ${result.approval_status} successfully`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await PrescriptionService.listPrescriptions({
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
