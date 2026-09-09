import { api } from './client.js';

// Maps to backend/src/routes/radiology.js + radiologyValidator.js

export const radiologyApi = {
  /**
   * @param {{patientId:string, doctorProfileId?:string, modality:string, studyType:string,
   *   bodyPart?:string, urgency?:'routine'|'urgent'|'stat', price:number, notes?:string}} data
   */
  createOrder: (data) => api.post('/radiology/orders', data),

  /**
   * @param {{status:'ordered'|'scheduled'|'scanning'|'completed'|'cancelled',
   *   findings?:string, impression?:string, scanMetadata?:object, invoiceId?:string}} data
   */
  updateStatus: (id, data) => api.patch(`/radiology/orders/${id}/status`, data),

  listOrders: (query) => api.get('/radiology/orders', query),
};

export const RADIOLOGY_STATUSES = ['ordered', 'scheduled', 'in_progress', 'completed', 'cancelled'];
export const RADIOLOGY_URGENCY = ['routine', 'urgent', 'stat'];
