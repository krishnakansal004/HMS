import { useState } from 'react';
import { Plus, Receipt } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { invoicesApi, INVOICE_STATUSES } from '../../api/invoices.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Select } from '../../components/ui/Input.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { formatDate, formatPaise, fullName } from '../../utils/format.js';
import { useAuthStore } from '../../store/authStore.js';
import { ROLES } from '../../utils/roles.js';
import InvoiceForm from './InvoiceForm.jsx';
import PayButton from './PayButton.jsx';

const PAGE_SIZE = 20;
const BILLING_ROLES = [ROLES.HOSPITAL_ADMIN, ROLES.ACCOUNTANT, ROLES.CASHIER];

// invoiceService.js persists status lowercase ('pending'/'partial'/'paid'/
// 'cancelled') while the validator/INVOICE_STATUSES use uppercase — an
// existing inconsistency in the backend, not introduced here. Normalize
// case-insensitively so this page (and the Pay button gating) is correct
// regardless of which casing the API actually returns.
const TONE_BY_STATUS = { DRAFT: 'neutral', PENDING: 'warning', PARTIAL: 'accent', PAID: 'success', CANCELLED: 'danger' };

export default function InvoicesList() {
  const role = useAuthStore((s) => s.user?.role);
  const canBill = BILLING_ROLES.includes(role);

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);

  const { data, loading, error, refetch } = useAsync(
    () => invoicesApi.list({ status: status || undefined, page, limit: PAGE_SIZE }),
    [status, page],
  );

  const invoices = data?.data || [];
  const total = data?.total ?? invoices.length;
  const pages = data?.pages ?? 1;

  function handleStatusFilter(e) {
    setPage(1);
    setStatus(e.target.value);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Billing</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">
            {total} invoice {total === 1 ? 'record' : 'records'}
          </p>
        </div>
        {canBill && <Button icon={Plus} onClick={() => setFormOpen(true)}>New Invoice</Button>}
      </div>

      <Card>
        <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <Select value={status} onChange={handleStatusFilter} className="max-w-xs">
            <option value="">All statuses</option>
            {INVOICE_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <Spinner label="Loading invoices…" />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={status ? `No ${status} invoices` : 'No invoices yet'}
            description={status ? 'Try a different status filter.' : 'Create an invoice to get started.'}
            action={
              !status && canBill && (
                <Button size="sm" icon={Plus} onClick={() => setFormOpen(true)}>New Invoice</Button>
              )
            }
          />
        ) : (
          <>
            <Table>
              <Thead>
                <Th>Patient</Th>
                <Th>Total</Th>
                <Th>Paid</Th>
                <Th>Balance</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th className="text-right">Actions</Th>
              </Thead>
              <tbody>
                {invoices.map((inv) => {
                  const balance = Number(inv.total) - Number(inv.amount_paid);
                  const normalizedStatus = (inv.status || '').toUpperCase();
                  const payable = canBill && balance > 0 && (normalizedStatus === 'PENDING' || normalizedStatus === 'PARTIAL');
                  return (
                    <Tr key={inv.invoice_id}>
                      <Td>
                        <p className="font-medium">{fullName(inv.patient)}</p>
                        <p className="text-xs text-[var(--color-ink-faint)] font-mono-data">
                          {inv.invoice_id?.slice(0, 8)}
                        </p>
                      </Td>
                      <Td>{formatPaise(inv.total)}</Td>
                      <Td>{formatPaise(inv.amount_paid)}</Td>
                      <Td>{formatPaise(balance)}</Td>
                      <Td>
                        <StatusPill status={inv.status} tone={TONE_BY_STATUS[normalizedStatus]} />
                      </Td>
                      <Td>{formatDate(inv.created_at)}</Td>
                      <Td className="text-right">
                        {payable ? (
                          <PayButton invoice={inv} balance={formatPaise(balance)} onPaid={refetch} />
                        ) : (
                          <span className="text-xs text-[var(--color-ink-faint)]">—</span>
                        )}
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
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Prev
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
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

      <InvoiceForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} />
    </div>
  );
}
