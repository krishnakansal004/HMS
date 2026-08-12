import { db } from '../config/db.js';
import { AuditService } from './auditService.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class FaqService {
  static async createFaq({ tenantId, userId, question, answer, category, ipAddress }) {
    const faq = await db.faq.create({
      data: {
        tenant_id: tenantId || null, // Can be global or tenant-specific
        question,
        answer,
        category: category || 'GENERAL',
        created_by: userId
      }
    });

    AuditService.logAction({
      tenantId: tenantId || 'GLOBAL',
      userId,
      action: 'CREATE_FAQ',
      entityType: 'FAQ',
      entityId: faq.faq_id,
      newValue: { question, category },
      ipAddress
    });

    return faq;
  }

  static async listFaqs({ tenantId, category }) {
    const where = {
      OR: [
        { tenant_id: tenantId },
        { tenant_id: null } // Global FAQs
      ]
    };
    if (category) where.category = category;

    return db.faq.findMany({
      where,
      orderBy: { created_at: 'desc' }
    });
  }

  static async deleteFaq({ tenantId, userId, faqId, ipAddress }) {
    const faq = await db.faq.findUnique({ where: { faq_id: faqId } });
    if (!faq) throw new AppError('FAQ not found.', HTTP_STATUS.NOT_FOUND);

    await db.faq.delete({ where: { faq_id: faqId } });

    AuditService.logAction({
      tenantId: tenantId || 'GLOBAL',
      userId,
      action: 'DELETE_FAQ',
      entityType: 'FAQ',
      entityId: faqId,
      oldValue: { question: faq.question },
      ipAddress
    });

    return { faq_id: faqId, deleted: true };
  }
}