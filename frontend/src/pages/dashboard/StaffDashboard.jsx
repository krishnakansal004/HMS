import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { navForRole } from '../../utils/navConfig.js';
import { ROLE_LABELS } from '../../utils/roles.js';
import ClinicalOverviewSection from './widgets/ClinicalOverviewSection.jsx';
import OperationsAttentionSection from './widgets/OperationsAttentionSection.jsx';
import BillingSummarySection from './widgets/BillingSummarySection.jsx';
import AttendanceSection from './widgets/AttendanceSection.jsx';
import DirectorInsightsSection from './widgets/DirectorInsightsSection.jsx';
import SystemOwnerPlatformSection from './widgets/SystemOwnerPlatformSection.jsx';
import Card, { CardBody } from '../../components/ui/Card.jsx';
import { RoadmapNote } from './shared.jsx';

export default function StaffDashboard({ user }) {
  // navForRole re-filters the same static NAV_ITEMS array every render;
  // memoized so the many child sections below (each keyed off `visible`)
  // don't all re-run their gating checks on every unrelated re-render of
  // this component (e.g. a sibling section's own state update).
  const visible = useMemo(() => new Set(navForRole(user?.role).map((i) => i.key)), [user?.role]);
  const quickLinks = useMemo(
    () => navForRole(user?.role).filter((i) => i.key !== 'dashboard').slice(0, 6),
    [user?.role],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
          Welcome back, {user?.name || user?.email}
        </h2>
        <p className="text-sm text-[var(--color-ink-soft)] mt-1">
          Signed in as {ROLE_LABELS[user?.role] || user?.role}
          {user?.tenantSlug ? ` | ${user.tenantSlug}` : ''} | {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <SystemOwnerPlatformSection role={user?.role} />
      <DirectorInsightsSection role={user?.role} />
      <ClinicalOverviewSection visible={visible} />
      <BillingSummarySection role={user?.role} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OperationsAttentionSection visible={visible} />
        <AttendanceSection visible={visible} />
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

      {/* <RoadmapNote /> */}
    </div>
  );
}
