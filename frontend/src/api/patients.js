import { api } from './client.js';

// Maps to backend/src/routes/patients.js + patientValidator.js.

export const patientsApi = {
  /**
   * @param {{search?:string, page?:number, limit?:number}} query
   * @returns {Promise<{success:boolean, total:number, page:number, pages:number, data:object[]}>}
   */
  list: (query) => api.get('/patients', query),

  getById: (id) => api.get(`/patients/${id}`),

  /**
   * @param {{firstName:string,lastName?:string,email?:string,phone:string,
   *   dob:string,gender:'MALE'|'FEMALE'|'OTHER',bloodGroup?:string,address?:string,
   *   emergencyContact?:string,allergies?:string,medicalHistory?:string}} data
   */
  register: (data) => api.post('/patients', data),

  /**
   * @param {{firstName?:string,lastName?:string,phone?:string,address?:string,
   *   bloodGroup?:string,emergencyContact?:string,allergies?:string,medicalHistory?:string}} data
   */
  update: (id, data) => api.put(`/patients/${id}`, data),

  invite: (id) => api.post(`/patients/${id}/invite`),
};
