import { Outlet, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import AppShell from '../components/layout/AppShell.jsx';
import { useAuthStore } from '../store/authStore.js';

// Lazy-loaded like the app's other public pages (ApplyDoctor,
// SetupPassword in router.jsx) — authenticated users never see this
// component, so it shouldn't add to the bundle they pay for on every
// login.
const LandingPage = lazy(() => import('../pages/public/LandingPage.jsx'));

const FullPageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)]">
    <Loader2 className="animate-spin text-[var(--color-ink-faint)]" size={24} />
  </div>
);

export function RootShell() {
  const user = useAuthStore((s) => s.user);
  return user ? <AppShell /> : <Outlet />;
}

export function RootIndex() {
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <Suspense fallback={<FullPageLoader />}>
      <LandingPage />
    </Suspense>
  );
}
