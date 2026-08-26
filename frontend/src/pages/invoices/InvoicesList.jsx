import { useState } from 'react';
import { Plus, Receipt, CreditCard } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { invoicesApi, INVOICE_STATUSES } from '../../api/invoices.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Select } from '../../components/ui/Input.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import { formatPaise, formatDate, fullName } from '../../utils/format.js';

import GenerateInvoiceForm from './GenerateInvoiceForm.jsx';
import RecordPaymentModal from './RecordPaymentModal.jsx';

export default function InvoicesList() {
  const [statusFilter, setStatusFilter] = useState('');
  const [generateOpen, setGenerateOpen] = useState(false);
  const [payingInvoice, setPayingInvoice] = useState(null);

  const { data, loading, error, refetch } = useAsync(
    () => invoicesApi.list({ status: statusFilter || undefined, limit: 50 }),
    [statusFilter]
  );

  const invoices = data?.data || data?.invoices || []; // Handle tuple or generic array wrapping

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Billing & Invoices</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Manage patient billing and payment collection</p>
        </div>
        <Button icon={Plus} onClick={() => setGenerateOpen(true)}>Generate Invoice</Button>
      </div>

      <Card>
        <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[200px]">
            <option value="">All Statuses</option>
            {INVOICE_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <Spinner label="Loading financial ledger..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No invoices found"
            description={statusFilter ? 'Try clearing your status filter.' : 'Generate your first bill to start collecting revenue.'}
            action={!statusFilter && <Button size="sm" icon={Plus} onClick={() => setGenerateOpen(true)}>Generate Invoice</Button>}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Invoice #</Th>
              <Th>Patient</Th>
              <Th>Created On</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </Thead>
            <tbody>
              {invoices.map((inv) => (
                <Tr key={inv.invoice_id}>
                  <Td className="font-mono-data font-medium">#{inv.invoice_number}</Td>
                  <Td>{fullName(inv.patient) || 'Unknown'}</Td>
                  <Td>{formatDate(inv.created_at)}</Td>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-mono-data font-semibold text-[var(--color-ink)]">{formatPaise(inv.total)}</span>
                      {Number(inv.amount_paid) > 0 && Number(inv.amount_paid) < Number(inv.total) && (
                        <span className="text-[10px] text-[var(--color-ink-faint)]">Paid: {formatPaise(inv.amount_paid)}</span>
                      )}
                    </div>
                  </Td>
                  <Td><StatusPill status={inv.status} /></Td>
                  <Td className="text-right">
                    {(inv.status === 'PENDING' || inv.status === 'PARTIAL' || inv.status === 'DRAFT') && (
                      <Button size="sm" variant="primary" icon={CreditCard} onClick={() => setPayingInvoice(inv)}>
                        Pay
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
      <GenerateInvoiceForm open={generateOpen} onClose={() => setGenerateOpen(false)} onSaved={refetch} />
      <RecordPaymentModal open={!!payingInvoice} onClose={() => setPayingInvoice(null)} invoice={payingInvoice} onSaved={refetch} />
    </div>
  );
}