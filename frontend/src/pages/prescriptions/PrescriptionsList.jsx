import { useState } from 'react';
import { Plus, FileStack, ChevronLeft, ChevronRight, Eye, Check, X } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { prescriptionsApi } from '../../api/prescriptions.js';
import { useAuthStore } from '../../store/authStore.js';
import { ROLES } from '../../utils/roles.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { toast } from '../../components/ui/Toast.jsx';
import { formatDate, fullName, splitPrescriptionNotes } from '../../utils/format.js';
import PrescriptionForm from './PrescriptionForm.jsx';
import PrescriptionDetails from './PrescriptionDetails.jsx';

const PAGE_SIZE = 20;

export default function PrescriptionsList() {
  const role = useAuthStore((s) => s.user?.role);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [actingId, setActingId] = useState(null);

  const { data, loading, error, refetch } = useAsync(
    () => prescriptionsApi.list({ page, limit: PAGE_SIZE }),
    [page],
  );

  const prescriptions = data?.data || [];
  const total = data?.total ?? prescriptions.length;
  const pages = data?.pages ?? 1;
  const canApprove = role === ROLES.HOSPITAL_ADMIN;

  async function handleApproval(id, status) {
    setActingId(id);
    try {
      await prescriptionsApi.setApproval(id, status);
      toast.success(`Prescription ${status}`);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to update prescription');
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Prescriptions</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">
            {total} prescription {total === 1 ? 'record' : 'records'}
          </p>
        </div>
        {role === ROLES.DOCTOR && (
          <Button icon={Plus} onClick={() => setFormOpen(true)}>New Prescription</Button>
        )}
      </div>

      <Card>
        {loading ? (
          <Spinner label="Loading prescriptions…" />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : prescriptions.length === 0 ? (
          <EmptyState
            icon={FileStack}
            title="No prescriptions yet"
            description={role === ROLES.DOCTOR ? 'Create a prescription to get started.' : 'Prescriptions created by doctors will appear here.'}
            action={
              role === ROLES.DOCTOR && (
                <Button size="sm" icon={Plus} onClick={() => setFormOpen(true)}>New Prescription</Button>
              )
            }
          />
        ) : (
          <>
            <Table>
              <Thead>
                <Th>Patient</Th>
                <Th>Doctor</Th>
                <Th>Diagnosis</Th>
                <Th>Medicines</Th>
                <Th>Status</Th>
                <Th>Date</Th>
                <Th className="text-right">Actions</Th>
              </Thead>
              <tbody>
                {prescriptions.map((p) => {
                  const { diagnosis } = splitPrescriptionNotes(p.notes);
                  const items = Array.isArray(p.medicines) ? p.medicines : [];
                  return (
                    <Tr key={p.prescription_id}>
                      <Td className="font-medium">{fullName(p.patient)}</Td>
                      <Td>{p.doctor_profile?.users?.name || '—'}</Td>
                      <Td className="max-w-[220px] truncate">{diagnosis}</Td>
                      <Td>{items.length}</Td>
                      <Td><StatusPill status={p.approval_status} /></Td>
                      <Td>{formatDate(p.created_at)}</Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="ghost" icon={Eye} onClick={() => setViewing(p)}>
                            View
                          </Button>
                          {canApprove && p.approval_status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={Check}
                                loading={actingId === p.prescription_id}
                                onClick={() => handleApproval(p.prescription_id, 'approved')}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                icon={X}
                                loading={actingId === p.prescription_id}
                                onClick={() => handleApproval(p.prescription_id, 'rejected')}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>

            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-ink-soft)]">Page {page} of {pages}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={ChevronLeft}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Prev
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={ChevronRight}
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <PrescriptionForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} />

      <PrescriptionDetails open={!!viewing} onClose={() => setViewing(null)} prescription={viewing} />
    </div>
  );
}
