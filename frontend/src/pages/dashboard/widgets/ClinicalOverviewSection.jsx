import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, CalendarClock, ClipboardList, BedDouble, ArrowRight } from 'lucide-react';
import { useAsync } from '../../../hooks/useAsync.js';
import { patientsApi } from '../../../api/patients.js';
import { appointmentsApi } from '../../../api/appointments.js';
import { admissionsApi } from '../../../api/admissions.js';
import { wardsApi } from '../../../api/wards.js';
import Card, { CardHeader, CardBody } from '../../../components/ui/Card.jsx';
import StatusPill from '../../../components/ui/StatusPill.jsx';
import { Table, Thead, Th, Td, Tr, Spinner, ErrorState, EmptyState } from '../../../components/ui/Table.jsx';
import { fullName } from '../../../utils/format.js';
import { StatCard, TODAY, formatTime } from '../shared.jsx';
import { useAuthStore } from '../../../store/authStore.js';
/**
 * Patients / appointments / admissions / wards -- the clinical front-desk
 * view. Nothing here fetches unless at least one of its four nav keys is
 * visible for the signed-in role (Admin, Receptionist, Doctor, Nurse);
 * StaffDashboard doesn't even mount this component otherwise.
 */
export default function ClinicalOverviewSection({ visible }) {

  const user = useAuthStore((s) => s.user);
  const isDoctor = user?.role === 'DOCTOR';

  const patients = useAsync(
    () => (visible.has('patients') ? patientsApi.list({ limit: 1,doctorId: isDoctor ? user.id : undefined }) : Promise.resolve(null)),
    [visible.has('patients', isDoctor, user.id)],
    'dash_patients',
  );
  const appts = useAsync(
    () => (visible.has('appointments') ? appointmentsApi.list({ date: TODAY, limit: 8 }) : Promise.resolve(null)),
    [visible.has('appointments')],
    'dash_appts',
  );
  const admissions = useAsync(
    () => (visible.has('admissions') ? admissionsApi.list({ status: 'admitted', limit: 1 }) : Promise.resolve(null)),
    [visible.has('admissions')],
    'dash_admissions',
  );
  const wards = useAsync(
    () => (visible.has('wards') ? wardsApi.list() : Promise.resolve(null)),
    [visible.has('wards')],
    'dash_wards',
  );

  const bedStats = useMemo(() => {
    if (!wards.data?.data) return null;
    let total = 0;
    let occupied = 0;
    for (const ward of wards.data.data) {
      total += ward.bed?.length || 0;
      occupied += ward.bed?.filter((b) => b.is_occupied).length || 0;
    }
    return { total, occupied, pct: total ? Math.round((occupied / total) * 100) : 0 };
  }, [wards.data]);

  if (!visible.has('patients') && !visible.has('appointments') && !visible.has('admissions') && !visible.has('wards')) {
    return null;
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {visible.has('patients') && (
          <StatCard icon={Users} label={isDoctor ? "My patients" : "Total patients"} state={patients} value={patients.data?.total} to="/patients" />
        )}
        {visible.has('appointments') && (
          <StatCard icon={CalendarClock} label="Appointments today" state={appts} value={appts.data?.total} to="/appointments" />
        )}
        {visible.has('admissions') && (
          <StatCard icon={ClipboardList} label="Active admissions" state={admissions} value={admissions.data?.total} to="/admissions" />
        )}
        {visible.has('wards') && (
          <StatCard
            icon={BedDouble}
            label="Bed occupancy"
            state={wards}
            value={bedStats ? `${bedStats.occupied}/${bedStats.total}` : undefined}
            suffix={bedStats ? `${bedStats.pct}%` : undefined}
            to="/wards"
          />
        )}
      </div>

      {(visible.has('appointments') || visible.has('wards')) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {visible.has('appointments') && (
            <Card className="lg:col-span-2">
              <CardHeader
                title="Today's appointments"
                subtitle={appts.data?.total ? `${appts.data.total} scheduled for ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : undefined}
                action={
                  <Link to="/appointments" className="text-xs font-medium text-[var(--color-primary)] hover:underline flex items-center gap-1">
                    View all <ArrowRight size={12} />
                  </Link>
                }
              />
              {appts.loading ? (
                <Spinner label="Loading appointments..." />
              ) : appts.error ? (
                <ErrorState message={appts.error} onRetry={appts.refetch} />
              ) : !appts.data?.data?.length ? (
                <EmptyState icon={CalendarClock} title="No appointments scheduled for today" />
              ) : (
                <Table>
                  <Thead>
                    <Th>Patient</Th>
                    <Th>Doctor</Th>
                    <Th>Type</Th>
                    <Th>Time</Th>
                    <Th>Status</Th>
                  </Thead>
                  <tbody>
                    {[...appts.data.data].reverse().map((a) => (
                      <Tr key={a.appointment_id}>
                        <Td className="font-medium">{fullName(a.patient)}</Td>
                        <Td>{a.doctor_name_snapshot}</Td>
                        <Td className="capitalize">{a.type?.replace(/_/g, ' ') || ''}</Td>
                        <Td>{formatTime(a.slot_start)}</Td>
                        <Td><StatusPill status={a.status} /></Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          )}

          {visible.has('wards') && (
            <Card>
              <CardHeader title="Ward occupancy" subtitle="Live bed utilisation" />
              <CardBody className="flex flex-col gap-4">
                {wards.loading ? (
                  <Spinner label="Loading wards..." />
                ) : wards.error ? (
                  <ErrorState message={wards.error} onRetry={wards.refetch} />
                ) : !wards.data?.data?.length ? (
                  <EmptyState icon={BedDouble} title="No wards set up yet" />
                ) : (
                  wards.data.data.map((ward) => {
                    const total = ward.bed?.length || 0;
                    const occ = ward.bed?.filter((b) => b.is_occupied).length || 0;
                    const pct = total ? Math.round((occ / total) * 100) : 0;
                    const tone = pct >= 90 ? 'var(--color-danger)' : pct >= 70 ? 'var(--color-accent)' : 'var(--color-primary)';
                    return (
                      <div key={ward.ward_id}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="font-medium text-[var(--color-ink)]">{ward.name}</span>
                          <span className="font-mono-data text-xs" style={{ color: tone }}>{occ}/{total} | {pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--color-paper)] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
