import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, Layers, CalendarClock, Activity } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { tenantsApi } from '../../api/plans.js';
import Card, { CardHeader, CardBody } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { Spinner, ErrorState } from '../../components/ui/Table.jsx';
import { formatDate } from '../../utils/format.js';
import { useState } from 'react';

export default function TenantDetails() {
  const { id } = useParams();
  const { data: response, loading, error } = useAsync(() => tenantsApi.getById(id), [id]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  const tenant = response?.data;
  const plan = tenant?.plan;
  const limits = plan?.limits ? (typeof plan.limits === 'string' ? JSON.parse(plan.limits) : plan.limits) : {};

  if (loading) return <Spinner label="Loading tenant details..." />;
  if (error) return <ErrorState message={error} />;
  if (!tenant) return <ErrorState message="Tenant not found" />;

  async function handleStatusChange(newStatus) {
    const action = newStatus === 'active' ? 'restore' : 'suspend';
    if (!window.confirm(`Are you sure you want to ${action} this hospital's access?`)) return;

    setUpdatingStatus(true);
    try {
      await tenantsApi.updateStatus(tenant.tenant_id, newStatus);
      toast.success(`Hospital access successfully ${newStatus === 'active' ? 'restored' : 'suspended'}.`);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to update hospital status.');
    } finally {
      setUpdatingStatus(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/plans" className="p-2 rounded-full hover:bg-[var(--color-paper)] text-[var(--color-ink-soft)] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)] flex items-center gap-3">
            {tenant.name}
            <StatusPill status={tenant.status} />
          </h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5 font-mono-data">
            Tenant ID: {tenant.tenant_id}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          {tenant.status === 'active' ? (
            <Button variant="danger" icon={Activity} onClick={() => handleStatusChange('suspended')} loading={updatingStatus}>Suspend Access</Button>
          ) : (
            <Button icon={Activity} onClick={() => handleStatusChange('active')} loading={updatingStatus} >Restore Access</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Core Identity */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card>
            <CardHeader title="Hospital Identity" action={<Building2 size={18} className="text-[var(--color-primary)]" />} />
            <CardBody className="flex flex-col gap-4">
              <DetailRow label="Hospital Name" value={tenant.name} />
              <DetailRow label="Portal Slug" value={tenant.slug} isMono />
              <DetailRow label="Login URL" value={`/portal/${tenant.slug}/login`} isMono />
              <DetailRow label="Onboarded On" value={formatDate(tenant.created_at)} />
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Subscription & Limits */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader title="Active Subscription" action={<Layers size={18} className="text-[var(--color-accent)]" />} />
            <CardBody className="flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
                <div>
                  <h4 className="text-sm font-medium text-[var(--color-ink-soft)]">Current Plan</h4>
                  <p className="font-display text-xl font-semibold text-[var(--color-ink)] mt-1">
                    {plan?.name || 'Unassigned'}
                  </p>
                </div>
                <Button variant="secondary" size="sm">Change Plan</Button>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-ink)] mb-3">Resource Allocations</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[var(--color-paper)] p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-ink-soft)] uppercase tracking-wide font-medium">Max Doctors</p>
                    <p className="font-mono-data text-lg font-semibold text-[var(--color-ink)] mt-1">{limits.doctors || 'Unlimited'}</p>
                  </div>
                  <div className="bg-[var(--color-paper)] p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-ink-soft)] uppercase tracking-wide font-medium">Max Inpatient Beds</p>
                    <p className="font-mono-data text-lg font-semibold text-[var(--color-ink)] mt-1">{limits.beds || 'Unlimited'}</p>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card className="flex-1 min-h-[250px]">
            <CardHeader title="Billing History" action={<CalendarClock size={18} className="text-[var(--color-ink-faint)]" />} />
            <CardBody className="flex flex-col items-center justify-center text-center h-full py-10">
               <p className="text-sm text-[var(--color-ink-soft)] max-w-sm">
                 Invoices and payment receipts for this hospital's subscription will appear here.
               </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, isMono = false }) {
  return (
    <div className="flex justify-between items-start border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0">
      <span className="text-sm font-medium text-[var(--color-ink-soft)]">{label}</span>
      <span className={`text-sm text-[var(--color-ink)] text-right max-w-[60%] ${isMono ? 'font-mono-data text-xs' : 'font-medium'}`}>{value}</span>
    </div>
  );
}