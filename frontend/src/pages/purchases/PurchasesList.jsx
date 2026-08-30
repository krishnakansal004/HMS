import { useState } from 'react';
import { ClipboardPlus, Plus, Users } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { purchasesApi, PURCHASE_STATUSES } from '../../api/purchases.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Select } from '../../components/ui/Input.jsx';
import { EmptyState, ErrorState, Spinner, Table, Td, Th, Thead, Tr } from '../../components/ui/Table.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { formatDate, formatPaise } from '../../utils/format.js';
import { useAuthStore } from '../../store/authStore.js';
import PurchaseDrawer from './PurchaseDrawer.jsx';
import SupplierModal from './AddSupplierModal.jsx';
import { toast } from '../../components/ui/Toast.jsx';

const nextStatus = { pending: 'ordered', ordered: 'received', received: 'completed', completed: 'cancelled' };

export default function PurchasesList() {
  const user = useAuthStore((state) => state.user);
  const canManage = ['HOSPITAL_ADMIN', 'STORE_MANAGER'].includes(user?.role);
  const [status, setStatus] = useState('');
  
  const [createOpen, setCreateOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  
  // PRODUCTION FIX: Prevent double-click 409 transition errors
  const [processingId, setProcessingId] = useState(null);
  
  const { data, loading, error, refetch } = useAsync(() => purchasesApi.list({ status: status || undefined, limit: 50 }), [status]);
  const purchases = data?.data || [];

  async function advance(purchase) {
    const target = nextStatus[purchase.status];
    if (!target) return;
    if (target === 'cancelled' && !window.confirm('Cancel this completed purchase and reverse its stock receipt? This is allowed only while all received stock remains available.')) return;
    
    setProcessingId(purchase.purchase_id);
    
    try {
      await purchasesApi.updateStatus(purchase.purchase_id, target);
      toast.success(`Purchase marked ${target}.`);
      refetch();
    } catch (requestError) { 
      toast.error(requestError.message || 'Unable to update purchase status.'); 
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Purchases</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Controlled supplier orders and inventory receipt workflow</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="secondary" icon={Users} onClick={() => setSupplierOpen(true)}>Suppliers</Button>
            <Button icon={Plus} onClick={() => setCreateOpen(true)}>New Purchase</Button>
          </div>
        )}
      </div>

      <Card>
        <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="max-w-[200px]">
            <option value="">All Statuses</option>
            {PURCHASE_STATUSES.map((item) => (
              <option key={item} value={item} className="capitalize">{item}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <Spinner label="Loading purchase orders..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : purchases.length === 0 ? (
          <EmptyState 
            icon={ClipboardPlus} 
            title="No purchase orders" 
            description={status ? 'Clear the status filter to view other orders.' : 'Create a purchase order after registering an active supplier and medicine.'} 
            action={canManage && !status && <Button onClick={() => setCreateOpen(true)}>New Purchase</Button>} 
          />
        ) : (
          <Table>
            <Thead>
              <Th>Order Ref</Th>
              <Th>Supplier</Th>
              <Th>Date</Th>
              <Th>Total</Th>
              <Th>Status</Th>
              <Th className="text-right">Action</Th>
            </Thead>
            <tbody>
              {purchases.map((purchase) => (
                <Tr key={purchase.purchase_id}>
                  <Td className="font-mono-data font-medium">{purchase.order_id || purchase.purchase_id.slice(0, 8)}</Td>
                  <Td>{purchase.supplier?.name || 'Unknown'}</Td>
                  <Td>{formatDate(purchase.order_date)}</Td>
                  <Td className="font-mono-data">{formatPaise(purchase.total_cost)}</Td>
                  <Td><StatusPill status={purchase.status} /></Td>
                  <Td className="text-right">
                    {canManage && nextStatus[purchase.status] && (
                      <Button 
                        size="sm" 
                        variant={purchase.status === 'completed' ? 'danger' : 'secondary'} 
                        onClick={() => advance(purchase)}
                        loading={processingId === purchase.purchase_id}
                        disabled={processingId !== null}
                      >
                        {purchase.status === 'completed' ? 'Cancel & Reverse' : `Mark ${nextStatus[purchase.status]}`}
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <PurchaseDrawer 
        open={createOpen} 
        onClose={() => setCreateOpen(false)} 
        onSaved={refetch} 
        onRegisterSupplier={() => { setCreateOpen(false); setSupplierOpen(true); }} 
      />
      <SupplierModal 
        open={supplierOpen} 
        onClose={() => setSupplierOpen(false)} 
        onSaved={() => { refetch(); setCreateOpen(true); }} 
      />
    </div>
  );
}