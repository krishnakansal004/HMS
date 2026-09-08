import { PackageX, CalendarClock, FlaskConical, Scan, Receipt, Truck, ShieldCheck, UserPlus, CalendarOff } from 'lucide-react';
import { useAsync } from '../../../hooks/useAsync.js';
import { inventoryApi } from '../../../api/inventory.js';
import { labApi } from '../../../api/lab.js';
import { radiologyApi } from '../../../api/radiology.js';
import { invoicesApi } from '../../../api/invoices.js';
import { purchasesApi } from '../../../api/purchases.js';
import { insuranceApi } from '../../../api/insurance.js';
import { doctorApplicationsApi } from '../../../api/doctorApplications.js';
import { hrmsApi } from '../../../api/hrms.js';
import Card, { CardHeader, CardBody } from '../../../components/ui/Card.jsx';
import { AttentionRow } from '../shared.jsx';

const EXPIRING_WINDOW_DAYS = 30;

/**
 * One "Needs attention" card holding every simple count/list widget that
 * doesn't warrant its own dedicated section. Each row is independently
 * gated on its own nav key, with its own useAsync call skipped entirely
 * when not visible -- a Lab Technician only ever fires the lab query, a
 * Store Manager only the inventory + purchases queries, etc.
 */
export default function OperationsAttentionSection({ visible }) {
  const lowStock = useAsync(
    () => (visible.has('inventory') ? inventoryApi.list({ lowStock: true, limit: 5 }) : Promise.resolve(null)),
    [visible.has('inventory')],
    'dash_lowstock',
  );
  const expiringSoon = useAsync(
    () => (visible.has('inventory') ? inventoryApi.list({ expiringWithinDays: EXPIRING_WINDOW_DAYS, limit: 5 }) : Promise.resolve(null)),
    [visible.has('inventory')],
    'dash_expiring',
  );
  const pendingLab = useAsync(
    () => (visible.has('lab') ? labApi.listOrders({ status: 'pending', limit: 1 }) : Promise.resolve(null)),
    [visible.has('lab')],
    'dash_lab',
  );
  const pendingRadiology = useAsync(
    () => (visible.has('radiology') ? radiologyApi.listOrders({ status: 'ordered', limit: 1 }) : Promise.resolve(null)),
    [visible.has('radiology')],
    'dash_radiology',
  );
  const pendingInvoices = useAsync(
    () => (visible.has('invoices') ? invoicesApi.list({ status: 'pending', limit: 1 }) : Promise.resolve(null)),
    [visible.has('invoices')],
    'dash_invoices',
  );
  const pendingPurchases = useAsync(
    () => (visible.has('purchases') ? purchasesApi.list({ status: 'pending', limit: 1 }) : Promise.resolve(null)),
    [visible.has('purchases')],
    'dash_purchases',
  );
  const pendingClaims = useAsync(
    () => (visible.has('insurance') ? insuranceApi.listClaims({ status: 'submitted', limit: 1 }) : Promise.resolve(null)),
    [visible.has('insurance')],
    'dash_insurance',
  );
  const pendingApplications = useAsync(
    () => (visible.has('doctor-applications') ? doctorApplicationsApi.list({ status: 'PENDING', limit: 1 }) : Promise.resolve(null)),
    [visible.has('doctor-applications')],
    'dash_doctor_apps',
  );
  const pendingLeaves = useAsync(
    () => (visible.has('hrms') ? hrmsApi.listLeaves({ status: 'PENDING', limit: 1 }) : Promise.resolve(null)),
    [visible.has('hrms')],
    'dash_hrms_leaves',
  );
  const onLeaveToday = useAsync(
    () => (visible.has('hrms') ? hrmsApi.listLeaves({ onLeaveToday: true, limit: 5 }) : Promise.resolve(null)),
    [visible.has('hrms')],
    'dash_hrms_on_leave_today',
  );

  const anyVisible = ['inventory', 'lab', 'radiology', 'invoices', 'purchases', 'insurance', 'doctor-applications', 'hrms']
    .some((k) => visible.has(k));
  if (!anyVisible) return null;

  return (
    <Card>
      <CardHeader title="Needs attention" />
      <CardBody className="flex flex-col gap-4">
        {visible.has('inventory') && (
          <AttentionRow
            icon={PackageX}
            tone="danger"
            label="Low stock medicines"
            state={lowStock}
            to="/inventory"
            render={() =>
              lowStock.data?.data?.length ? (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {lowStock.data.data.map((m) => (
                    <li key={m.medicine_id} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-ink)]">{m.name}</span>
                      <span className="font-mono-data text-[var(--color-danger)]">{m.quantity} left | reorder at {m.reorder_level}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[var(--color-ink-soft)] mt-1">All stock levels healthy.</p>
              )
            }
          />
        )}
        {visible.has('inventory') && (
          <AttentionRow
            icon={CalendarClock}
            tone="warning"
            label={`Expiring within ${EXPIRING_WINDOW_DAYS} days`}
            state={expiringSoon}
            to="/inventory"
            value={expiringSoon.data?.total}
            render={() =>
              expiringSoon.data?.data?.length ? (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {expiringSoon.data.data.slice(0, 3).map((m) => (
                    <li key={m.medicine_id} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-ink)]">{m.name}</span>
                      <span className="font-mono-data text-[var(--color-warning)]">exp {new Date(m.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                    </li>
                  ))}
                </ul>
              ) : null
            }
          />
        )}
        {visible.has('lab') && (
          <AttentionRow icon={FlaskConical} tone="warning" label="Pending lab orders" state={pendingLab} to="/lab" value={pendingLab.data?.total} />
        )}
        {visible.has('radiology') && (
          <AttentionRow icon={Scan} tone="warning" label="Pending radiology orders" state={pendingRadiology} to="/radiology" value={pendingRadiology.data?.total} />
        )}
        {visible.has('invoices') && (
          <AttentionRow icon={Receipt} tone="accent" label="Pending invoices" state={pendingInvoices} to="/invoices" value={pendingInvoices.data?.total} />
        )}
        {visible.has('purchases') && (
          <AttentionRow icon={Truck} tone="accent" label="Pending purchase orders" state={pendingPurchases} to="/purchases" value={pendingPurchases.data?.total} />
        )}
        {visible.has('insurance') && (
          <AttentionRow icon={ShieldCheck} tone="accent" label="Pending insurance claims" state={pendingClaims} to="/insurance" value={pendingClaims.data?.total} />
        )}
        {visible.has('doctor-applications') && (
          <AttentionRow icon={UserPlus} tone="accent" label="Pending doctor applications" state={pendingApplications} to="/doctor-applications" value={pendingApplications.data?.total} />
        )}
        {visible.has('hrms') && (
          <AttentionRow icon={CalendarOff} tone="warning" label="Pending leave requests" state={pendingLeaves} to="/hrms" value={pendingLeaves.data?.total} />
        )}
        {visible.has('hrms') && (
          <AttentionRow
            icon={UserPlus}
            tone="accent"
            label="On leave today"
            state={onLeaveToday}
            to="/hrms"
            value={onLeaveToday.data?.total}
            render={() =>
              onLeaveToday.data?.data?.length ? (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {onLeaveToday.data.data.map((l) => (
                    <li key={l.leave_id} className="text-xs text-[var(--color-ink)]">{l.applicant?.name || 'Unknown'}</li>
                  ))}
                </ul>
              ) : null
            }
          />
        )}
      </CardBody>
    </Card>
  );
}
