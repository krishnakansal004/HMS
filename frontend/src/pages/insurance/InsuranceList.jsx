import { useState } from 'react';
import { Plus, ShieldCheck, Building2, Receipt } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { insuranceApi, CLAIM_STATUSES } from '../../api/insurance.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Select } from '../../components/ui/Input.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import { formatPaise, formatDate, fullName } from '../../utils/format.js';

import AddCompanyModal from './AddCompanyModal.jsx';
import CreateClaimModal from './CreateClaimModal.jsx';
import UpdateClaimModal from './UpdateClaimModal.jsx';

export default function InsuranceList() {
  const [activeTab, setActiveTab] = useState('claims');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [updatingClaim, setUpdatingClaim] = useState(null);

  // Queries
  const { data: claimsData, loading: claimsLoading, error: claimsError, refetch: refetchClaims } = useAsync(
    () => insuranceApi.listClaims({ status: statusFilter || undefined, limit: 50 }),
    [statusFilter]
  );
  
  const { data: companiesData, loading: compsLoading, error: compsError, refetch: refetchComps } = useAsync(
    () => insuranceApi.listCompanies(),
    []
  );

  const claims = claimsData?.data || [];
  const companies = companiesData?.data || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Insurance Claims</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Manage TPA providers and patient claim lifecycles</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={Building2} onClick={() => setCompanyModalOpen(true)}>Add TPA</Button>
          <Button icon={Plus} onClick={() => setClaimModalOpen(true)}>File Claim</Button>
        </div>
      </div>

      <div className="flex border-b border-[var(--color-border)] gap-6">
        <button
          onClick={() => setActiveTab('claims')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'claims' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
          }`}
        >
          <Receipt size={16} /> Claims Ledger
        </button>
        <button
          onClick={() => setActiveTab('companies')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'companies' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
          }`}
        >
          <ShieldCheck size={16} /> Insurance Providers
        </button>
      </div>

      {activeTab === 'claims' && (
        <Card>
          <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-3">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[200px]">
              <option value="">All Statuses</option>
              {CLAIM_STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>
              ))}
            </Select>
          </div>

          {claimsLoading ? (
            <Spinner label="Loading claims..." />
          ) : claimsError ? (
            <ErrorState message={claimsError} onRetry={refetchClaims} />
          ) : claims.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No Claims Found"
              description={statusFilter ? 'Try clearing your status filter.' : 'File a claim to start tracking TPA reimbursements.'}
              action={!statusFilter && <Button size="sm" icon={Plus} onClick={() => setClaimModalOpen(true)}>File Claim</Button>}
            />
          ) : (
            <Table>
              <Thead>
                <Th>Patient & Invoice</Th>
                <Th>TPA Provider</Th>
                <Th>Claimed (₹)</Th>
                <Th>Approved (₹)</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </Thead>
              <tbody>
                {claims.map((claim) => (
                  <Tr key={claim.claim_id}>
                    <Td>
                      <p className="font-medium text-[var(--color-ink)]">{fullName(claim.patient)}</p>
                      {claim.invoice ? (
                        <p className="text-[10px] text-[var(--color-ink-faint)] font-mono-data mt-0.5">INV-#{claim.invoice.invoice_number}</p>
                      ) : (
                        <p className="text-[10px] text-[var(--color-warning)] mt-0.5">No Invoice Linked</p>
                      )}
                    </Td>
                    <Td>
                      <p className="font-medium">{claim.company?.name || 'Unknown'}</p>
                      <p className="text-xs text-[var(--color-ink-faint)] font-mono-data mt-0.5">Pol: {claim.policy_number}</p>
                    </Td>
                    <Td className="font-mono-data">{formatPaise(claim.claimed_amount)}</Td>
                    <Td className="font-mono-data text-[var(--color-success)]">{claim.approved_amount ? formatPaise(claim.approved_amount) : '--'}</Td>
                    <Td><StatusPill status={claim.status} /></Td>
                    <Td className="text-right">
                      {claim.status !== 'settled' && (
                        <Button size="sm" variant="secondary" onClick={() => setUpdatingClaim(claim)}>Update</Button>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {activeTab === 'companies' && (
        <Card>
          {compsLoading ? (
            <Spinner label="Loading providers..." />
          ) : compsError ? (
            <ErrorState message={compsError} onRetry={refetchComps} />
          ) : companies.length === 0 ? (
            <EmptyState icon={Building2} title="No Insurance Providers" action={<Button size="sm" onClick={() => setCompanyModalOpen(true)}>Add TPA</Button>} />
          ) : (
            <Table>
              <Thead>
                <Th>Provider Name</Th>
                <Th>Code</Th>
                <Th>Contact Email</Th>
                <Th>Discount Rate</Th>
              </Thead>
              <tbody>
                {companies.map((c) => (
                  <Tr key={c.company_id}>
                    <Td className="font-medium">{c.name}</Td>
                    <Td className="font-mono-data text-xs text-[var(--color-ink-soft)]">{c.code}</Td>
                    <Td>{c.email || 'N/A'}</Td>
                    <Td className="font-mono-data">{c.corporate_discount}%</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {/* Modals */}
      <AddCompanyModal open={companyModalOpen} onClose={() => setCompanyModalOpen(false)} onSaved={refetchComps} />
      <CreateClaimModal open={claimModalOpen} onClose={() => setClaimModalOpen(false)} onSaved={refetchClaims} companies={companies} />
      <UpdateClaimModal open={!!updatingClaim} onClose={() => setUpdatingClaim(null)} claim={updatingClaim} onSaved={refetchClaims} />
    </div>
  );
}