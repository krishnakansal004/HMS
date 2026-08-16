import classNames from '../../utils/cn.js';

export default function Card({ className = '', children, ...rest }) {
  return (
    <div
      className={classNames(
        'bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)]',
        'shadow-[0_1px_2px_rgba(18,24,38,0.04)]',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={classNames('flex items-start justify-between gap-4 px-5 py-4 border-b border-[var(--color-border)]', className)}>
      <div>
        <h2 className="font-display font-semibold text-[15px] text-[var(--color-ink)]">{title}</h2>
        {subtitle && <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className = '', children }) {
  return <div className={classNames('px-5 py-4', className)}>{children}</div>;
}
