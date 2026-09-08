import { Wallet, TrendingUp } from 'lucide-react';
import { useAsync } from '../../../hooks/useAsync.js';
import { invoicesApi } from '../../../api/invoices.js';
import { formatPaise } from '../../../utils/format.js';
import { StatCard } from '../shared.jsx';

const BILLING_ROLES = new Set(['HOSPITAL_ADMIN', 'ACCOUNTANT', 'CASHIER']);

/**
 * Richer money-specific view for roles whose whole job is billing, on top
 * of the simple "pending invoices" count everyone with invoice access
 * already gets from OperationsAttentionSection. Only fires its one
 * aggregate call for the three roles it's actually useful to.
 */
export default function BillingSummarySection({ role }) {
  const enabled = BILLING_ROLES.has(role);

  const summary = useAsync(
    () => (enabled ? invoicesApi.getSummary() : Promise.resolve(null)),
    [enabled],
    'dash_billing_summary',
  );

  if (!enabled) return null;

  const data = summary.data?.data;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <StatCard
        icon={Wallet}
        label="Outstanding dues"
        state={summary}
        value={data ? formatPaise(data.outstandingTotal) : undefined}
        suffix={data ? `${data.outstandingInvoiceCount} invoices` : undefined}
        to="/invoices"
      />
      <StatCard
        icon={TrendingUp}
        label="Collected today"
        state={summary}
        value={data ? formatPaise(data.todayCollectedTotal) : undefined}
        suffix={data ? `${data.todayCollectedCount} payments` : undefined}
        to="/invoices"
      />
    </div>
  );
}
