import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { insuranceApi } from '../../api/insurance.js';
import { patientsApi } from '../../api/patients.js';
import { invoicesApi } from '../../api/invoices.js';
import { toast } from '../../components/ui/Toast.jsx';
import { fullName, formatPaise } from '../../utils/format.js';
import { Spinner } from '../../components/ui/Table.jsx';

const emptyForm = { patientId: '', companyId: '', policyNumber: '', totalBillAmount: '', claimedAmount: '', invoiceId: '' };

export default function CreateClaimModal({ open, onClose, onSaved, companies = [] }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  
  const [patients, setPatients] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  useEffect(() => {
    if (open) {
      setLoadingDeps(true);
      patientsApi.list({ limit: 100 })
        .then(res => setPatients(res.data || []))
        .catch(() => toast.error('Failed to load patients'))
        .finally(() => setLoadingDeps(false));
    } else {
      setForm(emptyForm);
      setErrors({});
      setInvoices([]);
    }
  }, [open]);

  // Dynamically load open invoices only for the selected patient
  useEffect(() => {
    if (form.patientId) {
      setLoadingInvoices(true);
      invoicesApi.list({ patientId: form.patientId, status: 'PENDING', limit: 20 })
        .then(res => setInvoices(res.data || res.invoices || []))
        .catch(() => setInvoices([]))
        .finally(() => setLoadingInvoices(false));
    } else {
      setInvoices([]);
      setForm(f => ({ ...f, invoiceId: '' }));
    }
  }, [form.patientId]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      const payload = { ...form };
      if (!payload.invoiceId) delete payload.invoiceId;
      
      // We pass float standard numbers (backend service was patched to multiply to Paise)
      payload.totalBillAmount = Number(payload.totalBillAmount);
      payload.claimedAmount = Number(payload.claimedAmount);

      if (payload.claimedAmount > payload.totalBillAmount) {
        toast.error('Claimed amount cannot exceed the total bill amount.');
        setSaving(false);
        return;
      }

      await insuranceApi.createClaim(payload);
      toast.success('Insurance claim submitted successfully.');
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to submit claim');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="File Insurance Claim"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={loadingDeps || companies.length === 0}>Submit Claim</Button>
        </>
      }
    >
      {loadingDeps ? (
        <Spinner label="Loading clinical data..." />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Patient" required value={form.patientId} onChange={update('patientId')} error={errors.patientId}>
              <option value="">Select a patient...</option>
              {patients.map(p => <option key={p.patient_id} value={p.patient_id}>{fullName(p)}</option>)}
            </Select>

            <Select label="Insurance Provider" required value={form.companyId} onChange={update('companyId')} error={errors.companyId}>
              <option value="">Select TPA...</option>
              {companies.map(c => <option key={c.company_id} value={c.company_id}>{c.name} ({c.code})</option>)}
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Policy / Health Card Number" required value={form.policyNumber} onChange={update('policyNumber')} error={errors.policyNumber} />
            <Select 
              label="Link to Open Invoice (Optional)" 
              value={form.invoiceId} 
              onChange={update('invoiceId')} 
              error={errors.invoiceId}
              hint={loadingInvoices ? 'Looking up invoices...' : invoices.length === 0 && form.patientId ? 'No pending invoices found' : ''}
              disabled={!form.patientId || loadingInvoices}
            >
              <option value="">Do not link an invoice</option>
              {invoices.map(inv => (
                <option key={inv.invoice_id} value={inv.invoice_id}>
                  Invoice #{inv.invoice_number} - {formatPaise(inv.total)}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Total Bill Amount (₹)" type="number" step="0.01" min="0" required value={form.totalBillAmount} onChange={update('totalBillAmount')} error={errors.totalBillAmount} />
            <Input label="Claimed Amount (₹)" type="number" step="0.01" min="0" required value={form.claimedAmount} onChange={update('claimedAmount')} error={errors.claimedAmount} />
          </div>
        </form>
      )}
    </Modal>
  );
}