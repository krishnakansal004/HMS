import { api } from './client.js';

// Maps to backend/src/routes/invoices.js + invoiceValidator.js
// Money fields are integers in minor currency units (paise), per the
// validator (`isInt`, comment "in minor currency") — never send/display
// floats for amount/discount/unitPrice. Format with formatPaise() in
// src/utils/format.js.

export const invoicesApi = {
  getPatientCharges: (patientId) => api.get('/invoices/charges', { patientId }),
  /**
   * @param {{patientId:string, discount?:number, taxRate?:number, items: Array<{
   *   entityType:'CONSULTATION'|'MEDICINE'|'LAB'|'RADIOLOGY'|'ROOM'|'OTHER',
   *   entityId?:string, description:string, quantity:number, unitPrice:number}>}} data
   */
  create: (data) => api.post('/invoices', data),

  /** @param {{amount:number, method:'CASH'|'UPI'|'CARD'|'INSURANCE'|'CHEQUE', transactionId?:string}} data */
  pay: (id, data) => api.post(`/invoices/${id}/pay`, data),

  /** @param {{patientId?:string, status?:'DRAFT'|'PENDING'|'PARTIAL'|'PAID'|'CANCELLED', page?:number, limit?:number}} query */
  list: (query) => api.get('/invoices', query),

  /** Outstanding dues total + today's collected total, for billing-role dashboards. */
  getSummary: () => api.get('/invoices/summary'),
};

// paymentsApi lives in ./payments.js only now.

export const INVOICE_STATUSES = ['draft', 'pending', 'partial', 'paid', 'cancelled'];
export const INVOICE_ITEM_TYPES = ['CONSULTATION', 'MEDICINE', 'LAB', 'RADIOLOGY', 'ROOM', 'OTHER'];
export const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'INSURANCE', 'CHEQUE'];
