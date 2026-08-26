import { useState } from 'react';
import { Plus, FileStack, CheckCircle, XCircle } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { prescriptionsApi } from '../../api/prescriptions.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import { formatDate, fullName } from '../../utils/format.js';
import { toast } from '../../components/ui/Toast.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { ROLES } from '../../utils/roles.js';
import CreatePrescriptionModal from './CreatePrescriptionModal.jsx';

export default function PrescriptionsList() {
  const user = useAuthStore((s) => s.user);
  const [formOpen, setFormOpen] = useState(false);

  const { data, loading, error, refetch } = useAsync(() => prescriptionsApi.list({ limit: 50 }), []);
  const prescriptions = data?.data || [];

  async function handleApproval(id, status) {
    try {
      await prescriptionsApi.setApproval(id, status);
      toast.success(`Prescription ${status}.`);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to update approval.');
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Prescriptions</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Clinical regimens and pharmacy approvals</p>
        </div>
        {user?.role === ROLES.DOCTOR && (
          <Button icon={Plus} onClick={() => setFormOpen(true)}>Issue Prescription</Button>
        )}
      </div>

      <Card>
        {loading ? (
          <Spinner label="Loading prescriptions..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : prescriptions.length === 0 ? (
          <EmptyState
            icon={FileStack}
            title="No Prescriptions Found"
            description="Prescriptions authored by doctors will appear here."
            action={user?.role === ROLES.DOCTOR && <Button size="sm" icon={Plus} onClick={() => setFormOpen(true)}>Issue Prescription</Button>}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Patient</Th>
              <Th>Doctor</Th>
              <Th>Date Issued</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </Thead>
            <tbody>
              {prescriptions.map((script) => (
                <Tr key={script.prescription_id}>
                  <Td className="font-medium text-[var(--color-ink)]">{fullName(script.patient)}</Td>
                  <Td>Dr. {script.doctor_profile?.users?.name || 'Unknown'}</Td>
                  <Td>{formatDate(script.created_at)}</Td>
                  <Td><StatusPill status={script.approval_status} /></Td>
                  <Td className="text-right flex items-center justify-end gap-2">
                    {script.approval_status === 'pending' && user?.role === ROLES.HOSPITAL_ADMIN && (
                      <>
                        <Button size="sm" variant="danger" icon={XCircle} onClick={() => handleApproval(script.prescription_id, 'rejected')}>Reject</Button>
                        <Button size="sm" variant="primary" icon={CheckCircle} onClick={() => handleApproval(script.prescription_id, 'approved')}>Approve</Button>
                      </>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <CreatePrescriptionModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} />
    </div>
  );
}