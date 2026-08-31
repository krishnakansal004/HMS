import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Select, Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { radiologyApi, RADIOLOGY_STATUSES } from '../../api/radiology.js';
import { invoicesApi } from '../../api/invoices.js';
import { toast } from '../../components/ui/Toast.jsx';

export default function UpdateRadiologyModal({ open, onClose, onSaved, order }) {
  const [status, setStatus] = useState('');
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && order) {
      setStatus(order.status);
      setFindings(order.findings || '');
      setImpression(order.impression || '');
      
      // If marking as completed, we can post a charge. Fetch patient's open invoices.
      if (order.status !== 'completed' && order.billing_status !== 'billed') {
        setLoadingInvoices(true);
        invoicesApi.list({ patientId: order.patient_id, status: 'pending' })
          .then(res => setInvoices(res.data || res.invoices || []))
          .catch(() => setInvoices([]))
          .finally(() => setLoadingInvoices(false));
      }
    }
  }, [open, order]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    try {
      await radiologyApi.updateStatus(order.radiology_order_id, {
        status,
        findings: findings.trim() || undefined,
        impression: impression.trim() || undefined,
        invoiceId: status === 'completed' && invoiceId ? invoiceId : undefined
      });
      toast.success('Radiology order updated successfully.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to update order');
    } finally {
      setSaving(false);
    }
  }

  if (!order) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Update Scan: ${order.modality} - ${order.study_type}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Save Updates</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="bg-[var(--color-paper)] p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
          <p className="text-sm font-medium text-[var(--color-ink)]">Patient: {order.patient_name_snapshot}</p>
          <p className="text-xs text-[var(--color-ink-soft)] mt-1">Requested by: Dr. {order.doctor_profile?.users?.name || 'Unknown'}</p>
          {order.notes && <p className="text-xs text-[var(--color-ink-faint)] mt-2 italic">Notes: "{order.notes}"</p>}
        </div>

        <Select label="Status" required value={status} onChange={(e) => setStatus(e.target.value)}>
          {RADIOLOGY_STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
        </Select>

        <Textarea label="Findings" value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="Detailed observations from the scan..." rows={4} />
        <Textarea label="Impression (Conclusion)" value={impression} onChange={(e) => setImpression(e.target.value)} placeholder="Final clinical impression/diagnosis..." />

        {/* Auto-Billing Integration */}
        {status === 'completed' && order.billing_status !== 'billed' && (
          <div className="border border-[var(--color-accent)] bg-[var(--color-accent-soft)] p-3 rounded-[var(--radius-sm)]">
            <Select label="Post Charge to Invoice (Optional)" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} hint={loadingInvoices ? 'Loading open invoices...' : `Amount to post: ₹${(order.price / 100).toFixed(2)}`}>
              <option value="">Do not bill yet</option>
              {invoices.map(inv => (
                <option key={inv.invoice_id} value={inv.invoice_id}>
                  Invoice #{inv.invoice_number} (Created: {new Date(inv.created_at).toLocaleDateString()})
                </option>
              ))}
            </Select>
          </div>
        )}
      </form>
    </Modal>
  );
}