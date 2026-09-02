import { useState } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { hrmsApi } from '../../api/hrms.js';
import { toast } from '../../components/ui/Toast.jsx';

export default function ShiftFormModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', startTime: '', endTime: '' });
  const [saving, setSaving] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await hrmsApi.createShift({
        name: form.name,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
      });
      toast.success('Shift created successfully.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to create shift.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Staff Shift"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Save Shift</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Shift Name" required value={form.name} onChange={update('name')} placeholder="e.g., Morning Shift (A)" />
        <Input label="Start Time" type="datetime-local" required value={form.startTime} onChange={update('startTime')} />
        <Input label="End Time" type="datetime-local" required value={form.endTime} onChange={update('endTime')} />
      </form>
    </Modal>
  );
}