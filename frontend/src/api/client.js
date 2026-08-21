// Core fetch wrapper for the HMS API.
//
// Contract, read from backend/src/app.js + errorHandler.js + authMiddleware.js:
//  - Base path is same-origin `/api/*` (dev proxy in vite.config.js forwards
//    to VITE_BACKEND_ORIGIN, prod is served behind the same host/reverse proxy).
//  - Access token is a JWT sent as `Authorization: Bearer <token>`. It is
//    held ONLY in memory (never localStorage/sessionStorage) per the
//    project's existing security decision.
//  - Success envelope: { success: true, data, message?, total?, page?, pages? }
//  - Error envelope:   { success: false, message, errors?: [{field, message}] }
//  - POST /api/auth/refresh reads an httpOnly refreshToken cookie and
//    returns a new accessToken + user. This file uses it two ways:
//      1. On any 401 mid-session, transparently refresh once and retry
//         the original request (see the interceptor in `request()`).
//      2. On app load (`refreshSession()`, called from authStore.bootstrap),
//         to restore a session after a hard page refresh instead of always
//         bouncing to /login even when a valid refresh cookie exists.
//  - Every request sends `X-Requested-With: XMLHttpRequest`. This is NOT
//    for the data-mutating routes (patients, appointments, etc.) — those
//    are already safe from CSRF because they require the Bearer token in
//    a header, which a forged cross-site request can't set regardless.
//    It's specifically for login/logout/refresh on the backend, the only
//    three endpoints that touch the refreshToken cookie: a forged
//    cross-site <form> POST can't attach a custom header, so this closes
//    the one real gap sameSite alone doesn't (see backend's
//    csrfMiddleware.js for the full reasoning). Sent on every request
//    here, not just those three, so this file doesn't need to special-case
//    which endpoints care.

const CSRF_HEADER_NAME = 'X-Requested-With';
const CSRF_HEADER_VALUE = 'XMLHttpRequest';

let accessToken = null;
let onSessionExpired = null; // () => void — authStore wires this to clear `user`
let onTokenRefreshed = null; // (user) => void — keeps store's `user` in sync
let refreshPromise = null; // dedupes concurrent refresh attempts

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setSessionHandlers({ onExpired, onRefreshed } = {}) {
  onSessionExpired = onExpired || null;
  onTokenRefreshed = onRefreshed || null;
}

export class ApiError extends Error {
  constructor(message, { status, fieldErrors } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors || [];
  }
}

/**
 * Calls POST /api/auth/refresh directly (bypassing `request()` — refresh
 * must never itself trigger the 401 retry loop below). Concurrent callers
 * share one in-flight request instead of firing a refresh each.
 * @returns {Promise<object>} the user object from the response
 * @throws {ApiError} if there's no valid refresh cookie
 */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE },
    })
      .then(async (res) => {
        let payload = null;
        try {
          payload = await res.json();
        } catch {
          // ignore — handled by !res.ok below
        }
        if (!res.ok) {
          throw new ApiError(payload?.message || 'Session expired', { status: res.status });
        }
        accessToken = payload.data.accessToken;
        onTokenRefreshed?.(payload.data.user);
        return payload.data.user;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * @param {string} path e.g. '/patients' or '/patients/123'
 * @param {{method?: string, body?: any, query?: Record<string, any>, isForm?: boolean, _retried?: boolean}} opts
 */
export async function request(path, opts = {}) {
  const { method = 'GET', body, query, isForm = false, _retried = false } = opts;
  let url = `/api${path}`;

  if (query && Object.keys(query).length) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      qs.set(k, v);
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  // Inject strict cache-busting headers
  const headers = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };
  
  headers[CSRF_HEADER_NAME] = CSRF_HEADER_VALUE;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      credentials: 'include', 
      cache: 'no-store', // <-- CRITICAL: Forces browser to bypass disk cache entirely
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch (networkErr) {
    throw new ApiError('Could not reach the server. Check your connection and try again.', { status: 0 });
  }

  // Silent-refresh-and-retry logic remains unchanged
  if (res.status === 401 && !_retried && !path.startsWith('/auth/')) {
    try {
      await refreshSession();
      return request(path, { ...opts, _retried: true });
    } catch {
      onSessionExpired?.();
    }
  }

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    // No JSON body (e.g. 204)
  }

  if (!res.ok) {
    const message = payload?.message || `Request failed (${res.status})`;
    throw new ApiError(message, { status: res.status, fieldErrors: payload?.errors });
  }

  return payload;
}

export const api = {
  get: (path, query) => request(path, { method: 'GET', query }),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
