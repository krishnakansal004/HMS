import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { invoicesApi, INVOICE_ITEM_TYPES } from '../../api/invoices.js';
import { patientsApi } from '../../api/patients.js';
import { toast } from '../../components/ui/Toast.jsx';
import { fullName } from '../../utils/format.js';

// Amounts here are entered in rupees for usability and converted to integer
// paise on submit — the backend requires integers in minor currency units
// (invoiceValidator.js: isInt "in minor currency").
const rupeesToPaise = (value) => Math.round(Number(value || 0) * 100);

const emptyItem = { entityType: 'CONSULTATION', description: '', quantity: '1', unitPrice: '' };
const emptyForm = { patientId: '', discount: '', taxRate: '' };

export default function InvoiceForm({ open, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    if (open) {
      patientsApi.list({ limit: 100 })
        .then((res) => setPatients(res.data || []))
        .catch(() => setPatients([]));
    } else {
      setForm(emptyForm);
      setItems([{ ...emptyItem }]);
      setErrors({});
    }
  }, [open]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function updateItem(index, field) {
    return (e) => {
      const value = e.target.value;
      setItems((its) => its.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
    };
  }

  function addItem() {
    setItems((its) => [...its, { ...emptyItem }]);
  }

  function removeItem(index) {
    setItems((its) => its.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      await invoicesApi.create({
        patientId: form.patientId,
        discount: form.discount ? rupeesToPaise(form.discount) : undefined,
        taxRate: form.taxRate ? Number(form.taxRate) : undefined,
        items: items.map((it) => ({
          entityType: it.entityType,
          description: it.description,
          quantity: Number(it.quantity) || 0,
          unitPrice: rupeesToPaise(it.unitPrice),
        })),
      });

      toast.success('Invoice created successfully');
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to create invoice');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Invoice"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Create Invoice</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select label="Patient" required value={form.patientId} onChange={update('patientId')} error={errors.patientId}>
          <option value="">Select patient...</option>
          {patients.map((p) => (
            <option key={p.patient_id} value={p.patient_id}>
              {fullName(p)} {p.phone ? `(${p.phone})` : ''}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Discount (₹, optional)"
            type="number"
            min="0"
            step="0.01"
            value={form.discount}
            onChange={update('discount')}
            error={errors.discount}
            placeholder="0.00"
          />
          <Input
            label="Tax Rate (%, optional)"
            type="number"
            min="0"
            max="100"
            value={form.taxRate}
            onChange={update('taxRate')}
            error={errors.taxRate}
            placeholder="0"
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[var(--color-ink)]">Items</h4>
            <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={addItem}>
              Add item
            </Button>
          </div>

          {items.map((item, i) => (
            <div key={i} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--color-ink-faint)]">Item {i + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="p-1 rounded-md text-[var(--color-ink-faint)] hover:bg-[var(--color-paper)] hover:text-[var(--color-danger)]"
                    aria-label="Remove item"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Type"
                  required
                  value={item.entityType}
                  onChange={updateItem(i, 'entityType')}
                  error={errors[`items[${i}].entityType`]}
                >
                  {INVOICE_ITEM_TYPES.map((t) => (
                    <option key={t} value={t} className="capitalize">{t}</option>
                  ))}
                </Select>
                <Input
                  label="Description"
                  required
                  value={item.description}
                  onChange={updateItem(i, 'description')}
                  error={errors[`items[${i}].description`]}
                  placeholder="e.g. OPD Consultation"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Quantity"
                  type="number"
                  min="1"
                  required
                  value={item.quantity}
                  onChange={updateItem(i, 'quantity')}
                  error={errors[`items[${i}].quantity`]}
                />
                <Input
                  label="Unit Price (₹)"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={item.unitPrice}
                  onChange={updateItem(i, 'unitPrice')}
                  error={errors[`items[${i}].unitPrice`]}
                  placeholder="0.00"
                />
              </div>
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}
