import { AsyncLocalStorage } from 'async_hooks';

// This safely holds state across asynchronous operations within a single HTTP request
export const tenantContext = new AsyncLocalStorage();