import { PatientService } from "../services/patientService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class PatientController {
  static async register(req, res, next) {
    try {
      const patient = await PatientService.registerPatient({
        tenantId: req.currentTenantId,
        userId: req.userId,
        data: req.body,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Patient registered successfully",
        data: patient,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const patient = await PatientService.getPatientById({
        tenantId: req.currentTenantId,
        userId: req.userId,
        userRole: req.userRole,
        patientId: req.params.id,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: patient,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const patient = await PatientService.updatePatient({
        tenantId: req.currentTenantId,
        userId: req.userId,
        patientId: req.params.id,
        data: req.body,
        ipAddress: req.ip,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Patient profile updated successfully",
        data: patient,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await PatientService.listPatients({
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
