import { useState } from 'react';
import { Plus, FlaskConical, Beaker } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { labApi, LAB_ORDER_STATUSES } from '../../api/lab.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Select } from '../../components/ui/Input.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import { formatDate, fullName } from '../../utils/format.js';
import { toast } from '../../components/ui/Toast.jsx';
import { useAuthStore } from '../../store/authStore.js';
import { ROLES } from '../../utils/roles.js';
import AddLabTestModal from './AddLabTestModal.jsx'; // <--- ADD THIS
import CreateLabOrderModal from './CreateLabOrderModal.jsx';

export default function LabOrdersList() {
  const user = useAuthStore((s) => s.user);
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [catalogFormOpen, setCatalogFormOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const { data, loading, error, refetch } = useAsync(
    () => labApi.listOrders({ status: statusFilter || undefined, limit: 50 }),
    [statusFilter]
  );

  const orders = data?.data || [];

  async function handleStatusChange(id, status) {
    setUpdatingId(id);
    try {
      await labApi.updateResults(id, { sampleStatus: status });
      toast.success('Order status updated');
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
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Laboratory</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Manage pathology orders and sample tracking</p>
        </div>
        <div className="flex gap-2">
          {(user?.role === ROLES.HOSPITAL_ADMIN || user?.role === ROLES.LAB_TECHNICIAN) && (
            <Button variant="secondary" icon={Plus} onClick={() => setCatalogFormOpen(true)}>Add to Catalog</Button>
          )}
          <Button icon={Plus} onClick={() => setFormOpen(true)}>Order Lab Test</Button>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[200px]">
            <option value="">All Statuses</option>
            {LAB_ORDER_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <Spinner label="Loading lab orders..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={FlaskConical}
            title="No Lab Orders Found"
            description={statusFilter ? 'Try clearing your status filter.' : 'Create a new lab order to track samples.'}
            action={!statusFilter && <Button size="sm" icon={Plus} onClick={() => setFormOpen(true)}>Order Test</Button>}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Test Name</Th>
              <Th>Patient</Th>
              <Th>Doctor</Th>
              <Th>Ordered On</Th>
              <Th>Status</Th>
              <Th className="text-right">Update Workflow</Th>
            </Thead>
            <tbody>
              {orders.map((order) => (
                <Tr key={order.lab_order_id}>
                  <Td>
                    <p className="font-medium text-[var(--color-ink)] flex items-center gap-2">
                      <Beaker size={14} className="text-[var(--color-primary)]" />
                      {order.test_name_snapshot}
                    </p>
                    <p className="text-xs font-mono-data text-[var(--color-ink-faint)] mt-0.5">{order.test_code_snapshot}</p>
                  </Td>
                  <Td>{fullName(order.patient)}</Td>
                  <Td>{order.doctor_profile?.users?.name ? `Dr. ${order.doctor_profile.users.name}` : 'External'}</Td>
                  <Td>{formatDate(order.created_at)}</Td>
                  <Td><StatusPill status={order.sample_status} /></Td>
                  <Td className="text-right">
                    <Select
                      value=""
                      disabled={updatingId === order.lab_order_id}
                      onChange={(e) => e.target.value && handleStatusChange(order.lab_order_id, e.target.value)}
                      className="max-w-[160px] ml-auto !py-1 text-xs"
                    >
                      <option value="">Move to...</option>
                      {LAB_ORDER_STATUSES.filter(s => s !== order.sample_status).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </Select>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <CreateLabOrderModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} />
      <AddLabTestModal open={catalogFormOpen} onClose={() => setCatalogFormOpen(false)} onSaved={refetch} />
    </div>
  );
}