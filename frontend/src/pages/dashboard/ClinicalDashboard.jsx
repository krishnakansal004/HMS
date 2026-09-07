import { CalendarClock, FlaskConical, Scan } from 'lucide-react';
import { appointmentsApi } from '../../api/appointments.js';
import { labApi } from '../../api/lab.js';
import { radiologyApi } from '../../api/radiology.js';
import StatCardWidget from './widgets/StatCardWidget.jsx';
import AppointmentsWidget from './widgets/AppointmentsWidget.jsx';
import { ROLE_LABELS } from '../../utils/roles.js';

export default function ClinicalDashboard({ user }) {
  const TODAY = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
          Clinical Schedule
        </h2>
        <p className="text-sm text-[var(--color-ink-soft)] mt-1">
          {ROLE_LABELS[user?.role] || user?.role} | Dr. {user?.name}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCardWidget title="My Appts Today" icon={CalendarClock} to="/appointments" fetcher={() => appointmentsApi.list({date: TODAY, doctorId: user.id, limit:1})} cacheKey={`clin_apt_${user.id}`} extractValue={d => d.total} />
        <StatCardWidget title="Pending Lab Results" icon={FlaskConical} to="/lab" fetcher={() => labApi.listOrders({status: 'pending', limit:1})} cacheKey="clin_lab" extractValue={d => d.total} />
        <StatCardWidget title="Pending Radiology" icon={Scan} to="/radiology" fetcher={() => radiologyApi.listOrders({status: 'ordered', limit:1})} cacheKey="clin_rad" extractValue={d => d.total} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
           <AppointmentsWidget doctorId={user.id} />
        </div>
      </div>
    </div>
  );
}