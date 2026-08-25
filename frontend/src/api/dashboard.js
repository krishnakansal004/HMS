import { api } from './client.js';

export const dashboardApi = {
  // Fetches real-time aggregates
  getStats: () => api.get('/analytics/dashboard'),
  
  
  getAuditLogs: () => api.get('/analytics/audit?limit=8'),
};