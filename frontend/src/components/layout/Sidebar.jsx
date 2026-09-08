import { NavLink } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { navForRole } from '../../utils/navConfig.js';
import { ROLE_LABELS } from '../../utils/roles.js';
import classNames from '../../utils/cn.js';
import { useMemo } from 'react';

export default function Sidebar({ role, hospitalName, open, onClose }) {

  const navItems = useMemo(() => navForRole(role), [role]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={classNames(
          'fixed lg:sticky top-0 left-0 h-screen w-64 shrink-0 z-40',
          'bg-[var(--color-ink)] text-white flex flex-col',
          'transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Signature vitals accent rail */}
        <div className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-[var(--color-primary)] via-[var(--color-accent)] to-[var(--color-primary)]" />

        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-white/10">
          <div className="h-8 w-8 rounded-[var(--radius-sm)] bg-[var(--color-primary)] flex items-center justify-center shrink-0">
            <Stethoscope size={17} />
          </div>
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm leading-tight truncate">{hospitalName || 'HMS'}</p>
            <p className="text-[11px] text-white/50 truncate">{ROLE_LABELS[role] || role}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                classNames(
                  'flex items-center gap-2.5 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                )
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
