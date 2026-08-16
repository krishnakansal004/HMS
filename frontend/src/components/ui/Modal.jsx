import { useEffect } from 'react';
import { X } from 'lucide-react';
import classNames from '../../utils/cn.js';

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-10">
      <div
        className="fixed inset-0 bg-[var(--color-ink)]/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={classNames(
          'relative w-full bg-[var(--color-surface)] rounded-[var(--radius-lg)] shadow-xl',
          'border border-[var(--color-border)]',
          widths[size]
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h3 className="font-display font-semibold text-[15px]">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-[var(--color-ink-soft)] hover:bg-[var(--color-paper)]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-4 border-t border-[var(--color-border)]">{footer}</div>}
      </div>
    </div>
  );
}
