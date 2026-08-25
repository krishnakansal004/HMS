import { api } from './client.js';

export const doctorApplicationsApi = {
  /** @param {{tenantId:string, name:string, email:string, phone?:string, specialization:string, department?:string, yearsExperience?:number, message?:string}} data */
  submit: (data) => api.post('/doctor-applications', data),
  
  /** @param {{status?:'PENDING'|'APPROVED'|'REJECTED', page?:number, limit?:number}} query */
  list: (query) => api.get('/doctor-applications', query),
  
  /** @param {'APPROVED'|'REJECTED'} status */
  review: (id, status) => api.patch(`/doctor-applications/${id}/review`, { status }),
};

export const APPLICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];