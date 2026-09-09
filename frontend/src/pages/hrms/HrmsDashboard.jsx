import { useState } from 'react';
import { Users, Calendar, FileText, Plus, UserPlus } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { hrmsApi } from '../../api/hrms.js';
import Card, { CardHeader, CardBody } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import { formatDate, initials } from '../../utils/format.js';
import { toast } from '../../components/ui/Toast.jsx';
import ShiftFormModal from './ShiftFormModal.jsx';
import LeaveFormModal from './LeaveFormModal.jsx';
import InviteStaffModal from './InviteStaffModal.jsx';
import { useAuthStore } from '../../store/authStore.js';

export default function HrmsDashboard() {
  const [activeTab, setActiveTab] = useState('staff');
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const user = useAuthStore((state) => state.user);
  const canInviteStaff = ['HOSPITAL_ADMIN', 'DIRECTOR'].includes(user?.role);

  // Fetch staff directory
  const staffQuery = useAsync(() => hrmsApi.listStaff({ limit: 50 }), [], 'hrms_staff');
  const staffMembers = staffQuery.data?.data || [];

  async function handleReviewLeave(leaveId, status) {
    setProcessingId(leaveId);
    try {
      await hrmsApi.reviewLeave(leaveId, status);
      toast.success(`Leave request ${status.toLowerCase()} successfully.`);
      staffQuery.refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to update leave status.');
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Human Resources & Staff</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Manage staff directories, shifts, and leave approvals</p>
        </div>
        <div className="flex gap-2">
          {canInviteStaff && (
            <Button icon={UserPlus} onClick={() => setInviteModalOpen(true)}>Invite Staff</Button>
          )}
          <Button variant="secondary" icon={Calendar} onClick={() => setShiftModalOpen(true)}>Create Shift</Button>
          <Button icon={Plus} onClick={() => setLeaveModalOpen(true)}>Request Leave</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] gap-6">
        <button
          onClick={() => setActiveTab('staff')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'staff'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
          }`}
        >
          <Users size={16} /> Staff Directory
        </button>
      </div>

      {/* Tab Content: Staff Directory */}
      {activeTab === 'staff' && (
        <Card>
          <CardHeader title="Hospital Staff Roster" subtitle={`${staffMembers.length} active personnel`} />
          {staffQuery.loading ? (
            <Spinner label="Loading staff directory..." />
          ) : staffQuery.error ? (
            <ErrorState message={staffQuery.error} onRetry={staffQuery.refetch} />
          ) : staffMembers.length === 0 ? (
            <EmptyState icon={Users} title="No staff members found" />
          ) : (
            <Table>
              <Thead>
                <Th>Staff Member</Th>
                <Th>Role</Th>
                <Th>Email</Th>
                <Th>Joined On</Th>
              </Thead>
              <tbody>
                {staffMembers.map((member) => (
                  <Tr key={member.user_id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="h-8 w-8 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)] flex items-center justify-center text-xs font-semibold shrink-0">
                          {initials(member.name)}
                        </span>
                        <span className="font-medium text-[var(--color-ink)]">{member.name || 'Unnamed'}</span>
                      </div>
                    </Td>
                    <Td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-paper)] text-[var(--color-ink)]">
                        {member.role?.name || 'Staff'}
                      </span>
                    </Td>
                    <Td className="font-mono-data text-xs">{member.email}</Td>
                    <Td>{formatDate(member.created_at)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {/* Modals */}
      <ShiftFormModal open={shiftModalOpen} onClose={() => setShiftModalOpen(false)} onSaved={staffQuery.refetch} />
      <LeaveFormModal open={leaveModalOpen} onClose={() => setLeaveModalOpen(false)} onSaved={staffQuery.refetch} />
      <InviteStaffModal open={inviteModalOpen} onClose={() => setInviteModalOpen(false)} onSaved={staffQuery.refetch} />
    </div>
  );
}