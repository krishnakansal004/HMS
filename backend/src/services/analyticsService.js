import { db } from '../config/db.js';

export class AnalyticsService {
  
  static async getDirectorDashboardStats(tenantId) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [
      totalPatients,
      activeAdmissions,
      todayAppointments,
      totalRevenueRaw,
      pendingClaims
    ] = await db.$transaction([
      db.patient.count({ where: { tenant_id: tenantId, deleted_at: null } }),
      db.admission.count({ where: { tenant_id: tenantId, status: 'ADMITTED' } }),
      db.appointment.count({ where: { tenant_id: tenantId, slot_start: { gte: today } } }),
      db.invoice.aggregate({ where: { tenant_id: tenantId, status: 'paid' }, _sum: { total: true } }),
      db.insurance_claim.count({ where: { tenant_id: tenantId, status: 'submitted' } })
    ]);

    const totalRevenue = Number(totalRevenueRaw._sum.total || 0);

    return {
      totalPatients,
      activeAdmissions,
      todayAppointments,
      totalRevenue, // in minor currency
      pendingClaims,
      timestamp: new Date().toISOString()
    };
  }
}