import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';

/**
 * @param {{roles?: string[]}} props If omitted, any authenticated user passes.
 * Client-side gating is UX only — the API is the real enforcement boundary
 * (see navConfig.js comment). A role mismatch here just avoids flashing a
 * page that would immediately 403.
 */
export default function ProtectedRoute({ roles, children }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
