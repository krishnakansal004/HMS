import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Select, Input, Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { insuranceApi, CLAIM_STATUSES } from '../../api/insurance.js';
import { toast } from '../../components/ui/Toast.jsx';
import { formatPaise } from '../../utils/format.js';

export default function UpdateClaimModal({ open, onClose, onSaved, claim }) {
  const [status, setStatus] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [settlementDate, setSettlementDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && claim) {
      setStatus(claim.status);
      setApprovedAmount(claim.approved_amount ? (claim.approved_amount / 100).toFixed(2) : '');
      setRejectionReason(claim.rejection_reason || '');
      setSettlementDate(claim.settlement_date ? new Date(claim.settlement_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    }
  }, [open, claim]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = { status };
      
      if (status === 'approved' || status === 'settled') {
        payload.approvedAmount = Number(approvedAmount); // Passes float (converted to paise on backend)
        if (status === 'settled') payload.settlementDate = new Date(settlementDate).toISOString();
      } else if (status === 'rejected') {
        payload.rejectionReason = rejectionReason.trim();
      }

      await insuranceApi.updateClaim(claim.claim_id, payload);
      toast.success('Claim updated successfully.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to update claim');
    } finally {
      setSaving(false);
    }
  }

  if (!claim) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Update Claim Status"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Save Updates</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="bg-[var(--color-paper)] p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] mb-2">
          <p className="text-sm font-medium text-[var(--color-ink)]">{claim.company?.name || 'Unknown TPA'}</p>
          <p className="text-xs text-[var(--color-ink-soft)] mt-1">Claimed: <span className="font-mono-data text-[var(--color-ink)] font-semibold">{formatPaise(claim.claimed_amount)}</span></p>
        </div>

        <Select label="Status" required value={status} onChange={(e) => setStatus(e.target.value)}>
          {CLAIM_STATUSES.map(s => <option key={s} value={s} className="capitalize">{s.replace('_', ' ')}</option>)}
        </Select>

        {(status === 'approved' || status === 'settled') && (
          <Input 
            label="Approved / Sanctioned Amount (₹)" 
            type="number" 
            step="0.01" 
            min="0" 
            required 
            value={approvedAmount} 
            onChange={(e) => setApprovedAmount(e.target.value)} 
          />
        )}

        {status === 'settled' && (
          <Input 
            label="Settlement Date" 
            type="date" 
            required 
            value={settlementDate} 
            onChange={(e) => setSettlementDate(e.target.value)} 
            hint="This will immediately post the payment to the linked invoice."
          />
        )}

        {status === 'rejected' && (
          <Textarea 
            label="Reason for Rejection" 
            required 
            value={rejectionReason} 
            onChange={(e) => setRejectionReason(e.target.value)} 
            placeholder="Document TPA's remarks for denial..."
          />
        )}
      </form>
    </Modal>
  );
}