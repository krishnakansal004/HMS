import { useState } from 'react';
import { Plus, ClipboardList, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { admissionsApi, ADMISSION_STATUSES } from '../../api/admissions.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Select } from '../../components/ui/Input.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { formatDateTime, fullName } from '../../utils/format.js';
import AdmissionForm from './AdmissionForm.jsx';
import AdmissionStatusForm from './AdmissionStatusForm.jsx';

const PAGE_SIZE = 20;

export default function AdmissionsList() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);

  const { data, loading, error, refetch } = useAsync(
    () => admissionsApi.list({ status: status || undefined, page, limit: PAGE_SIZE }),
    [status, page],
  );

  const admissions = data?.data || [];
  const total = data?.total ?? admissions.length;
  const pages = data?.pages ?? 1;

  function handleStatusFilter(e) {
    setPage(1);
    setStatus(e.target.value);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Admissions</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">
            {total} admission {total === 1 ? 'record' : 'records'}
          </p>
        </div>
        <Button icon={Plus} onClick={() => setFormOpen(true)}>Admit Patient</Button>
      </div>

      <Card>
        <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <Select value={status} onChange={handleStatusFilter} className="max-w-xs">
            <option value="">All statuses</option>
            {ADMISSION_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <Spinner label="Loading admissions…" />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : admissions.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={status ? `No ${status} admissions` : 'No admissions yet'}
            description={status ? 'Try a different status filter.' : 'Admit a patient to get started.'}
            action={
              !status && (
                <Button size="sm" icon={Plus} onClick={() => setFormOpen(true)}>Admit Patient</Button>
              )
            }
          />
        ) : (
          <>
            <Table>
              <Thead>
                <Th>Patient</Th>
                <Th>Bed</Th>
                <Th>Status</Th>
                <Th>Admitted</Th>
                <Th>Discharged</Th>
                <Th className="text-right">Actions</Th>
              </Thead>
              <tbody>
                {admissions.map((a) => (
                  <Tr key={a.admission_id}>
                    <Td>
                      <p className="font-medium">{fullName(a.patient)}</p>
                      <p className="text-xs text-[var(--color-ink-faint)] font-mono-data">
                        {a.admission_id?.slice(0, 8)}
                      </p>
                    </Td>
                    <Td>{a.bed?.bed_number ? `Bed ${a.bed.bed_number}` : '—'}</Td>
                    <Td><StatusPill status={a.status} /></Td>
                    <Td>{formatDateTime(a.admission_date)}</Td>
                    <Td>{formatDateTime(a.discharge_date)}</Td>
                    <Td className="text-right">
                      {a.status === 'admitted' ? (
                        <Button size="sm" variant="ghost" icon={LogOut} onClick={() => setStatusTarget(a)}>
                          Update Status
                        </Button>
                      ) : (
                        <span className="text-xs text-[var(--color-ink-faint)]">—</span>
                      )}
                    </Td>
                  </Tr>
                ))}
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

      <AdmissionForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} />

      <AdmissionStatusForm
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onSaved={refetch}
        admission={statusTarget}
      />
    </div>
  );
}
