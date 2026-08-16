import { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';
import { initials } from '../../utils/format.js';

export default function Topbar({ onMenuClick, title }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 h-16 shrink-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="lg:hidden p-1.5 rounded-md text-[var(--color-ink-soft)] hover:bg-[var(--color-paper)]"
        >
          <Menu size={20} />
        </button>
        <h1 className="font-display font-semibold text-lg text-[var(--color-ink)] truncate">{title}</h1>
      </div>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 hover:bg-[var(--color-paper)] transition-colors"
        >
          <span className="h-8 w-8 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)] flex items-center justify-center text-xs font-semibold">
            {initials(user?.name || user?.email)}
          </span>
          <span className="hidden sm:block text-sm font-medium text-[var(--color-ink)] max-w-[140px] truncate">
            {user?.name || user?.email}
          </span>
          <ChevronDown size={15} className="text-[var(--color-ink-faint)]" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-lg py-1.5 z-30">
            <div className="px-3 py-2 border-b border-[var(--color-border)]">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-[var(--color-ink-soft)] truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
            >
              <LogOut size={15} />
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
