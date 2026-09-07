import { Building2, Users, ClipboardList, CalendarClock, ShieldCheck, Activity } from 'lucide-react';
import { dashboardApi } from '../../api/dashboard.js';
import { useAsync } from '../../hooks/useAsync.js';
import Card, { CardBody } from '../../components/ui/Card.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { formatPaise } from '../../utils/format.js';
import { ROLE_LABELS } from '../../utils/roles.js';

export default function ExecutiveDashboard({ user }) {
  // Executive dashboard relies on a single aggregate endpoint to prevent spamming the DB
  const { data, loading, error } = useAsync(() => dashboardApi.getStats(), [], 'exec_stats');
  const stats = data?.data || {};

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Executive Overview</h2>
        <p className="text-sm text-[var(--color-ink-soft)] mt-1">{ROLE_LABELS[user?.role] || user?.role}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard loading={loading} error={error} title="Total Revenue" value={formatPaise(stats.totalRevenue || 0)} icon={Activity} tone="primary" />
        <MetricCard loading={loading} error={error} title="Total Patients" value={stats.totalPatients} icon={Users} tone="accent" />
        <MetricCard loading={loading} error={error} title="Active Admissions" value={stats.activeAdmissions} icon={ClipboardList} tone="danger" />
        <MetricCard loading={loading} error={error} title="Pending Claims" value={stats.pendingClaims} icon={ShieldCheck} tone="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 min-h-[300px] flex items-center justify-center bg-[var(--color-paper)]/50 border-dashed">
          <p className="text-sm font-medium text-[var(--color-ink-soft)] flex items-center gap-2">
            <Building2 size={18} /> Cross-department analytics rendering engine pending.
          </p>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ loading, error, title, value, icon: Icon, tone }) {
  const tones = {
    primary: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
    accent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
    danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
    warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
  };
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${tones[tone]}`}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-xs font-medium text-[var(--color-ink-soft)] uppercase tracking-wide">{title}</p>
          {loading ? <Skeleton className="h-8 w-20 mt-1" /> : error ? <span className="text-[var(--color-danger)]">Error</span> : (
            <p className="font-display text-2xl font-semibold text-[var(--color-ink)] mt-0.5">{value ?? '--'}</p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}