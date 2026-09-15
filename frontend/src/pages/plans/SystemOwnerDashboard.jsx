import { useState } from 'react';
import { Building2, Layers, Plus } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { plansApi, tenantsApi } from '../../api/plans.js';
import Card, { CardHeader, CardBody } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import { formatDate } from '../../utils/format.js';

// Modals
import CreateTenantModal from './CreateTenantModal.jsx';
import CreatePlanModal from './CreatePlanModal.jsx';
import { Link } from 'react-router-dom';

export default function SystemOwnerDashboard() {
  const [activeTab, setActiveTab] = useState('tenants');
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);

  // Fetch Live Data from Backend API
  const plansQuery = useAsync(() => plansApi.list(), [], 'plans_list');
  const tenantsQuery = useAsync(() => tenantsApi.list({ limit: 50 }), [], 'sys_tenants');

  const plans = plansQuery.data?.data || [];
  const tenants = tenantsQuery.data?.data || [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">System Overview</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Manage global tenants and subscription plans</p>
        </div>
        <Button icon={Plus} onClick={() => setTenantModalOpen(true)}>New Tenant</Button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[var(--color-border)] gap-6">
        <button
          onClick={() => setActiveTab('tenants')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'tenants' 
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]' 
              : 'border-transparent text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
          }`}
        >
          <Building2 size={16} /> Registered Tenants
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'plans' 
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]' 
              : 'border-transparent text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
          }`}
        >
          <Layers size={16} /> Subscription Plans
        </button>
      </div>

      {/* Tab Content: Tenants */}
      {activeTab === 'tenants' && (
        <Card>
          <CardHeader title="Hospital Tenants" subtitle={`${tenants.length} registered facilities`} />
          {tenantsQuery.loading ? (
            <Spinner label="Loading tenants..." />
          ) : tenantsQuery.error ? (
            <ErrorState message={tenantsQuery.error} onRetry={tenantsQuery.refetch} />
          ) : tenants.length === 0 ? (
            <EmptyState icon={Building2} title="No tenants found" description="Create a plan, then provision your first hospital." />
          ) : (
            <Table>
              <Thead>
                <Th>Tenant Name</Th>
                <Th>URL Slug</Th>
                <Th>Plan</Th>
                <Th>Created</Th>
                <Th>Status</Th>
              </Thead>
              <tbody>
                {tenants.map((tenant) => (
                  <Tr key={tenant.tenant_id}>
                    <Td className="font-medium"><Link to={`/tenants/${tenant.tenant_id}`} className="text-[var(--color-primary)] hover:underline">{tenant.name}</Link></Td>
                    <Td className="font-mono-data text-xs text-[var(--color-ink-soft)]">{tenant.slug}</Td>
                    <Td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[var(--color-paper)] text-[var(--color-ink)]">
                        {tenant.plan?.name || 'Unassigned'}
                      </span>
                    </Td>
                    <Td>{formatDate(tenant.created_at)}</Td>
                    <Td><StatusPill status={tenant.status} /></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {/* Tab Content: Plans */}
      {activeTab === 'plans' && (
        <Card>
          <CardHeader title="Platform Plans" />
          <CardBody className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {plansQuery.loading ? (
              <Spinner label="Loading plans..." />
            ) : plansQuery.error ? (
              <ErrorState message={plansQuery.error} onRetry={plansQuery.refetch} />
            ) : (
              <>
                {plans.map((plan) => (
                  <div key={plan.plan_id} className="flex flex-col justify-between rounded-xl border border-[var(--color-border)] p-6 hover:border-[var(--color-primary)] transition-colors bg-[var(--color-surface)]">
                    <div>
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="font-display text-lg font-bold text-[var(--color-ink)]">{plan.name}</h3>
                        <StatusPill status={plan.status} />
                      </div>
                      <div className="mt-2 mb-4">
                        <span className="text-2xl font-bold text-[var(--color-ink)]">
                          ₹{plan.prices?.monthly || 0}
                        </span>
                        <span className="text-sm text-[var(--color-ink-soft)]">/mo</span>
                      </div>
                      <div className="text-sm text-[var(--color-ink-soft)] space-y-1">
                        <p>Doctors limit: <strong className="text-[var(--color-ink)]">{plan.limits?.doctors || 'Unlimited'}</strong></p>
                        <p>Beds limit: <strong className="text-[var(--color-ink)]">{plan.limits?.beds || 'Unlimited'}</strong></p>
                      </div>
                    </div>
                    
                    <div className="mt-6 flex gap-2">
                      {plan.public && (
                        <span className="text-[10px] bg-[var(--color-info-soft)] text-[var(--color-info)] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                          Public
                        </span>
                      )}
                      {plan.customized && (
                        <span className="text-[10px] bg-[var(--color-accent-soft)] text-[var(--color-accent)] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                          Custom
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Actionable "Create New Plan" Card */}
                <button 
                  onClick={() => setPlanModalOpen(true)}
                  className="rounded-xl bg-[var(--color-paper)] p-6 border-2 border-dashed border-[var(--color-border-strong)] flex flex-col items-center justify-center text-center hover:bg-[var(--color-border)] transition-colors cursor-pointer min-h-[220px]"
                >
                  <div className="rounded-full bg-[var(--color-surface)] p-3 mb-3 shadow-sm text-[var(--color-ink-soft)]">
                    <Plus size={24} />
                  </div>
                  <h3 className="text-sm font-medium text-[var(--color-ink)]">Create New Plan</h3>
                </button>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {/* Mounted Modals */}
      <CreateTenantModal 
        open={tenantModalOpen} 
        onClose={() => setTenantModalOpen(false)} 
        onClick={tenantsQuery.refetch} 
        plans={plans} 
      />
      
      <CreatePlanModal 
        open={planModalOpen} 
        onClose={() => setPlanModalOpen(false)} 
        onClick={plansQuery.refrefetch} 
      />
    </div>
  );
}
