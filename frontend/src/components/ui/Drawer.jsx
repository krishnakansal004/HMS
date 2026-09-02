import { useEffect } from 'react';
import { X } from 'lucide-react';
import classNames from '../../utils/cn.js';

export default function Drawer({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[var(--color-ink)]/40 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Sliding Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={classNames(
          'relative w-full h-full bg-[var(--color-surface)] shadow-2xl flex flex-col',
          'border-l border-[var(--color-border)] animate-in slide-in-from-right-8 duration-200',
          widths[size]
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)] shrink-0">
          <h3 className="font-display font-semibold text-lg text-[var(--color-ink)]">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="p-1.5 rounded-md text-[var(--color-ink-soft)] hover:bg-[var(--color-paper)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
        
        {/* Fixed Footer */}
        {footer && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-paper)]/50 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}