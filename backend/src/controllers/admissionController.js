import { AdmissionService } from "../services/admissionService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class AdmissionController {
  static async admit(req, res, next) {
    try {
      const admission = await AdmissionService.admitPatient({
        tenantId: req.currentTenantId,
        userId: req.userId,
        ...req.body,
        ipAddress: req.ip,
      });
      res
        .status(HTTP_STATUS.CREATED)
        .json({
          success: true,
          message: "Patient admitted successfully",
          data: admission,
        });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const admission = await AdmissionService.updateAdmission({
        tenantId: req.currentTenantId,
        userId: req.userId,
        admissionId: req.params.id,
        ...req.body,
        ipAddress: req.ip,
      });
      res
        .status(HTTP_STATUS.OK)
        .json({
          success: true,
          message: "Admission status updated successfully",
          data: admission,
        });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await AdmissionService.getAdmissions({
        tenantId: req.currentTenantId,
        query: req.query,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}
