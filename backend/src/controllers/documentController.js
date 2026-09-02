import { DocumentService } from "../services/documentService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class DocumentController {
  static async register(req, res, next) {
    try {
      const document = await DocumentService.registerDocument({
        tenantId: req.currentTenantId,
        userId: req.userId,
        ...req.body,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.CREATED).json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  }

  static async listForEntity(req, res, next) {
    try {
      const documents = await DocumentService.listForEntity({
        tenantId: req.currentTenantId,
        entityType: req.query.entityType,
        entityId: req.query.entityId,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, data: documents });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      await DocumentService.deleteDocument({
        tenantId: req.currentTenantId,
        userId: req.userId,
        documentId: req.params.id,
        ipAddress: req.ip,
      });
      res
        .status(HTTP_STATUS.OK)
        .json({ success: true, message: "Document removed." });
    } catch (error) {
      next(error);
    }
  }
}
