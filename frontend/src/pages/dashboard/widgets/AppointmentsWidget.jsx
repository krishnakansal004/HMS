import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { useAsync } from '../../../hooks/useAsync.js';
import { appointmentsApi } from '../../../api/appointments.js';
import Card, { CardHeader } from '../../../components/ui/Card.jsx';
import { Table, Thead, Th, Tr, Td, EmptyState, ErrorState } from '../../../components/ui/Table.jsx';
import StatusPill from '../../../components/ui/StatusPill.jsx';
import { SkeletonRow } from '../../../components/ui/Skeleton.jsx';
import { fullName } from '../../../utils/format.js';

export default function AppointmentsWidget({ doctorId }) {
  const TODAY = new Date().toISOString().slice(0, 10);
  
  // Scopes to a specific doctor if provided, otherwise fetches hospital-wide
  const { data, loading, error, refetch } = useAsync(
    () => appointmentsApi.list({ date: TODAY, limit: 8, doctorId }), 
    [doctorId], 
    `dash_appts_${doctorId || 'all'}`
  );

  return (
    <Card className="h-full">
      <CardHeader
        title="Today's Appointments"
        subtitle={data?.total ? `${data.total} scheduled` : undefined}
        action={
          <Link to="/appointments" className="text-xs font-medium text-[var(--color-primary)] hover:underline flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        }
      />
      {error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : !loading && !data?.data?.length ? (
        <EmptyState icon={CalendarClock} title="No appointments scheduled for today" />
      ) : (
        <Table>
          <Thead>
            <Th>Time</Th>
            <Th>Patient</Th>
            {!doctorId && <Th>Doctor</Th>}
            <Th>Type</Th>
            <Th>Status</Th>
          </Thead>
          <tbody>
            {loading ? (
              <>
                <SkeletonRow columns={doctorId ? 4 : 5} />
                <SkeletonRow columns={doctorId ? 4 : 5} />
                <SkeletonRow columns={doctorId ? 4 : 5} />
              </>
            ) : (
              [...data.data].reverse().map((a) => {
                const timeStr = new Date(a.slot_start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                return (
                  <Tr key={a.appointment_id}>
                    <Td className="font-mono-data font-medium">{timeStr}</Td>
                    <Td className="font-medium">{fullName(a.patient)}</Td>
                    {!doctorId && <Td>{a.doctor_name_snapshot}</Td>}
                    <Td className="capitalize">{a.type?.replace(/_/g, ' ')}</Td>
                    <Td><StatusPill status={a.status} /></Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      )}
    </Card>
  );
}