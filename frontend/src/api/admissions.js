import { api } from './client.js';

// Maps to backend/src/routes/admissions.js + admissionValidator.js
//
// There was no `admission` table at all until migration 0043 — the
// backend repository code called db.admission.* assuming one existed,
// which would have failed on every request. Table now exists, status is
// lowercase (matching the schema-wide convention, and admitPatient() is
// now correctly wrapped in a transaction (bed lock + admission create
// used to be two separate writes — a failure between them could leave a
// bed stuck as occupied with no admission record). See HMS_ROADMAP.md A4.

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
