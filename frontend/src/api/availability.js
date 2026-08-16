import { api } from './client.js';

// Maps to backend/src/routes/availability.js + availabilityValidator.js

export const availabilityApi = {
  getByDoctor: (doctorId) => api.get(`/availability/${doctorId}`),

  /**
   * @param {{days: Array<{dayOfWeek:number, enabled:boolean, startTime:string,
   *   endTime:string, slotDurationMin:number}>, exceptions?: Array<{date:string,
   *   enabled:boolean, startTime?:string, endTime?:string}>}} data
   * `days` MUST contain exactly 7 entries (0=Sun..6=Sat), times as 'HH:mm'.
   */
  setByDoctor: (doctorId, data) => api.put(`/availability/${doctorId}`, data),
};

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
