import { db } from '../config/db.js';

export class EmergencyRepository {
  static async logAmbulanceDispatch(tenantId, data) {
    return db.ambulance_dispatch.create({ data: { tenant_id: tenantId, ...data } });
  }
  static async scheduleOt(tenantId, data) {
    return db.operation_theater.create({ data: { tenant_id: tenantId, ...data } });
  }
}