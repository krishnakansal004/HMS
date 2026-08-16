import { api } from './client.js';

// Maps 1:1 to backend/src/routes/auth.js (only 3 live endpoints — no
// /refresh, no /csrf. See README "Known backend gaps".)

export const authApi = {
  /**
   * @param {{firstName:string,lastName:string,email:string,password:string,
   *   phone:string,gender:'MALE'|'FEMALE'|'OTHER',dob:string,hospitalSlug:string}} data
   * Self-service patient signup only — staff accounts are provisioned by
   * a HOSPITAL_ADMIN / DIRECTOR, there is no public staff registration.
   */
  register: (data) => api.post('/auth/register', data),

  /**
   * @param {{email:string, password:string, hospitalSlug?:string}} data
   * hospitalSlug is required for every role except SYSTEM_OWNER.
   */
  login: (data) => api.post('/auth/login', data),

  logout: () => api.post('/auth/logout'),
};
