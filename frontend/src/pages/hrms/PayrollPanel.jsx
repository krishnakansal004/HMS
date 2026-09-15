import { useMemo, useState } from 'react';
import { CheckCircle2, Lock, Play, WalletCards } from 'lucide-react';
import { payrollApi } from '../../api/payroll.js';
import { hrmsApi } from '../../api/hrms.js';
import { useAsync } from '../../hooks/useAsync.js';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { ErrorState, Spinner, Table, Td, Th, Thead, Tr } from '../../components/ui/Table.jsx';
import { formatPaise } from '../../utils/format.js';
import { toast } from '../../components/ui/Toast.jsx';
import { useAuthStore } from '../../store/authStore.js';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function PayrollPanel() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'HOSPITAL_ADMIN';
  const [month, setMonth] = useState(currentMonth());
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [working, setWorking] = useState(false);
  const [salaryDrafts, setSalaryDrafts] = useState({});
  const [adjustmentDrafts, setAdjustmentDrafts] = useState({});
  const runs = useAsync(() => payrollApi.listRuns({ limit: 25 }), [], 'payroll_runs');
  const compensation = useAsync(() => payrollApi.listCompensation(), [], 'payroll_compensation');
  const staff = useAsync(() => hrmsApi.listStaff({ limit: 100 }), [], 'hrms_payroll_staff');
  const detail = useAsync(
    () => selectedRunId ? payrollApi.getRun(selectedRunId) : Promise.resolve({ data: null }),
    [selectedRunId],
    selectedRunId ? `payroll_run_${selectedRunId}` : null,
  );
  const runList = runs.data?.data || [];
  const staffMembers = (staff.data?.data || []).filter((member) => !['DOCTOR', 'PATIENT', 'SYSTEM_OWNER'].includes(member.role?.name));
  const compensationByUser = Object.fromEntries((compensation.data?.data || []).map((item) => [item.user_id, item]));
  const selectedRun = detail.data?.data;
  const totalPayable = useMemo(
    () => (selectedRun?.items || []).reduce((sum, item) => sum + Number(item.net_pay_paise || 0), 0),
    [selectedRun],
  );

  function adjustmentFor(item) {
    return adjustmentDrafts[item.payroll_item_id] || {
      additions: Number(item.additions_paise || 0) / 100,
      deductions: Number(item.deductions_paise || 0) / 100,
      adjustmentNote: item.adjustment_note || '',
    };
  }

  async function runAction(action, successMessage) {
    setWorking(true);
    try {
      await action();
      toast.success(successMessage);
      runs.refetch();
      detail.refetch();
      compensation.refetch();
      staff.refetch();
    } catch (error) {
      toast.error(error.message || 'Payroll action failed.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="Salary profiles" subtitle="Set monthly gross salary and employment dates before generating payroll." />
        {staff.loading || compensation.loading ? <Spinner label="Loading salary profiles..." /> : (
          <Table>
            <Thead><Th>Staff</Th><Th>Role</Th><Th>Monthly gross (₹)</Th><Th>Employment start</Th><Th>Employment end</Th><Th /></Thead>
            <tbody>
              {staffMembers.map((member) => {
                const saved = compensationByUser[member.user_id];
                const draft = salaryDrafts[member.user_id] || {
                  monthlyGross: saved ? Number(saved.monthly_gross_paise) / 100 : '',
                  employmentStartDate: saved?.employment_start_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
                  employmentEndDate: saved?.employment_end_date?.slice(0, 10) || '',
                };
                return (
                  <Tr key={member.user_id}>
                    <Td><div className="font-medium">{member.name || 'Unnamed'}</div><div className="text-xs text-[var(--color-ink-soft)]">{member.email}</div></Td>
                    <Td>{member.role?.name || 'Staff'}</Td>
                    <Td><input className="w-28 rounded border border-[var(--color-border-strong)] px-2 py-1 text-sm" type="number" min="0.01" step="0.01" value={draft.monthlyGross} disabled={!isAdmin} onChange={(event) => setSalaryDrafts((current) => ({ ...current, [member.user_id]: { ...draft, monthlyGross: event.target.value } }))} /></Td>
                    <Td><input className="rounded border border-[var(--color-border-strong)] px-2 py-1 text-sm" type="date" value={draft.employmentStartDate} disabled={!isAdmin} onChange={(event) => setSalaryDrafts((current) => ({ ...current, [member.user_id]: { ...draft, employmentStartDate: event.target.value } }))} /></Td>
                    <Td><input className="rounded border border-[var(--color-border-strong)] px-2 py-1 text-sm" type="date" value={draft.employmentEndDate} disabled={!isAdmin} onChange={(event) => setSalaryDrafts((current) => ({ ...current, [member.user_id]: { ...draft, employmentEndDate: event.target.value } }))} /></Td>
                    <Td>{isAdmin && <Button size="sm" variant="secondary" disabled={!draft.monthlyGross} onClick={() => runAction(() => payrollApi.setCompensation(member.user_id, draft), 'Salary profile saved.')}>Save</Button>}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader title="Generate payroll" subtitle="Doctors are excluded; approved leave is paid and unrecorded absence is unpaid." />
          <CardBody className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-[var(--color-ink-soft)]">
              Payroll month
              <input className="mt-1 block rounded border border-[var(--color-border-strong)] px-3 py-2 text-sm" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            </label>
            <Button icon={Play} loading={working} onClick={() => runAction(() => payrollApi.createRun(month), 'Payroll draft generated.')}>Generate draft</Button>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Payroll runs" subtitle="Review, freeze, then mark external bank transfers as paid." />
        {runs.loading ? <Spinner label="Loading payroll runs..." /> : runs.error ? <ErrorState message={runs.error} onRetry={runs.refetch} /> : (
          <Table>
            <Thead><Th>Period</Th><Th>Timezone</Th><Th>Status</Th><Th>Staff</Th><Th /></Thead>
            <tbody>
              {runList.map((run) => (
                <Tr key={run.payroll_run_id}>
                  <Td>{String(run.period_start).slice(0, 10)}</Td>
                  <Td>{run.timezone}</Td>
                  <Td>{run.status}</Td>
                  <Td>{run._count?.items ?? '—'}</Td>
                  <Td><Button size="sm" variant="secondary" onClick={() => setSelectedRunId(run.payroll_run_id)}>Open</Button></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {selectedRun && (
        <Card>
          <CardHeader
            title={`Payroll details · ${String(selectedRun.period_start).slice(0, 10)}`}
            subtitle={`Total payable ${formatPaise(totalPayable)}`}
            action={isAdmin && (
              <div className="flex gap-2">
                {selectedRun.status === 'DRAFT' && <Button size="sm" icon={Lock} loading={working} onClick={() => runAction(() => payrollApi.freezeRun(selectedRun.payroll_run_id), 'Payroll frozen.')}>Freeze</Button>}
                {['FROZEN', 'PARTIALLY_PAID'].includes(selectedRun.status) && <Button size="sm" icon={CheckCircle2} loading={working} onClick={() => runAction(() => payrollApi.markAllPaid(selectedRun.payroll_run_id), 'All salaries marked paid.')}>Mark all paid</Button>}
              </div>
            )}
          />
          <Table>
            <Thead><Th>Staff</Th><Th>Paid days</Th><Th>Gross</Th><Th>Manual additions / deductions</Th><Th>Net</Th><Th>Status</Th><Th /></Thead>
            <tbody>
              {selectedRun.items.map((item) => (
                <Tr key={item.payroll_item_id}>
                  <Td><div className="font-medium">{item.employee_name_snapshot}</div><div className="text-xs text-[var(--color-ink-soft)]">{item.role_name_snapshot}</div></Td>
                  <Td>{item.paid_days}</Td>
                  <Td>{formatPaise(item.gross_payable_paise)}</Td>
                  <Td>
                    {selectedRun.status === 'DRAFT' && isAdmin ? (() => {
                      const draft = adjustmentFor(item);
                      return (
                        <div className="flex flex-col gap-1 min-w-40">
                          <input className="rounded border border-[var(--color-border-strong)] px-2 py-1 text-xs" type="number" min="0" step="0.01" placeholder="Addition ₹" value={draft.additions} onChange={(event) => setAdjustmentDrafts((current) => ({ ...current, [item.payroll_item_id]: { ...draft, additions: event.target.value } }))} />
                          <input className="rounded border border-[var(--color-border-strong)] px-2 py-1 text-xs" type="number" min="0" step="0.01" placeholder="Deduction ₹" value={draft.deductions} onChange={(event) => setAdjustmentDrafts((current) => ({ ...current, [item.payroll_item_id]: { ...draft, deductions: event.target.value } }))} />
                          <input className="rounded border border-[var(--color-border-strong)] px-2 py-1 text-xs" type="text" maxLength="1000" placeholder="Note" value={draft.adjustmentNote} onChange={(event) => setAdjustmentDrafts((current) => ({ ...current, [item.payroll_item_id]: { ...draft, adjustmentNote: event.target.value } }))} />
                          <Button size="sm" variant="secondary" onClick={() => runAction(() => payrollApi.updateAdjustments(selectedRun.payroll_run_id, item.payroll_item_id, draft), 'Adjustments saved.')}>Save</Button>
                        </div>
                      );
                    })() : formatPaise(Number(item.additions_paise || 0) - Number(item.deductions_paise || 0))}
                  </Td>
                  <Td>{formatPaise(item.net_pay_paise)}</Td>
                  <Td>{item.payment_status}</Td>
                  <Td>{isAdmin && ['FROZEN', 'PARTIALLY_PAID'].includes(selectedRun.status) && item.payment_status === 'UNPAID' && <Button size="sm" variant="secondary" icon={WalletCards} loading={working} onClick={() => runAction(() => payrollApi.markPaid(selectedRun.payroll_run_id, item.payroll_item_id), 'Salary marked paid.')}>Mark paid</Button>}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
