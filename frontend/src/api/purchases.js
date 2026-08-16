import { api } from './client.js';

// Maps to backend/src/routes/purchases.js + purchaseValidator.js

export const purchasesApi = {
  /** @param {{supplierId?:string, status?:string, page?:number, limit?:number}} query */
  list: (query) => api.get('/purchases', query),

  /**
   * @param {{supplierId:string, orderId?:string, orderDate?:string, items: Array<{
   *   medicineId:string, quantity:number, unitCost:number}>}} data
   */
  create: (data) => api.post('/purchases', data),

  /** @param {'pending'|'ordered'|'received'|'completed'|'cancelled'} status */
  updateStatus: (id, status) => api.patch(`/purchases/${id}/status`, { status }),
};

export const PURCHASE_STATUSES = ['pending', 'ordered', 'received', 'completed', 'cancelled'];
