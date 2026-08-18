import { useState } from 'react';
import { Plus, CalendarClock } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { appointmentsApi, APPOINTMENT_STATUSES } from '../../api/appointments.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Select } from '../../components/ui/Input.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import { formatDateTime, fullName } from '../../utils/format.js';
import { toast } from '../../components/ui/Toast.jsx';
import AppointmentForm from './AppointmentForm.jsx';

export default function AppointmentsList() {
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const { data, loading, error, refetch } = useAsync(
    () => appointmentsApi.list({ status: statusFilter || undefined, limit: 25 }),
    [statusFilter]
  );

  const appts = data?.data || [];

  async function handleStatusChange(id, status) {
    setUpdatingId(id);
    try {
      await appointmentsApi.updateStatus(id, status);
      toast.success('Appointment updated');
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Appointments</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">{data?.total ?? appts.length} total</p>
        </div>
        <Button icon={Plus} onClick={() => setFormOpen(true)}>Book appointment</Button>
      </div>

      <Card>
        <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[200px]">
            <option value="">All statuses</option>
            {APPOINTMENT_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <Spinner label="Loading appointments…" />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : appts.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No appointments found"
            description={statusFilter ? 'Try a different status filter.' : 'Book the first appointment to get started.'}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Patient</Th>
              <Th>Doctor</Th>
              <Th>Scheduled</Th>
              <Th>Type</Th>
              <Th>Status</Th>
              <Th className="text-right">Update status</Th>
            </Thead>
            <tbody>
              {appts.map((a) => (
                <Tr key={a.appointment_id}>
                  <Td>{fullName(a.patient) || a.patient_id?.slice(0, 8)}</Td>
                  
                  {/* FIX 1: Map to Prisma's exact column for the Doctor's name */}
                  <Td>{a.doctor_name_snapshot || a.doctor_id?.slice(0, 8) || '—'}</Td>
                  
                  {/* FIX 2: Map to Prisma's exact column for the Date/Time */}
                  <Td>{formatDateTime(a.slot_start)}</Td>
                  
                  <Td className="capitalize">{a.type?.replace('_', ' ').toLowerCase()}</Td>
                  <Td><StatusPill status={a.status} /></Td>
                  <Td className="text-right">
                    <Select
                      value=""
                      disabled={updatingId === a.appointment_id}
                      onChange={(e) => e.target.value && handleStatusChange(a.appointment_id, e.target.value)}
                      className="max-w-[160px] ml-auto"
                    >
                      <option value="">Change to...</option>
                      {APPOINTMENT_STATUSES.filter((s) => s !== a.status).map((s) => (
                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                      ))}
                    </Select>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <AppointmentForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} />
    </div>
  );
}
