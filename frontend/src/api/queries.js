import { api } from './client.js';

// Maps to backend/src/routes/queries.js. POST / is the public,
// rate-limited marketing-site contact form (no auth) — see
// queryController.js: "Public, no auth -- the marketing-site contact
// form." Submissions land in the SYSTEM_OWNER's unassigned-queries
// inbox for triage.

export const queriesApi = {
  /** @param {{tenantId?: string, name: string, email: string, phone?: string, message: string}} data */
  submit: (data) => api.post('/queries', data),
};
