import { useState, Suspense } from 'react';
import { Outlet, useMatches } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { ToastViewport } from '../ui/Toast.jsx';

const ContentLoader = () => (
  <div className="flex h-[50vh] w-full items-center justify-center">
    <Loader2 className="animate-spin text-[var(--color-primary)]" size={32} />
  </div>
);

export default function AppShell() {
  const user = useAuthStore((s) => s.user);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const matches = useMatches();
  const title = matches.findLast((m) => m.handle?.title)?.handle?.title || 'HMS';

  return (
    <div className="min-h-screen flex bg-[var(--color-paper)]">
      <Sidebar role={user?.role} hospitalName={user?.tenantName} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 p-4 lg:p-6 max-w-[1400px] w-full mx-auto">
          <Suspense fallback={<ContentLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <ToastViewport />
    </div>
  );
}