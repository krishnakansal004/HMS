import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal data-fetching hook: no cache, no dedup, just the loading/error/data
 * states every list page needs, plus a `refetch` and a `deps` array like
 * useEffect. Deliberately not react-query — one dependency less to reason
 * about for a first pass; swap in later if cross-page caching becomes worth it.
 */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ data: null, loading: false, error: err.message || 'Something went wrong' });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => run(), [run]);

  return { ...state, refetch: run };
}
