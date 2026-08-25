import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { doctorApplicationsApi, APPLICATION_STATUSES } from '../../api/doctorApplications.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Select } from '../../components/ui/Input.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import { formatDate } from '../../utils/format.js';
import { toast } from '../../components/ui/Toast.jsx';
import Modal from '../../components/ui/Modal.jsx';

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
      setProcessingAction(null); // Clear it
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Applicant Pipeline</h2>
        <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Review and onboard new practitioners</p>
      </div>

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
                    <p className="text-xs text-[var(--color-ink-faint)]">{app.email}</p>
                  </Td>
                  <Td>
                    <p>{app.specialization}</p>
                    <p className="text-xs text-[var(--color-ink-faint)]">{app.department || 'N/A'}</p>
                  </Td>
                  <Td>{app.years_experience ? `${app.years_experience} years` : 'Not specified'}</Td>
                  <Td>{formatDate(app.created_at)}</Td>
                  <Td><StatusPill status={app.status} /></Td>
                  <Td className="text-right">
                    {app.status === 'PENDING' && (
                      <Button size="sm" variant="secondary" onClick={() => setReviewingApp(app)}>
                        Review
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal open={!!reviewingApp} onClose={() => !processingAction && setReviewingApp(null)} title="Review Application">
        {reviewingApp && (
          <div className="flex flex-col gap-4">
            <div className="bg-[var(--color-paper)] p-4 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
              <h4 className="font-semibold text-[var(--color-ink)]">{reviewingApp.name}</h4>
              <p className="text-sm text-[var(--color-ink-soft)]">{reviewingApp.email} | {reviewingApp.phone}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-[var(--color-ink-faint)]">Specialty:</span> {reviewingApp.specialization}</div>
                <div><span className="text-[var(--color-ink-faint)]">Experience:</span> {reviewingApp.years_experience} Yrs</div>
                <div className="col-span-2"><span className="text-[var(--color-ink-faint)]">Education:</span> {reviewingApp.education}</div>
              </div>
              {reviewingApp.message && (
                <div className="mt-3 p-3 bg-white border border-[var(--color-border)] rounded text-sm text-[var(--color-ink-soft)] italic">
                  "{reviewingApp.message}"
                </div>
              )}
            </div>
            <p className="text-sm text-[var(--color-ink-soft)]">
              Approving this application will automatically generate a Doctor profile, create an account, and email the credentials to the applicant.
            </p>
            <div className="flex gap-3 justify-end mt-2">
              <Button 
                variant="danger" 
                loading={processingAction === 'REJECTED'} 
                disabled={!!processingAction && processingAction !== 'REJECTED'}
                onClick={() => handleReview(reviewingApp.application_id, 'REJECTED')}
              >
                Reject
              </Button>
              <Button 
                variant="primary" 
                loading={processingAction === 'APPROVED'} 
                disabled={!!processingAction && processingAction !== 'APPROVED'}
                onClick={() => handleReview(reviewingApp.application_id, 'APPROVED')}
              >
                Approve & Hire
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}