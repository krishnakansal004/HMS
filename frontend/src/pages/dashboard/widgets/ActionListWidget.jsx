import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAsync } from '../../../hooks/useAsync.js';
import Card, { CardHeader, CardBody } from '../../../components/ui/Card.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../../../components/ui/Table.jsx';

export default function ActionListWidget({ title, icon: Icon, to, fetcher, cacheKey, emptyMessage, renderRow }) {
  const { data, loading, error, refetch } = useAsync(fetcher, [], cacheKey);
  
  // Safely extract arrays from standard API envelopes
  const items = data?.data || data?.invoices || [];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title={title}
        action={
          <Link to={to} className="text-xs font-medium text-[var(--color-primary)] hover:underline flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        }
      />
      <CardBody className="flex-1 overflow-y-auto p-0">
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : items.length === 0 ? (
            <EmptyState icon={Icon} title={emptyMessage} />
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map(renderRow)}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}