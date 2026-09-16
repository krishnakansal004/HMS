import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Stethoscope, Menu, X } from 'lucide-react';
import Button from '../../../components/ui/Button.jsx';
import ThemeToggle from '../../../components/ui/ThemeToggle.jsx';
import { scrollToSection } from '../../../utils/scrollToSection.js';

const LINKS = [
  { id: 'features', label: 'Features' },
  { id: 'roles', label: 'For your team' },
  { id: 'plans', label: 'Plans' },
  { id: 'faq', label: 'FAQ' },
];

export default function LandingNav() {
  const [open, setOpen] = useState(false);

  // Without this, the landing page scrolls behind the open mobile menu
  // on touch devices — the menu covers the viewport but the page under
  // it still responds to swipes.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-40 bg-[var(--color-paper)]/90 backdrop-blur border-b border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
        <button type="button" onClick={() => scrollToSection('top')} className="flex items-center gap-2.5 shrink-0">
          <div className="h-8 w-8 rounded-[var(--radius-sm)] bg-[var(--color-primary)] text-white flex items-center justify-center">
            <Stethoscope size={17} />
          </div>
          <span className="font-display font-semibold text-[15px] text-[var(--color-ink)]">HMS</span>
        </button>

        <nav className="hidden md:flex items-center gap-7" aria-label="Primary">
          {LINKS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => scrollToSection(l.id)}
              className="text-sm font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] transition-colors"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <Link to="/login">
            <Button variant="secondary" size="md">Sign in</Button>
          </Link>
          <Button variant="primary" size="md" onClick={() => scrollToSection('register')}>Register your hospital</Button>
        </div>

        <button
          type="button"
          className="md:hidden p-2 -mr-2 text-[var(--color-ink-soft)]"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-[var(--color-border)] px-4 pb-4 flex flex-col gap-3 bg-[var(--color-paper)]">
          {LINKS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => {
                scrollToSection(l.id);
                setOpen(false);
              }}
              className="py-2 text-left text-sm font-medium text-[var(--color-ink-soft)]"
            >
              {l.label}
            </button>
          ))}
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              <span className="text-sm font-medium text-[var(--color-ink-soft)]">Appearance</span>
              <ThemeToggle className="h-8 w-8" />
            </div>
            <Link to="/login" onClick={() => setOpen(false)}>
              <Button variant="secondary" className="w-full">Sign in</Button>
            </Link>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                scrollToSection('register');
                setOpen(false);
              }}
            >
              Register your hospital
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
