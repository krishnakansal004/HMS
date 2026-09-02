import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { invoicesApi, PAYMENT_METHODS } from '../../api/invoices.js';
import { toast } from '../../components/ui/Toast.jsx';

export default function RecordPaymentModal({ open, onClose, onSaved, invoice }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [transactionId, setTransactionId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && invoice) {
      // Auto-fill with remaining balance (converted back to display decimals)
      const remainingPaise = Number(invoice.total) - Number(invoice.amount_paid);
      setAmount((remainingPaise / 100).toFixed(2));
      setMethod('CASH');
      setTransactionId('');
    }
  }, [open, invoice]);

  async function handleSubmit(e) {
    e.preventDefault();
    const remainingPaise = Number(invoice.total) - Number(invoice.amount_paid);
    const amountToPayPaise = Math.round(Number(amount) * 100);

    if (amountToPayPaise <= 0 || amountToPayPaise > remainingPaise) {
      toast.error('Invalid payment amount. Must be greater than 0 and not exceed the remaining balance.');
      return;
    }

    setSaving(true);
    try {
      await invoicesApi.pay(invoice.invoice_id, {
        amount: amountToPayPaise,
        method,
        transactionId: transactionId.trim() || undefined
      });
      toast.success('Payment recorded successfully.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  }

  if (!invoice) return null;

  const totalRupees = (Number(invoice.total) / 100).toFixed(2);
  const paidRupees = (Number(invoice.amount_paid) / 100).toFixed(2);
  const remainingRupees = ((Number(invoice.total) - Number(invoice.amount_paid)) / 100).toFixed(2);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Receive Payment: Invoice #${invoice.invoice_number}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Record Payment</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="bg-[var(--color-paper)] p-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] mb-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-[var(--color-ink-faint)]">Total Bill</p>
            <p className="font-mono-data text-sm font-semibold">₹{totalRupees}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-ink-faint)]">Amount Paid</p>
            <p className="font-mono-data text-sm font-semibold text-[var(--color-success)]">₹{paidRupees}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-ink-faint)]">Balance Due</p>
            <p className="font-mono-data text-sm font-semibold text-[var(--color-danger)]">₹{remainingRupees}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="Payment Amount (₹)" 
            type="number" 
            step="0.01" 
            min="0.01" 
            max={remainingRupees}
            required 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
          />
          <Select label="Payment Method" required value={method} onChange={(e) => setMethod(e.target.value)}>
            {PAYMENT_METHODS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
        </div>

        {method !== 'CASH' && (
          <Input 
            label="Transaction ID / Reference" 
            required={method !== 'CASH'}
            value={transactionId} 
            onChange={(e) => setTransactionId(e.target.value)} 
            placeholder="e.g. UPI Ref, Cheque No, Auth Code..."
          />
        )}
      </form>
    </Modal>
  );
}