import { useState } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { hrmsApi } from '../../api/hrms.js';
import { toast } from '../../components/ui/Toast.jsx';

export default function LeaveFormModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ startDate: '', endDate: '', reason: '' });
  const [saving, setSaving] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await hrmsApi.applyLeave(form);
      toast.success('Leave application submitted.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to apply for leave.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request Leave"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Submit Request</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Start Date" type="date" required value={form.startDate} onChange={update('startDate')} />
          <Input label="End Date" type="date" required value={form.endDate} onChange={update('endDate')} />
        </div>
        <Textarea label="Reason" required value={form.reason} onChange={update('reason')} placeholder="Reason for leave application..." />
      </form>
    </Modal>
  );
}