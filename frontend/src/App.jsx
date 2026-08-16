import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Loader2, Stethoscope } from 'lucide-react';
import { router } from './routes/router.jsx';
import { useAuthStore } from './store/authStore.js';

export default function App() {
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!bootstrapped) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[var(--color-paper)]">
        <div className="h-11 w-11 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white flex items-center justify-center">
          <Stethoscope size={22} />
        </div>
        <Loader2 className="animate-spin text-[var(--color-ink-faint)]" size={18} />
      </div>
    );
  }

  return <RouterProvider router={router} />;
}
