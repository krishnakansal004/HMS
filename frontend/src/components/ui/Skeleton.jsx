import classNames from '../../utils/cn.js';

export function Skeleton({ className = '' }) {
  return (
    <div className={classNames('animate-pulse bg-[var(--color-border-strong)]/20 rounded-[var(--radius-sm)]', className)} />
  );
}

export function SkeletonRow({ columns = 4 }) {
  return (
    <tr className="border-b border-[var(--color-border)] last:border-0">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <Skeleton className="h-4 w-3/4" />
        </td>
      ))}
    </tr>
  );
}