import { api } from './client.js';

// Plan catalog, hospital onboarding, and subscription request APIs.

export const plansApi = {
  list: () => api.get('/plans'),
  publicList: () => api.get('/plans/public'),
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
  adminProvision: (data) => api.post('/tenants/admin-provision', data),
  verifyProvisionPayment: (data) => api.post('/tenants/provision/verify-payment', data),
  list: (query) => api.get('/tenants', query),
  getById: (id) => api.get(`/tenants/${id}`),
  updateStatus: (id, status) => api.patch(`/tenants/${id}/status`, { status }),
};

export const planRequestsApi = {
  /** @param {{planId:string, period?:'monthly'|'3months'|'yearly'|'5years', requestedAmount?:number, accessCode?:string}} data */
  create: (data) => api.post('/plan-requests', data),
  list: () => api.get('/plan-requests'),
  /** @param {'approved'|'rejected'} status */
  review: (id, status) => api.patch(`/plan-requests/${id}/review`, { status }),
};

export const PLAN_PERIODS = ['monthly', '3months', 'yearly', '5years'];
