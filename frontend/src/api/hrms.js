import { api } from './client.js';

// Maps to backend/src/routes/hrms.js + hrmsValidator.js


export const hrmsApi = {
  listStaff: (query) => api.get('/hrms/staff', query),
  applyLeave: (data) => api.post('/hrms/leaves', data),
  reviewLeave: (id, status) => api.patch(`/hrms/leaves/${id}/review`, { status }),
  createShift: (data) => api.post('/hrms/shifts', data),
};