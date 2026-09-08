import { useState } from 'react';
import { Clock, CheckCircle2, LogOut, Calendar, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';
import { doctorAttendanceApi } from '../../api/doctorAttendance.js';
import { useAsync } from '../../hooks/useAsync.js';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState } from '../../components/ui/Table.jsx';
import { toast } from '../../components/ui/Toast.jsx';

export default function DoctorAttendanceBoard() {
  const user = useAuthStore((s) => s.user);
  const isAdminOrHR = ['HOSPITAL_ADMIN', 'HR', 'DIRECTOR'].includes(user?.role);
  const isDoctor = user?.role === 'DOCTOR';
  
  const TODAY = new Date().toISOString().slice(0, 10);
  const [dateFilter, setDateFilter] = useState(TODAY);
  const [processing, setProcessing] = useState(false);

  // Doctors fetch their own today record
  const { data: myAttendanceRes, refetch: refetchMine } = useAsync(
    () => isDoctor ? doctorAttendanceApi.list({ startDate: TODAY, endDate: TODAY, limit: 1 }) : Promise.resolve(null), 
    [isDoctor]
  );

  // Admins fetch the daily roster
  const { data: rosterRes, loading: rosterLoading, refetch: refetchRoster } = useAsync(
    () => isAdminOrHR ? doctorAttendanceApi.list({ startDate: dateFilter, endDate: dateFilter, limit: 100 }) : Promise.resolve(null),
    [dateFilter, isAdminOrHR]
  );

  const myAttendance = myAttendanceRes?.data?.[0];
  const roster = rosterRes?.data || [];
  const isCheckedIn = !!myAttendance?.check_in_at;
  const isCheckedOut = !!myAttendance?.check_out_at;

  async function handlePunch(type) {
    setProcessing(true);
    try {
      if (type === 'in') {
        await doctorAttendanceApi.checkIn();
        toast.success('Successfully checked in for consultations.');
      } else {
        await doctorAttendanceApi.checkOut();
        toast.success('Successfully checked out. Clinic hours completed.');
      }
      refetchMine();
      if (isAdminOrHR) refetchRoster();
    } catch (err) {
      toast.error(err.message || `Failed to check ${type}`);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Doctor Attendance</h2>
        <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Clinical roster and daily check-ins</p>
      </div>

      {isDoctor && (
        <Card className="border-t-4 border-t-[var(--color-primary)]">
          <CardBody className="flex flex-col md:flex-row items-center justify-between gap-6 p-6">
            <div className="flex items-start gap-4">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${isCheckedOut ? 'bg-[var(--color-surface)] text-[var(--color-ink-faint)]' : isCheckedIn ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]' : 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'}`}>
                <Clock size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-ink)]">Today's Schedule: {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-[var(--color-ink-soft)]">
                  <p>Status: <span className="font-medium text-[var(--color-ink)] capitalize">{myAttendance?.status || (isCheckedOut ? 'Completed' : isCheckedIn ? 'Present' : 'Not Started')}</span></p>
                  {isCheckedIn && <p className="font-mono-data">In: {new Date(myAttendance.check_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>}
                  {isCheckedOut && <p className="font-mono-data">Out: {new Date(myAttendance.check_out_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              {!isCheckedIn && !isCheckedOut && myAttendance?.status !== 'absent' && (
                <Button size="lg" icon={CheckCircle2} onClick={() => handlePunch('in')} loading={processing} className="w-full md:w-auto">
                  Check In
                </Button>
              )}
              {isCheckedIn && !isCheckedOut && (
                <Button size="lg" variant="danger" icon={LogOut} onClick={() => handlePunch('out')} loading={processing} className="w-full md:w-auto">
                  Check Out
                </Button>
              )}
              {isCheckedOut && (
                <div className="bg-[var(--color-surface)] px-4 py-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink-soft)] flex items-center gap-2">
                  <AlertCircle size={16} /> Completed
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {isAdminOrHR && (
        <Card>
          <CardHeader title="Clinical Roster" action={
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[var(--color-ink-soft)]" />
              <input 
                type="date" 
                value={dateFilter} 
                onChange={(e) => setDateFilter(e.target.value)} 
                className="text-sm border-none bg-transparent outline-none font-mono-data text-[var(--color-ink)] cursor-pointer"
              />
            </div>
          }/>
          <CardBody>
            {rosterLoading ? <Spinner /> : roster.length === 0 ? (
              <EmptyState title="No active doctors" description="No doctors have recorded attendance for the selected date." />
            ) : (
              <Table>
                <Thead>
                  <Th>Doctor</Th>
                  <Th>Status</Th>
                  <Th>Check In</Th>
                  <Th>Check Out</Th>
                </Thead>
                <tbody>
                  {roster.map(record => (
                    <Tr key={record.doctor_attendance_id}>
                      <Td className="font-medium">Dr. {record.doctor_profile?.users?.name || 'Unknown'}</Td>
                      <Td>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${record.status === 'present' ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]' : 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'}`}>
                          {record.status.replace('_', ' ')}
                        </span>
                      </Td>
                      <Td className="font-mono-data">{record.check_in_at ? new Date(record.check_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}</Td>
                      <Td className="font-mono-data">{record.check_out_at ? new Date(record.check_out_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}