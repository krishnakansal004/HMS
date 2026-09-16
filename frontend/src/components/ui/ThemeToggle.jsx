import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore.js';
import classNames from '../../utils/cn.js';

export default function ThemeToggle({ className = '' }) {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={classNames(
        'group inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)]',
        'bg-[var(--color-surface)] text-[var(--color-ink-soft)] shadow-[0_1px_2px_rgba(0,0,0,0.08)]',
        'transition-all hover:border-[var(--color-border-strong)] hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)]',
        'focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-paper)]',
        className,
      )}
    >
      <span className="transition-transform duration-200 group-hover:scale-110">
        {dark ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
      </span>
    </button>
  );
}
