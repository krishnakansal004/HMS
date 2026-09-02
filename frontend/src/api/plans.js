import { api } from './client.js';

// plans.js + tenants.js + planRequests.js — SYSTEM_OWNER / DIRECTOR surface
// for provisioning new hospitals and managing subscription plans.

export const plansApi = {
  list: () => api.get('/plans'),
  /** @param {{name:string, publicFlag?:boolean, customized?:boolean, accessCode?:string, durations?:any[], prices?:object, limits?:object}} data */
  create: (data) => api.post('/plans', data),
};

export const tenantsApi = {
  /**
   * @param {{name:string, slug:string, planId:string, adminName:string,
   *   adminEmail:string, adminPassword:string}} data
   * Provisions a new hospital tenant + its first HOSPITAL_ADMIN user.
   */
  provision: (data) => api.post('/tenants/provision', data),
  list: (query) => api.get('/tenants', query),
  getById: (id) => api.get(`/tenants/${id}`),
};

export const planRequestsApi = {
  /** @param {{planId:string, period?:'monthly'|'3months'|'yearly'|'5years', requestedAmount?:number, accessCode?:string}} data */
  create: (data) => api.post('/plan-requests', data),
  list: () => api.get('/plan-requests'),
  /** @param {'approved'|'rejected'} status */
  review: (id, status) => api.patch(`/plan-requests/${id}/review`, { status }),
};

export const PLAN_PERIODS = ['monthly', '3months', 'yearly', '5years'];
