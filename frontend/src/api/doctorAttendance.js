import { api } from './client.js';

export const doctorAttendanceApi = {
  checkIn: (data) => api.post('/doctor-attendance/check-in', data || {}),
  checkOut: (data) => api.post('/doctor-attendance/check-out', data || {}),
  
  // Admin/HR only: Mark absent, half_day, on_leave
  setStatus: (data) => api.post('/doctor-attendance/status', data),
  
  list: (query) => api.get('/doctor-attendance', query),
};

export const DOCTOR_ATTENDANCE_STATUSES = ['present', 'absent', 'half_day', 'on_leave'];