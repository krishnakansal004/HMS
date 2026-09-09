import { db } from "../config/db.js";
import { queryAcrossTenants } from "../config/systemOwnerRawClient.js";
export class AnalyticsService {
  static async getDirectorDashboardStats(tenantId) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Use interactive transaction to safely bypass the RLS array-batch proxy limitations
    return db.$transaction(async (tx) => {
      const [
        totalPatients,
        activeAdmissions,
        todayAppointments,
        totalRevenueRaw,
        pendingClaims,
      ] = await Promise.all([
        tx.patient.count({ where: { tenant_id: tenantId, deleted_at: null } }),
        tx.admission.count({
          where: { tenant_id: tenantId, status: "admitted" },
        }),
        tx.appointment.count({
          where: { tenant_id: tenantId, slot_start: { gte: today } },
        }),
        tx.invoice.aggregate({
          where: { tenant_id: tenantId, status: "paid" },
          _sum: { total: true },
        }),
        tx.insurance_claim.count({
          where: { tenant_id: tenantId, status: "submitted" },
        }),
      ]);

      const totalRevenue = Number(totalRevenueRaw._sum.total || 0);

      return {
        totalPatients,
        activeAdmissions,
        todayAppointments,
        totalRevenue, // in minor currency
        pendingClaims,
        timestamp: new Date().toISOString(),
      };
    });
  }
  
  static async getPlatformStats() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return queryAcrossTenants('SYSTEM_OWNER', async (tx) => {
    const tenants = await tx.tenant.groupBy({
      by: ['status'],
      _count: { tenant_id: true }
    });
      
      let totalTenants = 0, activeTenants = 0, suspendedTenants = 0;
      tenants.forEach(t => {
        totalTenants += t._count.tenant_id;
        if (t.status === 'active') activeTenants = t._count.tenant_id;
        if (t.status === 'suspended') suspendedTenants = t._count.tenant_id;
      });

     const pendingRequests = await tx.plan_request.count({ where: { status: 'pending' } });
     const revenue = await tx.plan_receipt.aggregate({
      where: { paid_at: { gte: thirtyDaysAgo } },
      _sum: { total: true }
    });

      const plans = await tx.plan.findMany({
        select: { plan_id: true, name: true, _count: { select: { tenant: true } } }
      });
      const planDistribution = plans.map(p => ({
        planId: p.plan_id,
        planName: p.name,
        tenantCount: p._count.tenant
      }));

      return {
      totalTenants, activeTenants, suspendedTenants,
      pendingPlanRequests: pendingRequests,
      platformRevenueLast30d: Number(revenue._sum.total || 0),
      planDistribution
    };
    });
  }
}
