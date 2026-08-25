import { AvailabilityService } from "../services/availabilityService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class AvailabilityController {
  static async get(req, res, next) {
    try {
      const availability = await AvailabilityService.getDoctorAvailability({
        tenantId: req.currentTenantId,
        doctorId: req.params.doctorId,
      });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: availability,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req, res, next) {
    try {
      const updatedAvailability =
        await AvailabilityService.updateDoctorAvailability({
          tenantId: req.currentTenantId,
          requestingUserId: req.userId,
          requestingUserRole: req.userRole,
          doctorId: req.params.doctorId,
          days: req.body.days,
          exceptions: req.body.exceptions,
          ipAddress: req.ip,
        });

      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: "Doctor availability updated successfully",
        data: updatedAvailability,
      });
    } catch (error) {
      next(error);
    }
  }
}
