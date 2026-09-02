import { db, tenantStorage } from '../config/db.js';

export class CustomizationRequestRepository {

  static async createPublic({ tenantId, title, description, requesterName, requesterEmail, requesterPhone, requesterAddress, company, purpose, priceRange, period, acceptanceText, agreed }) {
    const run = (fn) => tenantId ? tenantStorage.run({ tenantId }, fn) : fn();
    return run(() =>
      db.customization_request.create({
        data: {
          tenant_id: tenantId || null,
          title,
          description: description || null,
          requester_name: requesterName || null,
          requester_email: requesterEmail || null,
          requester_phone: requesterPhone || null,
          requester_address: requesterAddress || null,
          company: company || null,
          purpose: purpose || null,
          price_range: priceRange || null,
          period: period || null,
          acceptance_text: acceptanceText || null,
          agreed: !!agreed,
          status: 'NEW'
        }
      })
    );
  }

  static async findByIdAndTenant(requestId, tenantId) {
    return db.customization_request.findFirst({ where: { request_id: requestId, tenant_id: tenantId } });
  }

  static async updateStatus(requestId, tenantId, status) {
    const result = await db.customization_request.updateMany({
      where: { request_id: requestId, tenant_id: tenantId },
      data: { status, updated_at: new Date() }
    });
    if (result.count === 0) return null;
    return this.findByIdAndTenant(requestId, tenantId);
  }

  static async findManyPaginated({ tenantId, status, skip, take }) {
    const where = { tenant_id: tenantId };
    if (status) where.status = status;

    return db.$transaction(async (tx) => {
      const [total, requests] = await Promise.all([
        tx.customization_request.count({ where }),
        tx.customization_request.findMany({ where, skip, take, orderBy: { created_at: 'desc' } })
      ]);
      return [total, requests];
    });
  }
}
