import { Users, ClipboardList, CalendarClock, Wallet } from 'lucide-react';
import { useAsync } from '../../../hooks/useAsync.js';
import { dashboardApi } from '../../../api/dashboard.js';
import { formatPaise } from '../../../utils/format.js';
import { StatCard } from '../shared.jsx';

/**
 * Director's nav has none of the front-desk keys (patients/appointments/
 * admissions/wards), so ClinicalOverviewSection never renders anything
 * for this role -- their dashboard was effectively empty before this.
 * This wires up GET /api/analytics/dashboard, which the backend has had
 * ready for Director/System Owner/Admin all along but the frontend never
 * called. Scoped to Director here specifically: Admin already gets a
 * full clinical view elsewhere, and System Owner gets the cross-tenant
 * platform view instead (see SystemOwnerPlatformSection).
 */
export default function DirectorInsightsSection({ role, planFeatures }) {
  const enabled = role === 'DIRECTOR' && planFeatures?.advanced_analytics === true;

  const stats = useAsync(
    () => (enabled ? dashboardApi.getStats() : Promise.resolve(null)),
    [enabled],
    'dash_director_stats',
  );

  if (!enabled) return null;

  const data = stats.data?.data;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard icon={Users} label="Total patients" state={stats} value={data?.totalPatients} />
      <StatCard icon={ClipboardList} label="Active admissions" state={stats} value={data?.activeAdmissions} />
      <StatCard icon={CalendarClock} label="Today's appointments" state={stats} value={data?.todayAppointments} />
      <StatCard icon={Wallet} label="Revenue collected" state={stats} value={data ? formatPaise(data.totalRevenue) : undefined} to="/plans" />
    </div>
  );
}
