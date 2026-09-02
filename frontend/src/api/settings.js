import { api } from './client.js';

// Maps to backend/src/routes/settings.js (clinical/prescription templates
// + tenant settings). Field shapes weren't fully captured in the route
// confirm against clinicalSettingsValidator.js before wiring the
// create-template form.

export const settingsApi = {
  listTemplates: () => api.get('/settings/templates'),
  createTemplate: (data) => api.post('/settings/templates', data),
  removeTemplate: (id) => api.delete(`/settings/templates/${id}`),

  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
};
