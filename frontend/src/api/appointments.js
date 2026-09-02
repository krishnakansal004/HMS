import { api } from './client.js';

// Maps to backend/src/routes/appointments.js + appointmentValidator.js

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
