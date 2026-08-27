import { useState } from 'react';
import { Plus, Truck, CheckCircle2, Building2 } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { purchasesApi, PURCHASE_STATUSES } from '../../api/purchases.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Select } from '../../components/ui/Input.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import { formatPaise, formatDate } from '../../utils/format.js';
import { toast } from '../../components/ui/Toast.jsx';

import CreatePurchaseModal from './CreatePurchaseModal.jsx';
import AddSupplierModal from './AddSupplierModal.jsx';

export default function PurchasesList() {
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const { data, loading, error, refetch } = useAsync(
    () => purchasesApi.list({ status: statusFilter || undefined, limit: 50 }),
    [statusFilter]
  );

  const orders = data?.data || [];

  async function handleStatusChange(id, status) {
    if (status === 'completed' && !window.confirm('Marking this completed will permanently add these items to your pharmacy inventory. Continue?')) {
      return;
    }
    
    setUpdatingId(id);
    try {
      await purchasesApi.updateStatus(id, status);
      toast.success(`Purchase order marked as ${status}`);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to update order');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Purchase Orders</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Manage supply chain and inventory restocking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Building2} onClick={() => setSupplierOpen(true)}>Add Supplier</Button>
          <Button icon={Plus} onClick={() => setCreateOpen(true)}>Create PO</Button>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[200px]">
            <option value="">All Statuses</option>
            {PURCHASE_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <Spinner label="Loading purchase orders..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No Purchase Orders Found"
            description={statusFilter ? 'Try clearing your status filter.' : 'Create a PO to restock your pharmacy.'}
            action={!statusFilter && <Button size="sm" icon={Plus} onClick={() => setCreateOpen(true)}>Create PO</Button>}
          />
        ) : (
          <Table>
            <Thead>
              <Th>PO Number</Th>
              <Th>Supplier</Th>
              <Th>Date</Th>
              <Th>Total Cost</Th>
              <Th>Status</Th>
              <Th className="text-right">Workflow</Th>
            </Thead>
            <tbody>
              {orders.map((order) => (
                <Tr key={order.purchase_order_id}>
                  <Td className="font-mono-data font-medium">#{order.po_number || order.purchase_order_id.slice(0, 8)}</Td>
                  <Td>{order.supplier?.name || 'Unknown'}</Td>
                  <Td>{formatDate(order.created_at)}</Td>
                  <Td className="font-mono-data font-semibold text-[var(--color-ink)]">{formatPaise(order.total_amount)}</Td>
                  <Td><StatusPill status={order.status} /></Td>
                  <Td className="text-right">
                    {order.status !== 'completed' && order.status !== 'cancelled' ? (
                      <Select
                        value=""
                        disabled={updatingId === order.purchase_order_id}
                        onChange={(e) => e.target.value && handleStatusChange(order.purchase_order_id, e.target.value)}
                        className="max-w-[160px] ml-auto !py-1 text-xs"
                      >
                        <option value="">Update...</option>
                        {PURCHASE_STATUSES.filter(s => s !== order.status).map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </Select>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-success)] justify-end w-full">
                        <CheckCircle2 size={14} /> Finalized
                      </span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <CreatePurchaseModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={refetch} />
      <AddSupplierModal open={supplierOpen} onClose={() => setSupplierOpen(false)} onSaved={() => {}} />
    </div>
  );
}