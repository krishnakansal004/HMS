import { Pill, Truck, AlertTriangle } from 'lucide-react';
import { inventoryApi } from '../../api/inventory.js';
import { purchasesApi } from '../../api/purchases.js';
import StatCardWidget from './widgets/StatCardWidget.jsx';
import ActionListWidget from './widgets/ActionListWidget.jsx';
import { ROLE_LABELS } from '../../utils/roles.js';
import StatusPill from '../../components/ui/StatusPill.jsx';

export default function PharmacyDashboard({ user }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Pharmacy & Inventory</h2>
        <p className="text-sm text-[var(--color-ink-soft)] mt-1">{ROLE_LABELS[user?.role] || user?.role}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardWidget title="Low Stock Alerts" icon={AlertTriangle} to="/inventory" fetcher={() => inventoryApi.list({lowStock: true, limit:1})} cacheKey="pharm_low" extractValue={d => d.total} />
        <StatCardWidget title="Pending Deliveries" icon={Truck} to="/purchases" fetcher={() => purchasesApi.list({status: 'ordered', limit:1})} cacheKey="pharm_po" extractValue={d => d.total} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
        <ActionListWidget 
          title="Low Stock Warning" icon={Pill} to="/inventory" emptyMessage="Stock levels healthy."
          fetcher={() => inventoryApi.list({lowStock: true, limit: 8})} cacheKey="pharm_low_list"
          renderRow={(med) => (
            <li key={med.medicine_id} className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/20">
              <div>
                <p className="font-medium text-[var(--color-ink)]">{med.name}</p>
                <p className="text-xs text-[var(--color-ink-soft)]">Reorder Level: {med.reorder_level}</p>
              </div>
              <span className="font-mono-data font-bold text-[var(--color-danger)]">{med.quantity} Left</span>
            </li>
          )}
        />
        <ActionListWidget 
          title="Inbound Purchase Orders" icon={Truck} to="/purchases" emptyMessage="No active orders."
          fetcher={() => purchasesApi.list({status: 'ordered', limit: 8})} cacheKey="pharm_po_list"
          renderRow={(po) => (
            <li key={po.purchase_id} className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div>
                <p className="font-mono-data font-medium text-[var(--color-ink)]">PO-{po.purchase_id.slice(0,6).toUpperCase()}</p>
                <p className="text-xs text-[var(--color-ink-soft)]">From: {po.supplier?.name || 'Unknown'}</p>
              </div>
              <StatusPill status={po.status} />
            </li>
          )}
        />
      </div>
    </div>
  );
}