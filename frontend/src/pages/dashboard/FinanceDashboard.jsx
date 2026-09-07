import { Receipt, ShieldCheck } from 'lucide-react';
import { invoicesApi } from '../../api/invoices.js';
import { insuranceApi } from '../../api/insurance.js';
import StatCardWidget from './widgets/StatCardWidget.jsx';
import ActionListWidget from './widgets/ActionListWidget.jsx';
import { ROLE_LABELS } from '../../utils/roles.js';
import { formatPaise, fullName } from '../../utils/format.js';
import StatusPill from '../../components/ui/StatusPill.jsx';

export default function FinanceDashboard({ user }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Financial Operations</h2>
        <p className="text-sm text-[var(--color-ink-soft)] mt-1">{ROLE_LABELS[user?.role] || user?.role}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCardWidget title="Unpaid Invoices" icon={Receipt} to="/invoices" fetcher={() => invoicesApi.list({status: 'PENDING', limit:1})} cacheKey="fin_inv" extractValue={d => d.total} />
        <StatCardWidget title="Draft Invoices" icon={Receipt} to="/invoices" fetcher={() => invoicesApi.list({status: 'DRAFT', limit:1})} cacheKey="fin_draft" extractValue={d => d.total} />
        <StatCardWidget title="Unsubmitted Claims" icon={ShieldCheck} to="/insurance" fetcher={() => insuranceApi.listClaims({status: 'submitted', limit:1})} cacheKey="fin_claim" extractValue={d => d.total} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
        <ActionListWidget 
          title="Pending Invoices Queue" icon={Receipt} to="/invoices" emptyMessage="All invoices settled."
          fetcher={() => invoicesApi.list({status: 'PENDING', limit: 8})} cacheKey="fin_inv_list"
          renderRow={(inv) => (
            <li key={inv.invoice_id} className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div>
                <p className="font-mono-data font-semibold text-[var(--color-ink)]">{formatPaise(inv.total)}</p>
                <p className="text-xs text-[var(--color-ink-soft)]">Inv #{inv.invoice_number} • {fullName(inv.patient)}</p>
              </div>
              <StatusPill status={inv.status} />
            </li>
          )}
        />
      </div>
    </div>
  );
}