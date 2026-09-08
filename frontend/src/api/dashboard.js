import { api } from './client.js';

export const dashboardApi = {
  // Fetches real-time aggregates (Director, System Owner, Hospital Admin)
  getStats: () => api.get('/analytics/dashboard'),

  // Cross-tenant platform rollup (System Owner only)
  getPlatformStats: () => api.get('/analytics/platform'),

  getAuditLogs: () => api.get('/analytics/audit?limit=8'),
};