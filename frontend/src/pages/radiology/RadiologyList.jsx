import { useState } from 'react';
import { Plus, Scan, ActivitySquare } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { radiologyApi, RADIOLOGY_STATUSES } from '../../api/radiology.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Select } from '../../components/ui/Input.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import { formatDate } from '../../utils/format.js';
import { useAuthStore } from '../../store/authStore.js';
import { ROLES } from '../../utils/roles.js';

import OrderRadiologyModal from './OrderRadiologyModal.jsx';
import UpdateRadiologyModal from './UpdateRadiologyModal.jsx';

export default function RadiologyList() {
  const user = useAuthStore((s) => s.user);
  const [statusFilter, setStatusFilter] = useState('');
  const [orderOpen, setOrderOpen] = useState(false);
  const [updatingScan, setUpdatingScan] = useState(null);

  const { data, loading, error, refetch } = useAsync(
    () => radiologyApi.listOrders({ status: statusFilter || undefined, limit: 50 }),
    [statusFilter]
  );

  const orders = data?.data || [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Radiology</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">X-Ray, MRI, CT Scans & Diagnostics</p>
        </div>
        {(user?.role === ROLES.HOSPITAL_ADMIN || user?.role === ROLES.DOCTOR) && (
          <Button icon={Plus} onClick={() => setOrderOpen(true)}>Order Scan</Button>
        )}
      </div>

      <Card>
        <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[200px]">
            <option value="">All Statuses</option>
            {RADIOLOGY_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <Spinner label="Loading radiology orders..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={Scan}
            title="No Scans Ordered"
            description={statusFilter ? 'Try clearing your status filter.' : 'Radiology orders will appear here.'}
            action={(user?.role === ROLES.HOSPITAL_ADMIN || user?.role === ROLES.DOCTOR) && !statusFilter && <Button size="sm" icon={Plus} onClick={() => setOrderOpen(true)}>Order Scan</Button>}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Patient</Th>
              <Th>Scan Details</Th>
              <Th>Date</Th>
              <Th>Urgency</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </Thead>
            <tbody>
              {orders.map((order) => (
                <Tr key={order.radiology_order_id}>
                  <Td>
                    <p className="font-medium text-[var(--color-ink)]">{order.patient_name_snapshot}</p>
                    <p className="text-xs text-[var(--color-ink-faint)]">Dr. {order.doctor_profile?.users?.name || 'Unknown'}</p>
                  </Td>
                  <Td>
                    <p className="font-medium">{order.study_type}</p>
                    <p className="text-xs text-[var(--color-ink-faint)]">{order.modality} {order.body_part ? `- ${order.body_part}` : ''}</p>
                  </Td>
                  <Td>{formatDate(order.created_at)}</Td>
                  <Td>
                    <span className={`text-xs font-semibold capitalize ${order.urgency === 'stat' || order.urgency === 'urgent' ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink-soft)]'}`}>
                      {order.urgency}
                    </span>
                  </Td>
                  <Td><StatusPill status={order.status} /></Td>
                  <Td className="text-right">
                    {(user?.role === ROLES.HOSPITAL_ADMIN || user?.role === ROLES.RADIOLOGY_TECHNICIAN) && (
                      <Button size="sm" variant="secondary" icon={ActivitySquare} onClick={() => setUpdatingScan(order)}>
                        Update
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
      <OrderRadiologyModal open={orderOpen} onClose={() => setOrderOpen(false)} onSaved={refetch} />
      <UpdateRadiologyModal open={!!updatingScan} onClose={() => setUpdatingScan(null)} order={updatingScan} onSaved={refetch} />
    </div>
  );
}