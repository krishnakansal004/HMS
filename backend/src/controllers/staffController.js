import { StaffService } from "../services/staffService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class StaffController {
  static async invite(req, res, next) {
    try {
      const staff = await StaffService.inviteStaff({
        tenantId: req.currentTenantId,
        userId: req.userId,
        name: req.body.name,
        email: req.body.email,
        roleName: req.body.roleName,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message:
          "Staff invited successfully. An email has been sent with setup instructions.",
        data: { id: staff.user_id, name: staff.name, email: staff.email },
      });
    } catch (error) {
      next(error);
    }
  }
}
