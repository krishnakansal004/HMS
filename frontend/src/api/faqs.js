import { api } from './client.js';

// Maps to backend/src/routes/faqs.js. GET is publicly readable
// (optionalAuth) — platform-level FAQs (tenant_id null) for anonymous
// visitors on the landing page, plus the requesting tenant's own FAQs
// when called from inside an authenticated hospital context.

export const faqsApi = {
  /** @param {{category?: string}} [query] */
  list: (query) => api.get('/faqs', query),
};
