import { DocumentRepository } from "../repositories/documentRepository.js";
import { AuditService } from "./auditService.js";
import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

const ALLOWED_ENTITY_TYPES = [
  "PATIENT",
  "INVOICE",
  "PRESCRIPTION",
  "RADIOLOGY_ORDER",
  "LAB_ORDER",
  "PLAN_REQUEST",
  "PLAN_RECEIPT",
  "PAYMENT",
];

export class DocumentService {
  static async registerDocument({
    tenantId,
    userId,
    entityType,
    entityId,
    url,
    publicId,
    mimeType,
    sizeBytes,
    ipAddress,
  }) {
    if (!ALLOWED_ENTITY_TYPES.includes(entityType)) {
      throw new AppError(
        `Unsupported entity type: ${entityType}`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const document = await DocumentRepository.create({
      tenantId,
      entityType,
      entityId,
      uploadedBy: userId,
      url,
      publicId,
      mimeType,
      sizeBytes,
    });

    AuditService.logAction({
      tenantId,
      userId,
      action: "REGISTER_DOCUMENT",
      entityType: "DOCUMENT",
      entityId: document.document_id,
      newValue: { attachedTo: `${entityType}:${entityId}`, mimeType },
      ipAddress,
    });

    return document;
  }

  static async listForEntity({ tenantId, entityType, entityId }) {
    return DocumentRepository.findByEntity({ tenantId, entityType, entityId });
  }

  static async deleteDocument({ tenantId, userId, userRole, documentId, ipAddress }) {
    const existing = await DocumentRepository.findByIdAndTenant(
      documentId,
      tenantId,
    );
    if (!['HOSPITAL_ADMIN', 'DIRECTOR', 'SYSTEM_OWNER'].includes(userRole)) {
    if (existing.uploaded_by !== userId) {
      throw new AppError("Unauthorized. You can only delete your own documents.", HTTP_STATUS.FORBIDDEN);
    }
  }
    if (!existing)
      throw new AppError("Document not found.", HTTP_STATUS.NOT_FOUND);

    await DocumentRepository.deleteByIdAndTenant(documentId, tenantId);

    AuditService.logAction({
      tenantId,
      userId,
      action: "DELETE_DOCUMENT",
      entityType: "DOCUMENT",
      entityId: documentId,
      oldValue: {
        attachedTo: `${existing.entity_type}:${existing.entity_id}`,
        url: existing.url,
      },
      ipAddress,
    });

    return { success: true };
  }
}
