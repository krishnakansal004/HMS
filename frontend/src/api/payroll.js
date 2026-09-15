import { api } from './client.js';

export const payrollApi = {
  listCompensation: () => api.get('/payroll/compensation'),
  setCompensation: (userId, data) => api.put(`/payroll/compensation/${userId}`, data),
  createRun: (month) => api.post('/payroll/runs', { month }),
  listRuns: (query) => api.get('/payroll/runs', query),
  getRun: (id) => api.get(`/payroll/runs/${id}`),
  updateAdjustments: (runId, itemId, data) => api.patch(`/payroll/runs/${runId}/items/${itemId}`, data),
  freezeRun: (runId) => api.post(`/payroll/runs/${runId}/freeze`, {}),
  markPaid: (runId, itemId) => api.post(`/payroll/runs/${runId}/pay/${itemId}`, {}),
  markAllPaid: (runId) => api.post(`/payroll/runs/${runId}/pay-all`, {}),
  listPayslips: (query) => api.get('/payroll/payslips', query),
};
