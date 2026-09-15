import { Loader2 } from 'lucide-react';
import classNames from '../../utils/cn.js';

const VARIANTS = {
  primary: 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50',
  secondary: 'bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-border-strong)] hover:bg-[var(--color-paper)] disabled:opacity-50',
  ghost: 'bg-transparent text-[var(--color-ink-soft)] hover:bg-[var(--color-paper)] disabled:opacity-40',
  danger: 'bg-[var(--color-danger)] text-white hover:opacity-90 disabled:opacity-50',
};

const SIZES = {
  sm: 'text-xs px-2.5 py-1.5 gap-1.5',
  md: 'text-sm px-3.5 py-2 gap-2',
  lg: 'text-sm px-5 py-2.5 gap-2',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon: Icon,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={classNames(
        'inline-flex items-center justify-center rounded-[var(--radius-sm)] font-medium transition-colors',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 className="animate-spin" size={16} /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}
