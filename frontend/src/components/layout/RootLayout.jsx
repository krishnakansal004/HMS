import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';
import AppShell from './AppShell.jsx';
import LandingPage from '../../pages/LandingPage.jsx';

export default function RootLayout() {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  // The root route is public. Existing application routes remain protected
  // without moving or rewriting the established HMS URL structure.
  if (!user && location.pathname === '/') return <LandingPage />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (location.pathname === '/') return <Navigate to="/dashboard" replace />;

  return <AppShell />;
}
