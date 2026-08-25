import { api } from './client.js';

// Maps to backend/src/routes/admissions.js + admissionValidator.js

export const admissionsApi = {
  list: (query) => api.get('/admissions', query), // {status?, page?, limit?}

  /** @param {{patientId:string, bedId?:string, admittingDoctorId?:string, diagnosis?:string}} data */
  create: (data) => api.post('/admissions', data),

  /**
   * @param {{status:'admitted'|'discharged'|'transferred'|'cancelled',
   *   dischargeDate?:string, dischargeNotes?:string}} data
   */
  updateStatus: (id, data) => api.patch(`/admissions/${id}`, data),
};

export const ADMISSION_STATUSES = ['admitted', 'discharged', 'transferred', 'cancelled'];
