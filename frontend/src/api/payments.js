import { api } from './client.js';

// Maps to backend/src/routes/payments.js

export const paymentsApi = {
  /** @param {string} invoiceId @returns {Promise<{data:{orderId:string, amount:number, currency:string, keyId:string, invoiceId:string}}>} */
  initiate: (invoiceId) => api.post('/payments/initiate', { invoiceId }),
};
