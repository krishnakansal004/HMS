import { CustomizationRequestRepository } from "../repositories/customizationRequestRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class CustomizationRequestService {
  static async submit(data) {
    // Public, unauthenticated submission -- no acting user to audit-log.
    return CustomizationRequestRepository.createPublic(data);
  }

  static async updateStatus({
    tenantId,
    userId,
    requestId,
    status,
    ipAddress,
  }) {
    const updated = await CustomizationRequestRepository.updateStatus(
      requestId,
      tenantId,
      status,
    );
    if (!updated)
      throw new AppError(
        "Customization request not found.",
        HTTP_STATUS.NOT_FOUND,
      );

    AuditService.logAction({
      tenantId,
      userId,
      action: "UPDATE_CUSTOMIZATION_REQUEST_STATUS",
      entityType: "CUSTOMIZATION_REQUEST",
      entityId: requestId,
      newValue: { status },
      ipAddress,
    });

    return updated;
  }

  static async list({ tenantId, query }) {
    const { status, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, data] =
      await CustomizationRequestRepository.findManyPaginated({
        tenantId,
        status,
        skip,
        take,
      });
    return { total, page: Number(page), pages: Math.ceil(total / take), data };
  }
}
