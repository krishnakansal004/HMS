import { api } from './client.js';

// Maps to backend/src/routes/hrms.js + hrmsValidator.js


export const hrmsApi = {
  listStaff: (query) => api.get('/hrms/staff', query),
  inviteStaff: (data) => api.post('/staff/invite', data),
  applyLeave: (data) => api.post('/hrms/leaves', data),
  reviewLeave: (id, status) => api.patch(`/hrms/leaves/${id}/review`, { status }),
  createShift: (data) => api.post('/hrms/shifts', data),
  /** @param {{status?:'PENDING'|'APPROVED'|'REJECTED', onLeaveToday?:boolean, page?:number, limit?:number}} query */
  listLeaves: (query) => api.get('/hrms/leaves', query),
};