import { api } from './client.js';

// Maps to backend/src/routes/prescriptions.js + prescriptionValidator.js

export const prescriptionsApi = {
  /**
   * @param {{patientId:string, doctorProfileId:string, appointmentId?:string,
   *   diagnosis:string, instructions?:string, items: Array<{medicineName:string,
   *   dosage:string, frequency:string, durationDays:number, instructions?:string}>}} data
   */
  create: (data) => api.post('/prescriptions', data),

  /** @param {{patientId?:string, doctorId?:string, page?:number, limit?:number}} query */
  list: (query) => api.get('/prescriptions', query),

  getById: (id) => api.get(`/prescriptions/${id}`),

  /** @param {'approved'|'rejected'} status */
  setApproval: (id, status) => api.patch(`/prescriptions/${id}/approval`, { status }),
};
