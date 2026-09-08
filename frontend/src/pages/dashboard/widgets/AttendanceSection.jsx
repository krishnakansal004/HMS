import { Link } from 'react-router-dom';
import { ArrowRight, UserCheck } from 'lucide-react';
import { useAsync } from '../../../hooks/useAsync.js';
import { attendanceApi } from '../../../api/attendance.js';
import Card, { CardHeader, CardBody } from '../../../components/ui/Card.jsx';
import StatusPill from '../../../components/ui/StatusPill.jsx';
import { Spinner, ErrorState, EmptyState } from '../../../components/ui/Table.jsx';
import { TODAY } from '../shared.jsx';

export default function AttendanceSection({ visible }) {
  const onDuty = useAsync(
    () => (visible.has('attendance') ? attendanceApi.list({ status: 'PRESENT', startDate: TODAY, endDate: TODAY, limit: 6 }) : Promise.resolve(null)),
    [visible.has('attendance')],
    'dash_attendance',
  );

  if (!visible.has('attendance')) return null;

  return (
    <Card>
      <CardHeader
        title="On duty today"
        subtitle={onDuty.data?.total !== undefined ? `${onDuty.data.total} checked in` : undefined}
        action={
          <Link to="/attendance" className="text-xs font-medium text-[var(--color-primary)] hover:underline flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        }
      />
      <CardBody>
        {onDuty.loading ? (
          <Spinner label="Loading attendance..." />
        ) : onDuty.error ? (
          <ErrorState message={onDuty.error} onRetry={onDuty.refetch} />
        ) : !onDuty.data?.data?.length ? (
          <EmptyState icon={UserCheck} title="No check-ins recorded yet today" />
        ) : (
          <ul className="flex flex-col gap-3">
            {onDuty.data.data.map((r) => (
              <li key={r.attendance_id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)] flex items-center justify-center text-xs font-semibold">
                    {(r.users?.name || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}
                  </div>
                  <span className="font-medium text-[var(--color-ink)]">{r.users?.name || 'Unknown'}</span>
                </div>
                <StatusPill status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
