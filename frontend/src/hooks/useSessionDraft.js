import { useState, useEffect } from 'react';

/**
 * Syncs state to sessionStorage. Cleared when the tab closes or manually.
 */
export function useSessionDraft(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const draft = sessionStorage.getItem(key);
      return draft ? JSON.parse(draft) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  const clearDraft = () => {
    sessionStorage.removeItem(key);
    setState(initialValue);
  };

  return [state, setState, clearDraft];
}