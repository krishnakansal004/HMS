import { AppointmentService } from "../services/appointmentService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class AppointmentController {
  static async book(req, res, next) {
    try {
      const appointment = await AppointmentService.bookAppointment({
        tenantId: req.currentTenantId,
        userId: req.userId,
        ipAddress: req.ip,
        ...req.body,
      });

      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: "Appointment booked successfully",
        data: appointment,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const result = await AppointmentService.getAppointments({
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

  static async updateStatus(req, res, next) {
    try {
      const updatedAppointment =
        await AppointmentService.updateAppointmentStatus({
          tenantId: req.currentTenantId,
          userId: req.userId,
          appointmentId: req.params.id,
          ipAddress: req.ip,
          status: req.body.status,
          reason: req.body.reason,
        });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Appointment status updated",
        data: updatedAppointment,
      });
    } catch (error) {
      next(error);
    }
  }
}
