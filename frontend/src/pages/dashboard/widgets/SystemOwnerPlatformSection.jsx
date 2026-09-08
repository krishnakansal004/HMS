import { Building2, ShieldCheck, ShieldAlert, Layers, Wallet, Inbox } from 'lucide-react';
import { useAsync } from '../../../hooks/useAsync.js';
import { dashboardApi } from '../../../api/dashboard.js';
import { formatPaise } from '../../../utils/format.js';
import Card, { CardHeader, CardBody } from '../../../components/ui/Card.jsx';
import { Spinner, ErrorState, EmptyState } from '../../../components/ui/Table.jsx';
import { StatCard } from '../shared.jsx';

/**
 * System Owner's nav is effectively just "Plans & Tenants" -- no
 * clinical, billing, or HR keys at all -- so every other section on this
 * page renders nothing for this role. This is the whole dashboard for
 * System Owner: cross-tenant counts from the new GET /api/analytics/platform
 * endpoint (see AnalyticsService.getPlatformStats for why platform revenue
 * is computed via a per-tenant fan-out rather than one query).
 */
export default function SystemOwnerPlatformSection({ role }) {
  const enabled = role === 'SYSTEM_OWNER';

  const platform = useAsync(
    () => (enabled ? dashboardApi.getPlatformStats() : Promise.resolve(null)),
    [enabled],
    'dash_platform',
  );

  if (!enabled) return null;

  const data = platform.data?.data;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total tenants" state={platform} value={data?.totalTenants} to="/plans" />
        <StatCard icon={ShieldCheck} label="Active tenants" state={platform} value={data?.activeTenants} to="/plans" />
        <StatCard icon={ShieldAlert} label="Suspended tenants" state={platform} value={data?.suspendedTenants} to="/plans" />
        <StatCard icon={Inbox} label="Pending plan requests" state={platform} value={data?.pendingPlanRequests} to="/plans" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader title="Platform revenue" subtitle="Subscription receipts, last 30 days" />
          <CardBody>
            {platform.loading ? (
              <Spinner label="Loading revenue..." />
            ) : platform.error ? (
              <ErrorState message={platform.error} onRetry={platform.refetch} />
            ) : (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center">
                  <Wallet size={18} />
                </div>
                <p className="font-display text-3xl font-semibold text-[var(--color-ink)]">
                  {formatPaise(data?.platformRevenueLast30d || 0)}
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Plan distribution" subtitle="Tenants per subscription plan" />
          <CardBody>
            {platform.loading ? (
              <Spinner label="Loading plan mix..." />
            ) : platform.error ? (
              <ErrorState message={platform.error} onRetry={platform.refetch} />
            ) : !data?.planDistribution?.length ? (
              <EmptyState icon={Layers} title="No tenants yet" />
            ) : (
              <ul className="flex flex-col gap-3">
                {data.planDistribution.map((p) => (
                  <li key={p.planId || 'none'} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[var(--color-ink)]">{p.planName}</span>
                    <span className="font-mono-data text-[var(--color-ink-soft)]">{p.tenantCount} tenant{p.tenantCount === 1 ? '' : 's'}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
