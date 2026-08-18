import { api } from './client.js';

export const doctorsApi = {
  list: (query) => api.get('/doctors', query),
  
  // Requires: name, email, specialization, department. 
  // Password is auto-generated and emailed if omitted.
  create: (data) => api.post('/doctors', data),
  
  update: (id, data) => api.put(`/doctors/${id}`, data),
  
  // hard=true cascade deletes the user, profile, tokens, and appointments
  delete: (id, hard = false) => api.delete(`/doctors/${id}?hard=${hard}`)
};