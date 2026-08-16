import { api } from './client.js';

// Maps to backend/src/routes/attendance.js + attendanceValidator.js

export const attendanceApi = {
  checkIn: (targetUserId) => api.post('/attendance/check-in', targetUserId ? { targetUserId } : {}),
  checkOut: (targetUserId) => api.post('/attendance/check-out', targetUserId ? { targetUserId } : {}),

  /** @param {{userId?:string, startDate?:string, endDate?:string, status?:'PRESENT'|'LEAVE'|'HALF_DAY', page?:number, limit?:number}} query */
  list: (query) => api.get('/attendance', query),
};

export const ATTENDANCE_STATUSES = ['PRESENT', 'LEAVE', 'HALF_DAY'];
