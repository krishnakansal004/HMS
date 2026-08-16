import { api } from './client.js';

// Maps to backend/src/routes/insurance.js + insuranceValidator.js

export const insuranceApi = {
  listCompanies: () => api.get('/insurance/companies'),

  /** @param {{name:string, code:string, contactPerson?:string, email?:string, phone?:string, corporateDiscount?:number}} data */
  createCompany: (data) => api.post('/insurance/companies', data),

  /** @param {{patientId?:string, status?:string, page?:number, limit?:number}} query */
  listClaims: (query) => api.get('/insurance/claims', query),

  /**
   * @param {{patientId:string, companyId:string, policyNumber:string,
   *   totalBillAmount:number, claimedAmount:number, invoiceId?:string}} data
   */
  createClaim: (data) => api.post('/insurance/claims', data),

  /**
   * @param {{status:'submitted'|'under_review'|'approved'|'rejected'|'settled',
   *   approvedAmount?:number, rejectionReason?:string, settlementDate?:string}} data
   */
  updateClaim: (id, data) => api.patch(`/insurance/claims/${id}`, data),
};

export const CLAIM_STATUSES = ['submitted', 'under_review', 'approved', 'rejected', 'settled'];
