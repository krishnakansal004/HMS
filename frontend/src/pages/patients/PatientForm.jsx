import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { patientsApi } from '../../api/patients.js';
import { toast } from '../../components/ui/Toast.jsx';

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dob: '',
  gender: 'MALE',
  bloodGroup: '',
  address: ''
};

export default function PatientForm({ open, onClose, onSaved, patient }) {
  // 1. Detect if we are in Edit Mode based on whether a patient object was passed
  const isEdit = !!patient;
  
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // 2. Populate the form when the modal opens in Edit Mode
  useEffect(() => {
    if (isEdit && patient) {
      setForm({
        firstName: patient.first_name || '',
        lastName: patient.last_name || '',
        email: patient.email || '',
        phone: patient.phone || '',
        // Extract just the YYYY-MM-DD part for the date input
        dob: patient.date_of_birth ? new Date(patient.date_of_birth).toISOString().split('T')[0] : '',
        gender: patient.gender || 'MALE',
        bloodGroup: patient.blood_group || '',
        address: patient.address || ''
      });
    } else {
      setForm(initialForm);
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
        // 3. Call the Update API if editing
        await patientsApi.update(patient.patient_id, {
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          bloodGroup: form.bloodGroup,
          address: form.address
        });
        toast.success('Patient updated successfully');
      } else {
        // 4. Call the Register API if creating
        await patientsApi.register(form);
        toast.success('Patient registered successfully');
      }
      
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to save patient');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Patient' : 'Register New Patient'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save Changes' : 'Register Patient'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="First name" required value={form.firstName} onChange={update('firstName')} error={errors.firstName} />
          <Input label="Last name" value={form.lastName} onChange={update('lastName')} error={errors.lastName} />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="Email" 
            type="email" 
            disabled={isEdit} 
            hint={isEdit ? "Email cannot be changed" : ""} 
            value={form.email} 
            onChange={update('email')} 
            error={errors.email} 
          />
          <Input label="Phone" required value={form.phone} onChange={update('phone')} error={errors.phone} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input 
            label="Date of birth" 
            type="date" 
            required 
            disabled={isEdit} 
            hint={isEdit ? "DOB cannot be changed" : ""} 
            value={form.dob} 
            onChange={update('dob')} 
            error={errors.dob} 
          />
          <Select 
            label="Gender" 
            required 
            disabled={isEdit} 
            value={form.gender} 
            onChange={update('gender')} 
            error={errors.gender}
          >
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Blood group" value={form.bloodGroup} onChange={update('bloodGroup')} error={errors.bloodGroup} placeholder="e.g. O+" />
          <Input label="Address" value={form.address} onChange={update('address')} error={errors.address} />
        </div>
      </form>
    </Modal>
  );
}