import { db, tenantStorage } from '../config/db.js';

export class QueryRepository {

  // Public submission -- tenantId may be null (general inquiry) or a real
  // tenant chosen from the marketing site's hospital picker. Either way,
  // this needs an explicit tenant context set for the write to pass RLS's
  // WITH CHECK (migration 0058) -- there's no `protect`/`requireTenant`
  // middleware on this path to have done it already, same reasoning as
  // the payment webhook fix.
  static async createPublic({ tenantId, name, email, phone, message }) {
    const run = (fn) => tenantId ? tenantStorage.run({ tenantId }, fn) : fn();
    return run(() =>
      db.query.create({
        data: { tenant_id: tenantId || null, name, email, phone: phone || null, message, status: 'NEW' }
      })
    );
  }

  static async findByIdAndTenant(queryId, tenantId) {
    return db.query.findFirst({ where: { query_id: queryId, tenant_id: tenantId } });
  }

  static async updateStatus(queryId, tenantId, status) {
    const result = await db.query.updateMany({
      where: { query_id: queryId, tenant_id: tenantId },
      data: { status, updated_at: new Date() }
    });
    if (result.count === 0) return null;
    return this.findByIdAndTenant(queryId, tenantId);
  }

  static async findManyPaginated({ tenantId, status, skip, take }) {
    const where = { tenant_id: tenantId };
    if (status) where.status = status;

    return db.$transaction(async (tx) => {
      const [total, queries] = await Promise.all([
        tx.query.count({ where }),
        tx.query.findMany({ where, skip, take, orderBy: { created_at: 'desc' } })
      ]);
      return [total, queries];
    });
  }
}
