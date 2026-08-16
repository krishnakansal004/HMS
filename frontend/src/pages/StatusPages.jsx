import { Link } from 'react-router-dom';
import { ShieldAlert, FileQuestion } from 'lucide-react';
import Button from '../components/ui/Button.jsx';

export function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
      <FileQuestion size={40} className="text-[var(--color-ink-faint)]" />
      <h1 className="font-display text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-[var(--color-ink-soft)] max-w-sm">The page you're looking for doesn't exist or has moved.</p>
      <Link to="/dashboard"><Button className="mt-2">Back to dashboard</Button></Link>
    </div>
  );
}

export function Unauthorized() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
      <ShieldAlert size={40} className="text-[var(--color-danger)]" />
      <h1 className="font-display text-xl font-semibold">You don't have access to this page</h1>
      <p className="text-sm text-[var(--color-ink-soft)] max-w-sm">Your role doesn't include this module. Contact your hospital admin if this seems wrong.</p>
      <Link to="/dashboard"><Button className="mt-2">Back to dashboard</Button></Link>
    </div>
  );
}
