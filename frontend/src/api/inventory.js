import { api } from './client.js';

// Maps to backend/src/routes/inventory.js + inventoryValidator.js

export const inventoryApi = {
  /** @param {{search?:string, category?:string, lowStock?:boolean, expiringWithinDays?:number, page?:number, limit?:number}} query */
  list: (query) => api.get('/inventory/medicines', query),

  /**
   * @param {{supplierId:string, sku:string, name:string, category:string,
   *   batchNumber:string, expiryDate:string, purchasePrice:number,
   *   sellingPrice:number, initialStock?:number, minimumStock?:number}} data
   */
  create: (data) => api.post('/inventory/medicines', data),

  /** @param {{quantity:number, prescriptionId?:string, notes?:string}} data */
  dispense: (id, data) => api.post(`/inventory/medicines/${id}/dispense`, data),

  /** @param {{quantity:number, purchaseOrderId?:string, notes?:string}} data */
  receive: (id, data) => api.post(`/inventory/medicines/${id}/receive`, data),
};
