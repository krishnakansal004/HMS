import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { admissionsApi } from '../../api/admissions.js';
import { toast } from '../../components/ui/Toast.jsx';
import { fullName } from '../../utils/format.js';

const empty = { status: 'discharged', dischargeDate: '', dischargeNotes: '' };

export default function AdmissionStatusForm({ open, onClose, onSaved, admission }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(empty);
      setErrors({});
    }
  }, [open]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!admission) return;
    setSaving(true);
    setErrors({});

    try {
      await admissionsApi.updateStatus(admission.admission_id, {
        status: form.status,
        dischargeDate: form.dischargeDate ? new Date(form.dischargeDate).toISOString() : undefined,
        dischargeNotes: form.dischargeNotes || undefined,
      });

      toast.success('Admission status updated');
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to update admission');
      }
    } finally {
      setSaving(false);
    }
  }

  const patientLabel = admission ? fullName(admission.patient) : '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Update Admission${patientLabel ? ` — ${patientLabel}` : ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Save Status</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select label="Status" required value={form.status} onChange={update('status')} error={errors.status}>
          <option value="admitted">Admitted</option>
          <option value="discharged">Discharged</option>
          <option value="transferred">Transferred</option>
          <option value="cancelled">Cancelled</option>
        </Select>

        {form.status === 'discharged' && (
          <>
            <Input
              label="Discharge date"
              type="datetime-local"
              value={form.dischargeDate}
              onChange={update('dischargeDate')}
              error={errors.dischargeDate}
              hint="Leave blank to use the current date and time"
            />
            <Textarea
              label="Discharge notes"
              value={form.dischargeNotes}
              onChange={update('dischargeNotes')}
              error={errors.dischargeNotes}
              placeholder="e.g. Recovered well, follow-up in 2 weeks"
            />
          </>
        )}
      </form>
    </Modal>
  );
}
