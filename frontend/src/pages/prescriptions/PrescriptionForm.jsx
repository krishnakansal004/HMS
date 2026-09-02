import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { prescriptionsApi } from '../../api/prescriptions.js';
import { patientsApi } from '../../api/patients.js';
import { toast } from '../../components/ui/Toast.jsx';
import { fullName } from '../../utils/format.js';

const emptyItem = { medicineName: '', dosage: '', frequency: '', durationDays: '', instructions: '' };
const emptyForm = { patientId: '', diagnosis: '', instructions: '' };

export default function PrescriptionForm({ open, onClose, onSaved }) {
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
      await prescriptionsApi.create({
        patientId: form.patientId,
        diagnosis: form.diagnosis,
        instructions: form.instructions || undefined,
        items: items.map((it) => ({ ...it, durationDays: Number(it.durationDays) || 0 })),
      });

      toast.success('Prescription created successfully');
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to create prescription');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Prescription"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Create Prescription</Button>
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

        <Input
          label="Diagnosis"
          required
          value={form.diagnosis}
          onChange={update('diagnosis')}
          error={errors.diagnosis}
          placeholder="e.g. Acute bacterial sinusitis"
        />

        <Textarea
          label="General instructions (optional)"
          value={form.instructions}
          onChange={update('instructions')}
          error={errors.instructions}
          placeholder="e.g. Complete full course, review after 5 days"
        />

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[var(--color-ink)]">Medicines</h4>
            <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={addItem}>
              Add medicine
            </Button>
          </div>

          {items.map((item, i) => (
            <div key={i} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--color-ink-faint)]">Medicine {i + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="p-1 rounded-md text-[var(--color-ink-faint)] hover:bg-[var(--color-paper)] hover:text-[var(--color-danger)]"
                    aria-label="Remove medicine"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Medicine name"
                  required
                  value={item.medicineName}
                  onChange={updateItem(i, 'medicineName')}
                  error={errors[`items[${i}].medicineName`]}
                  placeholder="e.g. Amoxicillin 500mg"
                />
                <Input
                  label="Dosage"
                  required
                  value={item.dosage}
                  onChange={updateItem(i, 'dosage')}
                  error={errors[`items[${i}].dosage`]}
                  placeholder="e.g. 1 tablet"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Frequency"
                  required
                  value={item.frequency}
                  onChange={updateItem(i, 'frequency')}
                  error={errors[`items[${i}].frequency`]}
                  placeholder="e.g. Twice daily"
                />
                <Input
                  label="Duration (days)"
                  type="number"
                  min="1"
                  required
                  value={item.durationDays}
                  onChange={updateItem(i, 'durationDays')}
                  error={errors[`items[${i}].durationDays`]}
                />
              </div>

              <Input
                label="Notes (optional)"
                value={item.instructions}
                onChange={updateItem(i, 'instructions')}
                error={errors[`items[${i}].instructions`]}
                placeholder="e.g. Take after food"
              />
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}
