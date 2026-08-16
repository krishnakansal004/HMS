import { Loader2, Inbox } from 'lucide-react';
import classNames from '../../utils/cn.js';

export function Table({ children, className = '' }) {
  return (
    <div className="overflow-x-auto">
      <table className={classNames('w-full text-sm', className)}>{children}</table>
    </div>
  );
}

export function Thead({ children }) {
  return (
    <thead>
      <tr className="border-b border-[var(--color-border)] text-left">{children}</tr>
    </thead>
  );
}

export function Th({ children, className = '' }) {
  return (
    <th className={classNames('px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]', className)}>
      {children}
    </th>
  );
}

export function Td({ children, className = '' }) {
  return <td className={classNames('px-4 py-3 text-[var(--color-ink)]', className)}>{children}</td>;
}

export function Tr({ children, className = '', ...rest }) {
  return (
    <tr className={classNames('border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-paper)]/60 transition-colors', className)} {...rest}>
      {children}
    </tr>
  );
}

export function Spinner({ label = 'Loading…', size = 20 }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-[var(--color-ink-soft)] text-sm">
      <Loader2 className="animate-spin" size={size} />
      {label}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center px-6">
      <div className="h-11 w-11 rounded-full bg-[var(--color-paper)] flex items-center justify-center text-[var(--color-ink-faint)] mb-1">
        <Icon size={20} />
      </div>
      <p className="font-medium text-[var(--color-ink)] text-sm">{title}</p>
      {description && <p className="text-xs text-[var(--color-ink-soft)] max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center px-6">
      <p className="font-medium text-[var(--color-danger)] text-sm">Something went wrong</p>
      <p className="text-xs text-[var(--color-ink-soft)] max-w-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-xs font-medium text-[var(--color-primary)] hover:underline">
          Try again
        </button>
      )}
    </div>
  );
}
