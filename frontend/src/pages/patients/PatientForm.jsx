import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { patientsApi } from '../../api/patients.js';
import { toast } from '../../components/ui/Toast.jsx';

const emptyCreate = {
  firstName: '', lastName: '', email: '', phone: '', dob: '', gender: 'MALE', bloodGroup: '',
  address: '', emergencyContact: '', allergies: '', medicalHistory: '',
};

// emergencyContact/allergies/medicalHistory are now backed by real columns
// (migration 0041) — safe on both create and edit. Previously omitted
// here because they'd 500 on edit and silently vanish on create; see
// README "Fixed backend gaps".
const editableFields = ['firstName', 'lastName', 'phone', 'address', 'bloodGroup', 'emergencyContact', 'allergies', 'medicalHistory'];

export default function PatientForm({ open, onClose, onSaved, patient }) {
  const isEdit = !!patient;
  const [form, setForm] = useState(emptyCreate);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && patient) {
      setForm({
        firstName: patient.first_name || '',
        lastName: patient.last_name || '',
        phone: patient.phone || '',
        address: patient.address || '',
        bloodGroup: patient.blood_group || '',
        emergencyContact: patient.emergency_contact || '',
        allergies: patient.allergies || '',
        medicalHistory: patient.medical_history || '',
      });
    } else {
      setForm(emptyCreate);
    }
    setErrors({});
  }, [patient, isEdit, open]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      if (isEdit) {
        const payload = {};
        editableFields.forEach((f) => {
          if (form[f] !== undefined) payload[f] = form[f];
        });
        await patientsApi.update(patient.patient_id, payload);
        toast.success('Patient updated');
      } else {
        await patientsApi.register(form);
        toast.success('Patient registered');
      }
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
      title={isEdit ? 'Edit patient' : 'Register new patient'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>{isEdit ? 'Save changes' : 'Register patient'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="First name" required value={form.firstName} onChange={update('firstName')} error={errors.firstName} />
          <Input label="Last name" value={form.lastName} onChange={update('lastName')} error={errors.lastName} />
        </div>
        {!isEdit && (
          <>
            <Input label="Email" type="email" value={form.email} onChange={update('email')} error={errors.email} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Date of birth" type="date" required value={form.dob} onChange={update('dob')} error={errors.dob} />
              <Select label="Gender" required value={form.gender} onChange={update('gender')} error={errors.gender}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
          </>
        )}
        <Input label="Phone" required value={form.phone} onChange={update('phone')} error={errors.phone} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Blood group" value={form.bloodGroup} onChange={update('bloodGroup')} error={errors.bloodGroup} placeholder="e.g. O+" />
          <Input label="Address" value={form.address} onChange={update('address')} error={errors.address} />
        </div>
        <Input label="Emergency contact" value={form.emergencyContact} onChange={update('emergencyContact')} error={errors.emergencyContact} placeholder="Name and phone number" />
        <Textarea label="Allergies" value={form.allergies} onChange={update('allergies')} error={errors.allergies} placeholder="e.g. Penicillin, peanuts — leave blank if none known" />
        <Textarea label="Medical history" value={form.medicalHistory} onChange={update('medicalHistory')} error={errors.medicalHistory} placeholder="Relevant past conditions, surgeries, ongoing medication" />
      </form>
    </Modal>
  );
}
