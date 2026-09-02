import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Blocks accidental navigation (both React Router links and browser back/refresh).
 * Requires react-router-dom v6.19.0+
 */
export function useLeaveGuard(isDirty, message = 'You have unsaved changes. Leave anyway?') {
  // Intercept browser-level navigation (refresh, close tab, external links)
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, message]);

  // Intercept SPA-level navigation (React Router links, back button within app)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (window.confirm(message)) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker, message]);
}