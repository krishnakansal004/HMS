import { db } from '../config/db.js';
import { AppError } from '../middlewares/errorHandler.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

export class FaqService {
  static async createFaq(currentUser, faqData) {
    const isGlobalRequest = !faqData.tenantId;

    if (isGlobalRequest) {
      // RULE 1: If creating a global FAQ (tenant_id is NULL), user MUST be a System Owner
      if (currentUser.role !== 'SYSTEM_OWNER') {
        throw new AppError('Only System Administrators can create global FAQs.', HTTP_STATUS.FORBIDDEN);
      }

      return db.faq.create({
        data: {
          tenant_id: null, // Explicitly global
          created_by: currentUser.userId,
          question: faqData.question,
          answer: faqData.answer,
          category: faqData.category || 'GENERAL'
        }
      });

    } else {
      // RULE 2: If creating a Hospital FAQ, the creator MUST belong to that Hospital
      if (currentUser.tenantId !== faqData.tenantId && currentUser.role !== 'SYSTEM_OWNER') {
        throw new AppError('You cannot create resources for another hospital.', HTTP_STATUS.FORBIDDEN);
      }

      return db.faq.create({
        data: {
          tenant_id: faqData.tenantId,
          created_by: currentUser.userId,
          question: faqData.question,
          answer: faqData.answer,
          category: faqData.category || 'GENERAL'
        }
      });
    }
  }
}