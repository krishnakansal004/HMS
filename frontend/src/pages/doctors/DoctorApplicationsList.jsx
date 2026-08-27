import { useState } from 'react';
import { UserPlus, Mail, Briefcase, GraduationCap, Building2 } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { doctorApplicationsApi, APPLICATION_STATUSES } from '../../api/doctorApplications.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Select } from '../../components/ui/Input.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import Drawer from '../../components/ui/Drawer.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import { formatDate } from '../../utils/format.js';
import { toast } from '../../components/ui/Toast.jsx';

export default function DoctorApplicationsList() {
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [reviewingApp, setReviewingApp] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);

  const { data, loading, error, refetch } = useAsync(
    () => doctorApplicationsApi.list({ status: statusFilter || undefined, limit: 50 }),
    [statusFilter]
  );

  const applications = data?.data || [];

  async function handleReview(id, status) {
    setProcessingAction(status); // Set to 'APPROVED' or 'REJECTED'
    try {
      await doctorApplicationsApi.review(id, status);
      toast.success(`Application ${status.toLowerCase()} successfully.`);
      setReviewingApp(null);
      refetch();
    } catch (err) {
      toast.error(err.message || `Failed to ${status.toLowerCase()} application.`);
    } finally {
      setProcessingAction(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Applicant Pipeline</h2>
        <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Review credentials and onboard new medical practitioners</p>
      </div>

      {/* Main Card */}
      <Card>
        <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[200px]">
            <option value="">All Statuses</option>
            {APPLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <Spinner label="Loading applications..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : applications.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="No applications found"
            description={statusFilter ? 'Try changing your status filter.' : 'You have no pending doctor applications.'}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Applicant</Th>
              <Th>Specialization</Th>
              <Th>Experience</Th>
              <Th>Applied On</Th>
              <Th>Status</Th>
              <Th className="text-right">Action</Th>
            </Thead>
            <tbody>
              {applications.map((app) => (
                <Tr key={app.application_id}>
                  <Td>
                    <p className="font-medium text-[var(--color-ink)]">{app.name}</p>
                    <p className="text-xs text-[var(--color-ink-faint)] font-mono-data mt-0.5">{app.email}</p>
                  </Td>
                  <Td>
                    <p className="font-medium">{app.specialization}</p>
                    <p className="text-xs text-[var(--color-ink-faint)] mt-0.5">{app.department || 'General'}</p>
                  </Td>
                  <Td>{app.years_experience ? `${app.years_experience} years` : 'Not specified'}</Td>
                  <Td>{formatDate(app.created_at)}</Td>
                  <Td><StatusPill status={app.status} /></Td>
                  <Td className="text-right">
                    {app.status === 'PENDING' && (
                      <Button size="sm" variant="secondary" onClick={() => setReviewingApp(app)}>
                        Review Profile
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* Review Drawer */}
      <Drawer 
        open={!!reviewingApp} 
        onClose={() => !processingAction && setReviewingApp(null)} 
        title="Application Review"
        size="lg"
        footer={
          reviewingApp?.status === 'PENDING' && (
            <>
              <Button 
                variant="danger" 
                loading={processingAction === 'REJECTED'} 
                disabled={!!processingAction && processingAction !== 'REJECTED'}
                onClick={() => handleReview(reviewingApp.application_id, 'REJECTED')}
              >
                Reject Applicant
              </Button>
              <Button 
                variant="primary" 
                loading={processingAction === 'APPROVED'} 
                disabled={!!processingAction && processingAction !== 'APPROVED'}
                onClick={() => handleReview(reviewingApp.application_id, 'APPROVED')}
              >
                Approve & Hire
              </Button>
            </>
          )
        }
      >
        {reviewingApp && (
          <div className="flex flex-col gap-8">
            
            {/* Identity Block */}
            <div className="flex items-start gap-4 pb-6 border-b border-[var(--color-border)]">
              <div className="h-16 w-16 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)] flex items-center justify-center text-xl font-display font-semibold shrink-0">
                {reviewingApp.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-display text-2xl font-bold text-[var(--color-ink)]">{reviewingApp.name}</h3>
                <div className="flex items-center gap-4 mt-2 text-sm text-[var(--color-ink-soft)]">
                  <span className="flex items-center gap-1.5"><Mail size={14} /> {reviewingApp.email}</span>
                  {reviewingApp.phone && <span className="font-mono-data">{reviewingApp.phone}</span>}
                </div>
              </div>
            </div>

            {/* Professional Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-[var(--color-ink-faint)] uppercase tracking-wider flex items-center gap-2">
                  <Briefcase size={14} /> Clinical Profile
                </span>
                <p className="text-[15px] font-medium text-[var(--color-ink)]">{reviewingApp.specialization}</p>
                <p className="text-sm text-[var(--color-ink-soft)]">Dept: {reviewingApp.department || 'Not specified'}</p>
                <p className="text-sm text-[var(--color-ink-soft)]">Experience: {reviewingApp.years_experience} Years</p>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-[var(--color-ink-faint)] uppercase tracking-wider flex items-center gap-2">
                  <GraduationCap size={14} /> Education & Reg.
                </span>
                <p className="text-[15px] font-medium text-[var(--color-ink)] whitespace-pre-wrap">
                  {reviewingApp.education || 'No educational history provided.'}
                </p>
              </div>
            </div>

            {/* Cover Letter / Message */}
            <div className="flex flex-col gap-2 bg-[var(--color-paper)] p-5 rounded-[var(--radius-md)] border border-[var(--color-border)]">
              <span className="text-xs font-semibold text-[var(--color-ink-faint)] uppercase tracking-wider flex items-center gap-2">
                <Building2 size={14} /> Cover Letter / Message
              </span>
              <p className="text-sm text-[var(--color-ink)] whitespace-pre-wrap leading-relaxed italic">
                {reviewingApp.message ? `"${reviewingApp.message}"` : 'No additional message provided by the applicant.'}
              </p>
            </div>

            {/* Action Context Info */}
            {reviewingApp.status === 'PENDING' && (
              <div className="bg-[var(--color-info-soft)] text-[var(--color-info)] p-4 rounded-[var(--radius-md)] text-sm border border-[var(--color-info)]/20 mt-4">
                <strong>Administrative Note:</strong> Approving this application will automatically generate a Doctor profile, create a portal account, and securely email the setup credentials to <b>{reviewingApp.email}</b>.
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}