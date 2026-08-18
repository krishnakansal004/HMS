import { useState } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { doctorsApi } from '../../api/doctors.js';
import { toast } from '../../components/ui/Toast.jsx';

const initialForm = {
  name: '',
  email: '',
  phone: '',
  specialization: '',
  department: '',
  experienceYears: '',
  consultationFee: ''
};

export default function DoctorForm({ open, onClose, onSaved }) {
  const [form, setForm] = useState(initialForm);
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
      // Backend handles password generation and email dispatch automatically
      await doctorsApi.create({
        ...form,
        experienceYears: Number(form.experienceYears) || 0,
        consultationFee: Number(form.consultationFee) || 0
      });
      
      toast.success('Doctor registered and credentials emailed successfully');
      setForm(initialForm);
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to register doctor');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register New Doctor"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Register Doctor</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Full Name" required value={form.name} onChange={update('name')} error={errors.name} placeholder="e.g. Sarah Connor" />
          <Input label="Email" type="email" required value={form.email} onChange={update('email')} error={errors.email} placeholder="Doctor's login email" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <Input label="Department" required value={form.department} onChange={update('department')} error={errors.department} placeholder="e.g. Cardiology" />
          <Input label="Specialization" required value={form.specialization} onChange={update('specialization')} error={errors.specialization} placeholder="e.g. Heart Surgeon" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input label="Phone" value={form.phone} onChange={update('phone')} error={errors.phone} />
          <Input label="Years Exp." type="number" value={form.experienceYears} onChange={update('experienceYears')} error={errors.experienceYears} />
          <Input label="Consult Fee (₹)" type="number" value={form.consultationFee} onChange={update('consultationFee')} error={errors.consultationFee} />
        </div>
        <p className="text-xs text-[var(--color-ink-faint)] mt-2">
          * A temporary password will be automatically generated and emailed to the doctor.
        </p>
      </form>
    </Modal>
  );
}