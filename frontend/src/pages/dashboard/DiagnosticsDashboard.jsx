import { FlaskConical, Scan } from 'lucide-react';
import { labApi } from '../../api/lab.js';
import { radiologyApi } from '../../api/radiology.js';
import StatCardWidget from './widgets/StatCardWidget.jsx';
import ActionListWidget from './widgets/ActionListWidget.jsx';
import { ROLE_LABELS } from '../../utils/roles.js';
import StatusPill from '../../components/ui/StatusPill.jsx';

export default function DiagnosticsDashboard({ user }) {
  const isRadiology = user?.role === 'RADIOLOGY_TECHNICIAN';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Diagnostic Imaging & Labs</h2>
        <p className="text-sm text-[var(--color-ink-soft)] mt-1">{ROLE_LABELS[user?.role] || user?.role}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {!isRadiology && <StatCardWidget title="Pending Lab Samples" icon={FlaskConical} to="/lab" fetcher={() => labApi.listOrders({status: 'pending', limit:1})} cacheKey="diag_lab" extractValue={d => d.total} />}
        <StatCardWidget title="Pending Scans" icon={Scan} to="/radiology" fetcher={() => radiologyApi.listOrders({status: 'ordered', limit:1})} cacheKey="diag_rad" extractValue={d => d.total} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
        {!isRadiology && (
          <ActionListWidget 
            title="Lab Order Queue" icon={FlaskConical} to="/lab" emptyMessage="All samples processed."
            fetcher={() => labApi.listOrders({status: 'pending', limit: 8})} cacheKey="diag_lab_list"
            renderRow={(order) => (
              <li key={order.lab_order_id} className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">{order.test_name_snapshot}</p>
                  <p className="text-xs text-[var(--color-ink-soft)]">Patient: {order.patient_name_snapshot}</p>
                </div>
                <StatusPill status={order.sample_status} />
              </li>
            )}
          />
        )}
        <ActionListWidget 
          title="Radiology Queue" icon={Scan} to="/radiology" emptyMessage="No scans pending."
          fetcher={() => radiologyApi.listOrders({status: 'ordered', limit: 8})} cacheKey="diag_rad_list"
          renderRow={(order) => (
            <li key={order.radiology_order_id} className="flex items-center justify-between p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div>
                <p className="font-medium text-[var(--color-ink)]">{order.study_type}</p>
                <p className="text-xs text-[var(--color-ink-soft)]">Patient: {order.patient_name_snapshot}</p>
              </div>
              <StatusPill status={order.status} />
            </li>
          )}
        />
      </div>
    </div>
  );
}