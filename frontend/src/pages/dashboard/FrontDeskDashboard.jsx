import { Users, CalendarClock, ClipboardList, BedDouble } from 'lucide-react';
import { patientsApi } from '../../api/patients.js';
import { appointmentsApi } from '../../api/appointments.js';
import { admissionsApi } from '../../api/admissions.js';
import { wardsApi } from '../../api/wards.js';
import StatCardWidget from './widgets/StatCardWidget.jsx';
import AppointmentsWidget from './widgets/AppointmentsWidget.jsx';
import { ROLE_LABELS } from '../../utils/roles.js';

export default function FrontDeskDashboard({ user }) {
  const TODAY = new Date().toISOString().slice(0, 10);

  const fetchBedStats = async () => {
    const res = await wardsApi.list();
    let total = 0, occupied = 0;
    res.data.forEach(w => {
      total += w.capacity;
      occupied += w.bed?.filter(b => b.is_occupied).length || 0;
    });
    return { text: `${occupied}/${total}`, pct: total ? Math.round((occupied/total)*100) : 0 };
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
          Operations Overview
        </h2>
        <p className="text-sm text-[var(--color-ink-soft)] mt-1">
          {ROLE_LABELS[user?.role] || user?.role}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardWidget title="Total Patients" icon={Users} to="/patients" fetcher={() => patientsApi.list({limit:1})} cacheKey="fd_pat" extractValue={d => d.total} />
        <StatCardWidget title="Appointments Today" icon={CalendarClock} to="/appointments" fetcher={() => appointmentsApi.list({date: TODAY, limit:1})} cacheKey="fd_apt" extractValue={d => d.total} />
        <StatCardWidget title="Active Admissions" icon={ClipboardList} to="/admissions" fetcher={() => admissionsApi.list({status: 'admitted', limit:1})} cacheKey="fd_adm" extractValue={d => d.total} />
        <StatCardWidget title="Bed Occupancy" icon={BedDouble} to="/wards" fetcher={fetchBedStats} cacheKey="fd_beds" extractValue={d => d.text} suffix={d => `${d.pct}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
           <AppointmentsWidget />
        </div>
        <div className="lg:col-span-1">
          {/* Future: Attendance Widget goes here */}
        </div>
      </div>
    </div>
  );
}