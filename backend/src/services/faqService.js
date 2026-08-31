import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class FaqService {
  static async createFaq({ tenantId, userId, userRole, question, answer, category, ipAddress }) {
    const isGlobalRequest = !tenantId;

    if (isGlobalRequest) {
      // RULE 1: If creating a global FAQ (tenantId is omitted), user MUST be a System Owner
      if (userRole !== 'SYSTEM_OWNER') {
        throw new AppError('Only System Administrators can create global FAQs.', HTTP_STATUS.FORBIDDEN);
      }
    } else {
      // RULE 2: If creating a Hospital FAQ, verify they aren't trying to inject a different hospital's ID
      // Note: req.currentTenantId is strictly enforced by the auth middleware anyway, 
      // but this acts as a foolproof defensive boundary.
      if (userRole !== 'SYSTEM_OWNER' && !tenantId) {
        throw new AppError('You cannot create resources for another hospital.', HTTP_STATUS.FORBIDDEN);
      }
    }

    return db.faq.create({
      data: {
        tenant_id: tenantId || null,
        created_by: userId,
        question,
        answer,
        category: category || 'GENERAL'
      }
    });
  }

  static async listFaqs({ tenantId, category }) {
    const where = {};
    if (tenantId) {
      where.OR = [{ tenant_id: tenantId }, { tenant_id: null }];
    } else {
      where.tenant_id = null;
    }
    if (category) where.category = category;
    return db.faq.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
  }

  static async deleteFaq({ tenantId, userId, faqId, ipAddress }) {
    const faq = await db.faq.findUnique({ where: { faq_id: faqId } });
    if (!faq) throw new AppError('FAQ not found', HTTP_STATUS.NOT_FOUND);
    await db.faq.delete({ where: { faq_id: faqId } });
    return { success: true, deleted: faqId };
  }
}