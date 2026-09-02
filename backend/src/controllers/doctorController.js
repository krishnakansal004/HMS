import { DoctorService } from "../services/doctorService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class DoctorController {
  static async create(req, res, next) {
    try {
      const doctor = await DoctorService.createDoctor({
        tenantId: req.currentTenantId,
        userId: req.userId,
        data: req.body,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Doctor registered successfully",
        data: doctor,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await DoctorService.listDoctors({
        tenantId: req.currentTenantId,
        query: req.query,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const doctor = await DoctorService.updateDoctor({
        tenantId: req.currentTenantId,
        doctorId: req.params.id,
        data: req.body,
        userId: req.userId,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, data: doctor });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      // Pass the ?hard=true query parameter to determine soft vs hard delete
      const isHardDelete = String(req.query.hard).toLowerCase() === "true";
      await DoctorService.deleteDoctor({
        tenantId: req.currentTenantId,
        doctorId: req.params.id,
        hard: isHardDelete,
        userId: req.userId,
        ipAddress: req.ip,
      });
      res
        .status(HTTP_STATUS.OK)
        .json({ success: true, message: "Doctor deleted successfully" });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req, res, next) {
    try {
      const doctor = await DoctorService.getDoctorById({
        tenantId: req.currentTenantId,
        doctorId: req.params.id,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, data: doctor });
    } catch (error) {
      next(error);
    }
  }
}
