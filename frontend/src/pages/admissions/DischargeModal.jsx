import { useState } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { admissionsApi } from '../../api/admissions.js';
import { toast } from '../../components/ui/Toast.jsx';
import { fullName } from '../../utils/format.js';

export default function DischargeModal({ open, onClose, onSaved, admission }) {
  const [dischargeNotes, setDischargeNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);

    try {
      await admissionsApi.updateStatus(admission.admission_id, {
        status: 'discharged',
        dischargeNotes: dischargeNotes.trim() || undefined
      });
      toast.success(`${fullName(admission.patient)} has been discharged.`);
      setDischargeNotes('');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to discharge patient');
    } finally {
      setSaving(false);
    }
  }

  if (!admission) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Discharge Patient"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving} variant="danger">Confirm Discharge</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="bg-[var(--color-paper)] p-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] mb-2">
          <p className="text-sm font-medium text-[var(--color-ink)]">Discharging: {fullName(admission.patient)}</p>
          {admission.bed && (
            <p className="text-xs text-[var(--color-danger)] mt-1 font-medium">
              Bed {admission.bed.bed_number} will be automatically marked as available.
            </p>
          )}
        </div>

        <Textarea 
          label="Discharge Summary & Notes" 
          value={dischargeNotes} 
          onChange={(e) => setDischargeNotes(e.target.value)} 
          placeholder="Final clinical notes, medication instructions, and follow-up advice..."
        />
      </form>
    </Modal>
  );
}