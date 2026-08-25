import { api } from './client.js';

export const suppliersApi = {
  list: () => api.get('/suppliers'),
};