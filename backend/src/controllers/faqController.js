import { FaqService } from "../services/faqService.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

export class FaqController {
  static async create(req, res, next) {
    try {
      const faq = await FaqService.createFaq({
        tenantId: req.currentTenantId,
        userId: req.userId,
        ...req.body,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.CREATED).json({ success: true, data: faq });
    } catch (error) {
      next(error);
    }
  }

  static async list(req, res, next) {
    try {
      const faqs = await FaqService.listFaqs({
        tenantId: req.currentTenantId,
        category: req.query.category,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, data: faqs });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req, res, next) {
    try {
      const result = await FaqService.deleteFaq({
        tenantId: req.currentTenantId,
        userId: req.userId,
        faqId: req.params.id,
        ipAddress: req.ip,
      });
      res.status(HTTP_STATUS.OK).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
