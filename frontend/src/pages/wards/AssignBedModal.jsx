import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { wardsApi } from '../../api/wards.js';
import { patientsApi } from '../../api/patients.js';
import { toast } from '../../components/ui/Toast.jsx';
import { fullName } from '../../utils/format.js';

export default function AssignBedModal({ open, onClose, onSaved, bed }) {
  const [patientId, setPatientId] = useState('');
  const [patients, setPatients] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // Fetch patients for the dropdown
      patientsApi.list({ limit: 100 })
        .then(res => setPatients(res.data || []))
        .catch(() => setPatients([]));
    } else {
      setPatientId('');
    }
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!patientId) return;

    setSaving(true);
    try {
      await wardsApi.assignBed(bed.bed_id, { patientId });
      toast.success(`Patient assigned to bed ${bed.bed_number} successfully.`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to assign bed.');
    } finally {
      setSaving(false);
    }
  }

  if (!bed) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Assign Bed: ${bed.bed_number}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={!patientId}>Confirm Assignment</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select label="Select Patient" required value={patientId} onChange={(e) => setPatientId(e.target.value)}>
          <option value="">Select a registered patient...</option>
          {patients.map(p => (
            <option key={p.patient_id} value={p.patient_id}>
              {fullName(p)} {p.phone ? `(${p.phone})` : ''}
            </option>
          ))}
        </Select>
        <p className="text-xs text-[var(--color-ink-faint)]">
          Note: In a full clinical workflow, beds are usually assigned during the Admission process. 
          Use this to manually allocate a bed to an existing patient.
        </p>
      </form>
    </Modal>
  );
}