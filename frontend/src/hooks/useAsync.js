import { useCallback, useEffect, useRef, useState } from 'react';

// Global memory cache to prevent spamming the DB during rapid tab switching
const globalCache = new Map();

/**
 * Minimal data-fetching hook upgraded with SWR-style caching.
 * @param {Function} fn - API call promise
 * @param {Array} deps - Dependency array to trigger refetch
 * @param {string} cacheKey - Unique string to cache this query globally
 * @param {number} ttl - Time to live in milliseconds (default 60s)
 */
export function useAsync(fn, deps = [], cacheKey = null, ttl = 60000) {
  const [state, setState] = useState(() => {
    if (cacheKey && globalCache.has(cacheKey)) {
      const cached = globalCache.get(cacheKey);
      if (Date.now() - cached.timestamp < ttl) {
        return { data: cached.data, loading: false, error: null };
      }
    }
    return { data: null, loading: true, error: null };
  });

  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback((force = false) => {
    let cancelled = false;

    if (!force && cacheKey && globalCache.has(cacheKey)) {
      const cached = globalCache.get(cacheKey);
      if (Date.now() - cached.timestamp < ttl) {
        if (!state.data) setState({ data: cached.data, loading: false, error: null });
        return () => { cancelled = true; };
      }
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    
    fnRef.current()
      .then((data) => {
        if (!cancelled) {
          if (cacheKey) globalCache.set(cacheKey, { data, timestamp: Date.now() });
          setState({ data, loading: false, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: err.message || 'Something went wrong' });
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, cacheKey, ttl]);

  useEffect(() => run(), [run]);

  return { ...state, refetch: () => run(true) };
}