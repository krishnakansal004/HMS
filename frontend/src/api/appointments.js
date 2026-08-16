import { api } from './client.js';

// Maps to backend/src/routes/appointments.js + appointmentValidator.js
//
// Status/type values are lowercase, matching chk_appointment_status /
// chk_appointment_type in migration 0042. Previously uppercase here (and
// in the backend validator/service/repository) while the DB was always
// lowercase — confirmed via a full migration dry-run that every value
// this module sent failed the DB constraint on every real request, plus
// two parameter-order bugs in appointmentService/appointmentRepository
// that made status updates 404 even before reaching the casing issue.
// All fixed together — see HMS_ROADMAP.md A3 for the full trace.

export const appointmentsApi = {
  /**
   * @param {{doctorId?:string, patientId?:string, date?:string, status?:string, page?:number, limit?:number}} query
   */
  list: (query) => api.get('/appointments', query),

  /**
   * @param {{doctorId:string, patientId:string, startTime:string, endTime:string,
   *   type:'online'|'walk_in', notes?:string}} data ISO 8601 datetimes.
   */
  create: (data) => api.post('/appointments', data),

  /**
   * @param {'confirmed'|'checked_in'|'in_progress'|'completed'|'cancelled'|'no_show'} status
   */
  updateStatus: (id, status, reason) =>
    api.patch(`/appointments/${id}/status`, { status, ...(reason ? { reason } : {}) }),
};

export const APPOINTMENT_STATUSES = [
  'confirmed',
  'checked_in',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
];
