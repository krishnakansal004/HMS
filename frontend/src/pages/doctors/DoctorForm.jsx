import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { doctorsApi } from '../../api/doctors.js';
import { toast } from '../../components/ui/Toast.jsx';

const initialForm = {
  name: '', email: '', phone: '', specialization: '', 
  department: '', experienceYears: '', consultationFee: ''
};

export default function DoctorForm({ open, onClose, onSaved, doctor }) {
  const isEdit = !!doctor;
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && doctor) {
      const profile = doctor.doctor_profile || {};
      setForm({
        name: doctor.name || '',
        email: doctor.email || '',
        phone: doctor.phone || '', 
        specialization: profile.specialization || '',
        department: profile.department_label || '',
        experienceYears: profile.experience_years ?? '',
        consultationFee: profile.consultation_fee ?? ''
      });
    } else {
      setForm(initialForm);
    }
    setErrors({});
  }, [doctor, isEdit, open]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const payload = {
        ...form,
        experienceYears: Number(form.experienceYears) || 0,
        consultationFee: Number(form.consultationFee) || 0
      };

      if (isEdit) {
        await doctorsApi.update(doctor.user_id, payload);
        toast.success('Doctor profile updated successfully');
      } else {
        await doctorsApi.create(payload);
        toast.success('Doctor registered and credentials emailed');
      }
      
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to save doctor');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Doctor Profile' : 'Register New Doctor'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>{isEdit ? 'Save Changes' : 'Register Doctor'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Full Name" required value={form.name} onChange={update('name')} error={errors.name} />
          <Input label="Email" type="email" required value={form.email} onChange={update('email')} error={errors.email} disabled={isEdit} hint={isEdit ? "Email cannot be changed after registration" : ""} />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <Input label="Department" required value={form.department} onChange={update('department')} error={errors.department} />
          <Input label="Specialization" required value={form.specialization} onChange={update('specialization')} error={errors.specialization} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Years Exp." type="number" value={form.experienceYears} onChange={update('experienceYears')} error={errors.experienceYears} />
          <Input label="Consult Fee (₹)" type="number" value={form.consultationFee} onChange={update('consultationFee')} error={errors.consultationFee} />
        </div>
        {!isEdit && (
          <p className="text-xs text-[var(--color-ink-faint)] mt-2">
            * A temporary password will be automatically generated and emailed to the doctor.
          </p>
        )}
      </form>
    </Modal>
  );
}