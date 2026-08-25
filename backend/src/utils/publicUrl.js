/**
 * Robust utility to determine the frontend base URL.
 * Prioritizes environment variables and provides sensible production-safe fallbacks.
 */
export function getPublicFrontendBaseUrl() {
  const candidates = [
    process.env.FRONTEND_URL,
    process.env.PUBLIC_FRONTEND_URL,
    process.env.COMPANY_PORTAL_URL,
    process.env.REACT_APP_FRONTEND_URL,
    process.env.CORS_ORIGIN
  ];

  for (const urlCandidate of candidates) {
    if (urlCandidate && typeof urlCandidate === 'string') {
      const splitCandidates = urlCandidate.split(',').map(s => s.trim()).filter(Boolean);
      for (const c of splitCandidates) {
        const withProtocol = /^https?:\/\//i.test(c) ? c : `https://${c}`;
        try {
          const url = new URL(withProtocol);
          // Prioritize non-localhost URLs for public links
          const h = url.hostname.toLowerCase();
          if (h !== 'localhost' && h !== '127.0.0.1' && h !== '0.0.0.0') {
            return url.origin.replace(/\/$/, '');
          }
        } catch (e) { /* ignore */ }
      }
    }
  }

  // If we have a localhost candidate in env, use it as last resort before hardcoded fallback
  for (const urlCandidate of candidates) {
    if (urlCandidate && typeof urlCandidate === 'string' && urlCandidate.includes('localhost')) {
        return urlCandidate.trim().replace(/\/$/, '');
    }
  }

  // Final fallbacks
  if (process.env.NODE_ENV === 'production') {
    return 'https://hms-lovat-one.vercel.app';
  }
  return 'http://localhost:5174';
}

/**
 * Builds a full public-facing URL for a specific frontend path.
 * Ensures no double slashes and correct base URL.
 */
export function buildPublicFrontendUrl(path = '/') {
  const base = getPublicFrontendBaseUrl();
  const safePath = (path === undefined || path === null) ? '/' : String(path);
  
  // Handle empty or root path
  if (safePath === '' || safePath === '/') return base;
  
  // Ensure exactly one slash between base and path
  const normalizedPath = safePath.startsWith('/') ? safePath : `/${safePath}`;
  return `${base}${normalizedPath}`;
}