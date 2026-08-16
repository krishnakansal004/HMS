// Exhaustive role list, collected by grepping every requireRoles(...) call
// across backend/src/routes/*.js for the 19 live route groups.
// NOTE: backend/src/routes/directorStats.js (not in this scope) has a
// `requireRoles('director')` lowercase bug — flagged in README, not
// something the frontend can work around since role names are compared
// case-sensitively server-side.

export const ROLES = {
  SYSTEM_OWNER: 'SYSTEM_OWNER',
  DIRECTOR: 'DIRECTOR',
  HOSPITAL_ADMIN: 'HOSPITAL_ADMIN',
  RECEPTIONIST: 'RECEPTIONIST',
  DOCTOR: 'DOCTOR',
  NURSE: 'NURSE',
  PATIENT: 'PATIENT',
  ACCOUNTANT: 'ACCOUNTANT',
  CASHIER: 'CASHIER',
  HR: 'HR',
  PHARMACIST: 'PHARMACIST',
  STORE_MANAGER: 'STORE_MANAGER',
  LAB_TECHNICIAN: 'LAB_TECHNICIAN',
  RADIOLOGY_TECHNICIAN: 'RADIOLOGY_TECHNICIAN',
};

export const ROLE_LABELS = {
  SYSTEM_OWNER: 'System Owner',
  DIRECTOR: 'Director',
  HOSPITAL_ADMIN: 'Hospital Admin',
  RECEPTIONIST: 'Receptionist',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  PATIENT: 'Patient',
  ACCOUNTANT: 'Accountant',
  CASHIER: 'Cashier',
  HR: 'HR',
  PHARMACIST: 'Pharmacist',
  STORE_MANAGER: 'Store Manager',
  LAB_TECHNICIAN: 'Lab Technician',
  RADIOLOGY_TECHNICIAN: 'Radiology Technician',
};
