import { useState } from 'react';
import { Plus, ClipboardList, LogOut } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { admissionsApi, ADMISSION_STATUSES } from '../../api/admissions.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Select } from '../../components/ui/Input.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import { formatDate, fullName } from '../../utils/format.js';
import { toast } from '../../components/ui/Toast.jsx';

import AdmissionForm from './AdmissionForm.jsx';
import DischargeModal from './DischargeModal.jsx';

export default function AdmissionsList() {
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [discharging, setDischarging] = useState(null);

  const { data, loading, error, refetch } = useAsync(
    () => admissionsApi.list({ status: statusFilter || undefined, limit: 50 }),
    [statusFilter]
  );

  const admissions = data?.data || [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Admissions</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Manage inpatient stays and discharges</p>
        </div>
        <Button icon={Plus} onClick={() => setFormOpen(true)}>Admit Patient</Button>
      </div>

      <Card>
        <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[200px]">
            <option value="">All Statuses</option>
            {ADMISSION_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <Spinner label="Loading admissions..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : admissions.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No admissions found"
            description={statusFilter ? 'Try clearing your status filter.' : 'Admit a patient to see their records here.'}
            action={!statusFilter && <Button size="sm" icon={Plus} onClick={() => setFormOpen(true)}>Admit Patient</Button>}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Patient</Th>
              <Th>Bed Assignment</Th>
              <Th>Admission Date</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </Thead>
            <tbody>
              {admissions.map((adm) => (
                <Tr key={adm.admission_id}>
                  <Td>
                    <p className="font-medium text-[var(--color-ink)]">{fullName(adm.patient) || 'Unknown'}</p>
                    <p className="text-xs text-[var(--color-ink-faint)] truncate max-w-[200px]" title={adm.diagnosis}>
                      {adm.diagnosis || 'No diagnosis recorded'}
                    </p>
                  </Td>
                  <Td>
                    {adm.bed ? (
                      <span className="font-mono-data font-medium text-sm">Bed {adm.bed.bed_number}</span>
                    ) : (
                      <span className="text-xs text-[var(--color-ink-faint)] italic">Unassigned</span>
                    )}
                  </Td>
                  <Td>
                    <p className="text-sm">{formatDate(adm.admission_date)}</p>
                    {adm.discharge_date && (
                      <p className="text-xs text-[var(--color-ink-faint)]">Discharged: {formatDate(adm.discharge_date)}</p>
                    )}
                  </Td>
                  <Td><StatusPill status={adm.status} /></Td>
                  <Td className="text-right">
                    {adm.status === 'admitted' && (
                      <Button size="sm" variant="secondary" icon={LogOut} onClick={() => setDischarging(adm)}>
                        Discharge
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Mounted Modals */}
      <AdmissionForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} />
      <DischargeModal open={!!discharging} onClose={() => setDischarging(null)} admission={discharging} onSaved={refetch} />
    </div>
  );
}
