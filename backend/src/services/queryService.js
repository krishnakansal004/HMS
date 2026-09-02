import { QueryRepository } from "../repositories/queryRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class QueryService {
  static async submit({ tenantId, name, email, phone, message }) {
    // No AuditService call here -- this is a public, unauthenticated
    // submission, there's no acting user to attribute the action to.
    return QueryRepository.createPublic({
      tenantId,
      name,
      email,
      phone,
      message,
    });
  }

  static async updateStatus({ tenantId, userId, queryId, status, ipAddress }) {
    const updated = await QueryRepository.updateStatus(
      queryId,
      tenantId,
      status,
    );
    if (!updated) throw new AppError("Query not found.", HTTP_STATUS.NOT_FOUND);

    AuditService.logAction({
      tenantId,
      userId,
      action: "UPDATE_QUERY_STATUS",
      entityType: "QUERY",
      entityId: queryId,
      newValue: { status },
      ipAddress,
    });

    return updated;
  }

  static async list({ tenantId, query }) {
    const { status, page = 1, limit = 50 } = query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, data] = await QueryRepository.findManyPaginated({
      tenantId,
      status,
      skip,
      take,
    });
    return { total, page: Number(page), pages: Math.ceil(total / take), data };
  }
}
