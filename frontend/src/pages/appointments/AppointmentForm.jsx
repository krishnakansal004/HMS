import { useState } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { appointmentsApi } from '../../api/appointments.js';
import { toast } from '../../components/ui/Toast.jsx';

const empty = { patientId: '', doctorId: '', startTime: '', endTime: '', type: 'walk_in', notes: '' };

// NOTE: doctorId/patientId are plain UUID text inputs here rather than
// searchable pickers — there's no /api/staff or /api/doctors list endpoint
// among the 19 live route groups to populate a dropdown from yet. Swap
// this for a real picker once that endpoint exists (tracked for Phase 2).
export default function AppointmentForm({ open, onClose, onSaved }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await appointmentsApi.create({
        ...form,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
      });
      toast.success('Appointment booked');
      setForm(empty);
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Book appointment"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Book appointment</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Patient ID" required value={form.patientId} onChange={update('patientId')} error={errors.patientId} placeholder="Paste patient UUID" />
        <Input label="Doctor ID" required value={form.doctorId} onChange={update('doctorId')} error={errors.doctorId} placeholder="Paste doctor profile UUID" />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Start time" type="datetime-local" required value={form.startTime} onChange={update('startTime')} error={errors.startTime} />
          <Input label="End time" type="datetime-local" required value={form.endTime} onChange={update('endTime')} error={errors.endTime} />
        </div>
        <Select label="Type" required value={form.type} onChange={update('type')} error={errors.type}>
          <option value="walk_in">Walk-in</option>
          <option value="online">Online</option>
        </Select>
        <Textarea label="Notes" value={form.notes} onChange={update('notes')} error={errors.notes} />
      </form>
    </Modal>
  );
}
