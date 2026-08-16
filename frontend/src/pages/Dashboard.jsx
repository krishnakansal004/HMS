import { Users, CalendarClock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { useAsync } from '../hooks/useAsync.js';
import { patientsApi } from '../api/patients.js';
import { appointmentsApi } from '../api/appointments.js';
import Card, { CardBody } from '../components/ui/Card.jsx';
import { Spinner, ErrorState } from '../components/ui/Table.jsx';
import { navForRole } from '../utils/navConfig.js';
import { ROLE_LABELS } from '../utils/roles.js';

// There is no dedicated /api/dashboard or stats endpoint in the 19 live
// route groups (directorStats.js exists in the legacy tree but isn't
// mounted in app.js). Rather than invent one, this pulls real counts
// from the list endpoints that already exist.
export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  const today = new Date().toISOString().slice(0, 10);

  const patients = useAsync(() => patientsApi.list({ limit: 1 }), []);
  const appts = useAsync(() => appointmentsApi.list({ date: today, limit: 1 }), []);

  const quickLinks = navForRole(user?.role).filter((i) => i.key !== 'dashboard').slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
          Welcome back, {user?.name?.split(' ')[0] || user?.email}
        </h2>
        <p className="text-sm text-[var(--color-ink-soft)] mt-1">
          Signed in as {ROLE_LABELS[user?.role] || user?.role}
          {user?.tenantName ? ` at ${user.tenantName}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          icon={Users}
          label="Total patients"
          state={patients}
          value={patients.data?.total}
          to="/patients"
        />
        <StatCard
          icon={CalendarClock}
          label="Appointments today"
          state={appts}
          value={appts.data?.total}
          to="/appointments"
        />
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <h3 className="font-display font-semibold text-[15px]">Quick access</h3>
        </div>
        <CardBody className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {quickLinks.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3.5 py-3 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] transition-colors"
            >
              <item.icon size={16} className="text-[var(--color-primary)]" />
              {item.label}
            </Link>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, state, value, to }) {
  return (
    <Card>
      <CardBody>
        {state.loading ? (
          <Spinner label={`Loading ${label.toLowerCase()}…`} />
        ) : state.error ? (
          <ErrorState message={state.error} onRetry={state.refetch} />
        ) : (
          <Link to={to} className="flex items-center justify-between group">
            <div>
              <p className="text-xs font-medium text-[var(--color-ink-soft)] uppercase tracking-wide">{label}</p>
              <p className="font-display text-3xl font-semibold text-[var(--color-ink)] mt-1">{value ?? '—'}</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center">
                <Icon size={18} />
              </div>
              <ArrowRight size={14} className="text-[var(--color-ink-faint)] group-hover:text-[var(--color-primary)] transition-colors" />
            </div>
          </Link>
        )}
      </CardBody>
    </Card>
  );
}
