import { forwardRef } from 'react';
import classNames from '../../utils/cn.js';

export const Input = forwardRef(function Input(
  { label, error, hint, className = '', id, required, ...rest },
  ref
) {
  const inputId = id || rest.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-[var(--color-ink)]">
          {label}
          {required && <span className="text-[var(--color-danger)] ml-0.5">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={classNames(
          'w-full rounded-[var(--radius-sm)] border bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]',
          'placeholder:text-[var(--color-ink-faint)] transition-colors',
          error
            ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)]'
            : 'border-[var(--color-border-strong)] focus:border-[var(--color-primary)]',
          className
        )}
        aria-invalid={!!error}
        {...rest}
      />
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      {!error && hint && <p className="text-xs text-[var(--color-ink-faint)]">{hint}</p>}
    </div>
  );
});

export const Select = forwardRef(function Select(
  { label, error, hint, className = '', id, required, children, ...rest },
  ref
) {
  const selectId = id || rest.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-[var(--color-ink)]">
          {label}
          {required && <span className="text-[var(--color-danger)] ml-0.5">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={classNames(
          'w-full rounded-[var(--radius-sm)] border bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]',
          'transition-colors',
          error
            ? 'border-[var(--color-danger)]'
            : 'border-[var(--color-border-strong)] focus:border-[var(--color-primary)]',
          className
        )}
        aria-invalid={!!error}
        {...rest}
      >
        {children}
      </select>
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      {!error && hint && <p className="text-xs text-[var(--color-ink-faint)]">{hint}</p>}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, className = '', id, required, ...rest },
  ref
) {
  const areaId = id || rest.name;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={areaId} className="text-sm font-medium text-[var(--color-ink)]">
          {label}
          {required && <span className="text-[var(--color-danger)] ml-0.5">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={areaId}
        rows={3}
        className={classNames(
          'w-full rounded-[var(--radius-sm)] border bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]',
          'placeholder:text-[var(--color-ink-faint)] transition-colors resize-y',
          error
            ? 'border-[var(--color-danger)]'
            : 'border-[var(--color-border-strong)] focus:border-[var(--color-primary)]',
          className
        )}
        aria-invalid={!!error}
        {...rest}
      />
      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      {!error && hint && <p className="text-xs text-[var(--color-ink-faint)]">{hint}</p>}
    </div>
  );
});
