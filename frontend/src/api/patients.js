import { api } from './client.js';

// Maps to backend/src/routes/patients.js + patientValidator.js.
//
// emergencyContact/allergies/medicalHistory are now safe to send on both
// register and update — migration 0041 added the missing columns and
// patientService.js persists them on create (it previously silently
// dropped them) and update (it already wrote them, but 500'd since the
// columns didn't exist). See README "Fixed backend gaps" for the history.

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
};
