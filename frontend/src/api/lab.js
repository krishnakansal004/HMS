import { api } from './client.js';

// Maps to backend/src/routes/lab.js + labValidator.js

export const labApi = {
  /** @param {{name:string, code:string, category?:string, sampleType?:string, price:number, referenceRange?:string}} data */
  addCatalogTest: (data) => api.post('/lab/catalog', data),

  /** @param {{patientId:string, testId:string, doctorProfileId?:string, prescriptionId?:string}} data */
  createOrder: (data) => api.post('/lab/orders', data),

  /**
   * @param {{sampleStatus:'pending'|'collected'|'processing'|'completed'|'cancelled',
   *   technicianNotes?:string, results?:object, invoiceId?:string}} data
   */
  updateResults: (id, data) => api.patch(`/lab/orders/${id}/results`, data),

  /** @param {{patientId?:string, status?:string, page?:number, limit?:number}} query */
  listOrders: (query) => api.get('/lab/orders', query),
};

export const LAB_ORDER_STATUSES = ['pending', 'collected', 'processing', 'completed', 'cancelled'];
