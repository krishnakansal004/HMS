import { db } from "../config/db.js";

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
        }), // Fixed lowercase to match DB CHECK constraint
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
}
