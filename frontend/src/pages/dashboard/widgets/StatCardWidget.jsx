import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAsync } from '../../../hooks/useAsync.js';
import Card, { CardBody } from '../../../components/ui/Card.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';

export default function StatCardWidget({ title, icon: Icon, to, fetcher, cacheKey, extractValue, suffix }) {
  const { data, loading, error } = useAsync(fetcher, [], cacheKey);
  const value = data ? extractValue(data) : '--';

  return (
    <Card>
      <CardBody>
        <Link to={to} className="flex items-center justify-between group">
          <div>
            <p className="text-xs font-medium text-[var(--color-ink-soft)] uppercase tracking-wide">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-16 mt-2" />
            ) : (
              <p className="font-display text-3xl font-semibold text-[var(--color-ink)] mt-1">
                {error ? '!' : value}
                {suffix && !error && <span className="text-base font-medium text-[var(--color-ink-soft)] ml-1.5">{suffix}</span>}
              </p>
            )}
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center">
              <Icon size={18} />
            </div>
            <ArrowUpRight size={14} className="text-[var(--color-ink-faint)] group-hover:text-[var(--color-primary)] transition-colors" />
          </div>
        </Link>
      </CardBody>
    </Card>
  );
}