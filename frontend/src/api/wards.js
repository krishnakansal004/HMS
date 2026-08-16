import { api } from './client.js';

// Maps to backend/src/routes/wards.js + wardBedValidator.js

export const wardsApi = {
  list: () => api.get('/wards'),

  /** @param {{name:string, type:string, floor?:string, capacity:number, pricePerDay:number}} data */
  create: (data) => api.post('/wards', data),

  /** @param {{bedNumber:string, pricePerDay?:number}} data */
  addBed: (wardId, data) => api.post(`/wards/${wardId}/beds`, data),

  /** @param {{patientId:string}} data */
  assignBed: (bedId, data) => api.patch(`/wards/beds/${bedId}/assign`, data),

  releaseBed: (bedId) => api.patch(`/wards/beds/${bedId}/release`, {}),
};
