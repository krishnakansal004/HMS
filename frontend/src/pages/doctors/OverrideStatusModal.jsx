import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { doctorAttendanceApi } from '../../api/doctorAttendance.js';
import { doctorsApi } from '../../api/doctors.js';
import { toast } from '../../components/ui/Toast.jsx';

const overrideStatuses = [
  { value: 'absent', label: 'Absent' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'on_leave', label: 'On Leave' }
];

export default function OverrideStatusModal({ open, onClose, onSaved, defaultDate }) {
  const [form, setForm] = useState({ targetUserId: '', attendanceDate: '', status: 'absent', notes: '' });
  const [doctors, setDoctors] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(f => ({ ...f, attendanceDate: defaultDate || new Date().toISOString().slice(0, 10) }));
      doctorsApi.list()
        .then(res => setDoctors(res.data || []))
        .catch(() => toast.error("Failed to load doctors list."));
    } else {
      setForm({ targetUserId: '', attendanceDate: '', status: 'absent', notes: '' });
    }
  }, [open, defaultDate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.targetUserId) return;
    setSaving(true);
    try {
      await doctorAttendanceApi.setStatus(form);
      toast.success('Doctor status updated successfully.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to update status.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Override Doctor Status" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} loading={saving} disabled={!form.targetUserId}>Save Status</Button>
      </>
    }>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select label="Select Doctor" required value={form.targetUserId} onChange={(e) => setForm(f => ({ ...f, targetUserId: e.target.value }))}>
          <option value="">Choose a doctor...</option>
          {doctors.map(doc => (
            <option key={doc.user_id} value={doc.user_id}>Dr. {doc.name}</option>
          ))}
        </Select>
        
        <div className="grid grid-cols-2 gap-4">
          <Input label="Date" type="date" required value={form.attendanceDate} onChange={(e) => setForm(f => ({ ...f, attendanceDate: e.target.value }))} />
          <Select label="Status" required value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}>
            {overrideStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>
        
        <Textarea label="Notes / Reason" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional reason for override..." />
      </form>
    </Modal>
  );
}