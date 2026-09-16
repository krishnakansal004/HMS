import { Link } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { scrollToSection } from '../../../utils/scrollToSection.js';

export default function LandingFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-[var(--radius-sm)] bg-[var(--color-primary)] text-white flex items-center justify-center">
            <Stethoscope size={14} />
          </div>
          <span className="font-display font-semibold text-sm text-[var(--color-ink)]">HMS</span>
          <span className="text-xs text-[var(--color-ink-faint)] ml-1">
            Hospital operations, in one place.
          </span>
        </div>

        <div className="flex items-center gap-6 text-sm text-[var(--color-ink-soft)]">
          <button type="button" onClick={() => scrollToSection('features')} className="bg-transparent p-0 hover:text-[var(--color-ink)] transition-colors">Features</button>
          <button type="button" onClick={() => scrollToSection('plans')} className="bg-transparent p-0 hover:text-[var(--color-ink)] transition-colors">Plans</button>
          <button type="button" onClick={() => scrollToSection('contact')} className="bg-transparent p-0 hover:text-[var(--color-ink)] transition-colors">Contact</button>
          <Link to="/login" className="hover:text-[var(--color-ink)] transition-colors">Sign in</Link>
        </div>
      </div>
    </footer>
  );
}
