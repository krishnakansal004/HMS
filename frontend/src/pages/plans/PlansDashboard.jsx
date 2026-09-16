import { useState } from 'react';
import { Plus, Building2, Server, Pencil } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { plansApi, planRequestsApi } from '../../api/plans.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import { formatDate } from '../../utils/format.js';

import CreatePlanModal from './CreatePlanModal.jsx';
import ReviewRequestModal from './ReviewRequestModal.jsx';

export default function PlansDashboard() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [reviewing, setReviewing] = useState(null);

  const { data: plansData, loading: plansLoading, error: plansError, refetch: refetchPlans } = useAsync(() => plansApi.list(), [], 'plans_list');
  const { data: reqsData, loading: reqsLoading, error: reqsError, refetch: refetchReqs } = useAsync(() => planRequestsApi.list(), [], 'plan_reqs_list');

  const plans = plansData?.data || [];
  const requests = reqsData?.data || [];

  function handleSaved() {
    refetchPlans();
    refetchReqs();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Plans & Tenants</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">SaaS tiers and hospital onboarding management</p>
        </div>
        <Button icon={Plus} onClick={() => setCreateOpen(true)}>Create Plan</Button>
      </div>

      {/* Available Plans Grid */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-ink-faint)] uppercase tracking-wider mb-3">Available Plans</h3>
        {plansLoading ? <Spinner label="Loading plans..." /> : plansError ? <ErrorState message={plansError} onRetry={refetchPlans} /> : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map(plan => (
              <Card key={plan.plan_id} className="p-5 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-display font-semibold text-lg text-[var(--color-ink)]">{plan.name}</h4>
                    <StatusPill status={plan.public ? 'Public' : 'Hidden'} tone={plan.public ? 'success' : 'neutral'} />
                  </div>
                  <Server className="text-[var(--color-primary)] opacity-40" size={24} />
                </div>
                <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(plan)}>Edit entitlements</Button>
                <div className="text-sm text-[var(--color-ink-soft)]">
                  <p>Admins: <b>{plan.limits?.admins ?? 'Not specified'}</b></p>
                  <p>Doctors: <b>{plan.limits?.doctors ?? 'Not specified'}</b></p>
                </div>
                <div className="mt-auto pt-4 border-t border-[var(--color-border)] font-mono-data text-sm font-medium">
                  ₹{plan.prices?.monthly || 0}/mo • ₹{plan.prices?.yearly || 0}/yr
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Hospital Upgrade Requests */}
      <Card>
        <div className="p-4 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">Pending Upgrade Requests</h3>
        </div>
        {reqsLoading ? <Spinner label="Loading requests..." /> : reqsError ? <ErrorState message={reqsError} onRetry={refetchReqs} /> : requests.length === 0 ? (
          <EmptyState icon={Building2} title="No pending requests" description="Hospitals requesting to upgrade their SaaS tier will appear here." />
        ) : (
          <Table>
            <Thead>
              <Th>Hospital</Th>
              <Th>Requested Plan</Th>
              <Th>Period</Th>
              <Th>Requested On</Th>
              <Th>Status</Th>
              <Th className="text-right">Action</Th>
            </Thead>
            <tbody>
              {requests.map(req => (
                <Tr key={req.plan_request_id}>
                  <Td className="font-medium">{req.tenant?.name || 'Unknown'}</Td>
                  <Td>{req.plan?.name || 'Unknown Plan'}</Td>
                  <Td className="capitalize">{req.period}</Td>
                  <Td>{formatDate(req.created_at)}</Td>
                  <Td><StatusPill status={req.status} /></Td>
                  <Td className="text-right">
                    {req.status === 'pending' && (
                      <Button size="sm" variant="secondary" onClick={() => setReviewing(req)}>Review</Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <CreatePlanModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={handleSaved} />
      <CreatePlanModal open={!!editing} plan={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      <ReviewRequestModal open={!!reviewing} onClose={() => setReviewing(null)} onSaved={handleSaved} request={reviewing} />
    </div>
  );
}
