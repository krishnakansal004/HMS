import { useState } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import { planRequestsApi } from '../../api/plans.js';
import { toast } from '../../components/ui/Toast.jsx';

export default function ReviewRequestModal({ open, onClose, onSaved, request }) {
  const [saving, setSaving] = useState(false);
  const [actionType, setActionType] = useState(null);

  async function handleReview(status) {
    setActionType(status);
    setSaving(true);
    try {
      await planRequestsApi.review(request.plan_request_id, status);
      toast.success(`Plan request ${status} successfully.`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to review request');
    } finally {
      setSaving(false);
      setActionType(null);
    }
  }

  if (!request) return null;

  return (
    <Modal open={open} onClose={onClose} title="Review Upgrade Request" footer={
      <>
        <Button variant="danger" onClick={() => handleReview('rejected')} loading={saving && actionType === 'rejected'} disabled={saving && actionType !== 'rejected'}>
          Reject Request
        </Button>
        <Button variant="primary" onClick={() => handleReview('approved')} loading={saving && actionType === 'approved'} disabled={saving && actionType !== 'approved'}>
          Approve Upgrade
        </Button>
      </>
    }>
      <div className="flex flex-col gap-4">
        <div className="bg-[var(--color-paper)] p-4 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
          <h4 className="font-semibold text-[var(--color-ink)]">{request.tenant?.name || 'Unknown Hospital'}</h4>
          <p className="text-sm text-[var(--color-ink-soft)]">Portal Slug: {request.tenant?.slug || 'N/A'}</p>
          
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm border-t border-[var(--color-border)] pt-3">
            <div><span className="text-[var(--color-ink-faint)]">Requested Plan:</span> {request.plan?.name}</div>
            <div><span className="text-[var(--color-ink-faint)]">Billing Period:</span> <span className="capitalize">{request.period}</span></div>
            <div className="col-span-2"><span className="text-[var(--color-ink-faint)]">Transaction Amount:</span> <span className="font-mono-data font-medium">₹{(Number(request.requested_amount) / 100).toFixed(2)}</span></div>
          </div>
        </div>
        <p className="text-sm text-[var(--color-ink-soft)]">
          Approving this request will immediately update the hospital's tenant limits and allow them to access expanded resources.
        </p>
      </div>
    </Modal>
  );
}