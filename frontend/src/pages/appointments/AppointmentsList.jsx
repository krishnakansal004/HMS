import { useState, useMemo } from 'react';
import { Plus, CalendarClock, UserCheck, Stethoscope, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync.js';
import { appointmentsApi, APPOINTMENT_STATUSES } from '../../api/appointments.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Select } from '../../components/ui/Input.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import { formatDateTime, fullName, initials } from '../../utils/format.js';
import { toast } from '../../components/ui/Toast.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { ROLES } from '../../utils/roles.js';

import AppointmentForm from './AppointmentForm.jsx';

export default function AppointmentsList() {
  const user = useAuthStore((s) => s.user);
  const isDoctor = user?.role === ROLES.DOCTOR;
  const isPatient = user?.role === ROLES.PATIENT;

  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [formOpen, setFormOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const { data, loading, error, refetch } = useAsync(
    () => appointmentsApi.list({ 
      status: statusFilter || undefined, 
      date: dateFilter || undefined,
      limit: 50 
    }),
    [statusFilter, dateFilter]
  );

  const appts = data?.data || [];

  const { checkedIn, scheduled, completed } = useMemo(() => {
    return {
      checkedIn: appts.filter(a => ['checked_in', 'in_progress'].includes(a.status)),
      scheduled: appts.filter(a => ['scheduled', 'confirmed'].includes(a.status)),
      completed: appts.filter(a => ['completed', 'cancelled', 'no_show'].includes(a.status)),
    };
  }, [appts]);

  async function handleStatusChange(id, status) {
    setUpdatingId(id);
    try {
      await appointmentsApi.updateStatus(id, status);
      toast.success('Appointment status updated.');
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to update status.');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Appointments</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Manage patient consultations and daily schedule</p>
        </div>
        {/* ✅ DOCTORS CAN NOW SEE THIS BUTTON */}
        <Button icon={Plus} onClick={() => setFormOpen(true)}>Book Appointment</Button>
      </div>

      <div className="flex items-center gap-3">
        <input 
          type="date" 
          className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-white px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-primary)] transition-colors"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-48">
          <option value="">All Statuses</option>
          {APPOINTMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </Select>
        {(dateFilter !== '' || statusFilter !== '') && (
          <button 
            onClick={() => { setDateFilter(''); setStatusFilter(''); }}
            className="text-xs font-medium text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {dateFilter && !loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TriageCard title="Waiting / In Progress" count={checkedIn.length} icon={UserCheck} tone="accent" />
          <TriageCard title="Upcoming Scheduled" count={scheduled.length} icon={CalendarClock} tone="primary" />
          <TriageCard title="Completed / Cancelled" count={completed.length} icon={Stethoscope} tone="neutral" />
        </div>
      )}

      <Card>
        {loading ? (
          <Spinner label="Loading schedule..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : appts.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No appointments found"
            description={dateFilter || statusFilter ? 'Try clearing your filters.' : 'Your schedule is clear.'}
            action={!dateFilter && !statusFilter && <Button onClick={() => setFormOpen(true)}>Book Appointment</Button>}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Time</Th>
              {!isPatient && <Th>Patient</Th>}
              {!isDoctor && <Th>Doctor</Th>}
              <Th>Type</Th>
              <Th>Status</Th>
              {!isPatient && <Th className="text-right">Workflow Actions</Th>}
            </Thead>
            <tbody>
              {appts.map((a) => {
                const timeStr = new Date(a.slot_start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                return (
                  <Tr key={a.appointment_id} className={a.status === 'in_progress' ? 'bg-[var(--color-accent-soft)]/30' : ''}>
                    <Td className="font-mono-data font-semibold text-[var(--color-ink)] whitespace-nowrap">{timeStr}</Td>
                    
                    {!isPatient && (
                      <Td>
                        <div className="flex items-center gap-3">
                          <span className="h-8 w-8 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)] flex items-center justify-center text-xs font-semibold shrink-0">
                            {initials(fullName(a.patient))}
                          </span>
                          <span className="font-medium text-[var(--color-ink)]">{fullName(a.patient) || 'Unknown'}</span>
                        </div>
                      </Td>
                    )}

                    {!isDoctor && <Td className="text-sm">Dr. {a.doctor_name_snapshot}</Td>}
                    <Td className="capitalize text-sm">{a.type?.replace('_', ' ').toLowerCase()}</Td>
                    <Td><StatusPill status={a.status} /></Td>
                    
                    {/* Hide entirely for Patients */}
                    {!isPatient && (
                      <Td className="text-right flex items-center justify-end gap-2">
                        {/* ... your existing action buttons ... */}
                      </Td>
                    )}
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      <AppointmentForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} />
    </div>
  );
}

function TriageCard({ title, count, icon: Icon, tone }) {
  const tones = {
    primary: 'bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]',
    accent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
    neutral: 'bg-[var(--color-paper)] text-[var(--color-ink-soft)]'
  };
  return (
    <div className={`p-4 rounded-[var(--radius-md)] border border-[var(--color-border)] flex items-center justify-between ${tones[tone]}`}>
      <div className="flex items-center gap-3">
        <Icon size={20} className="opacity-80" />
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <span className="font-display font-bold text-2xl">{count}</span>
    </div>
  );
}