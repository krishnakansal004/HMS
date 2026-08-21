import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { patientsApi } from '../../api/patients.js';
import { toast } from '../../components/ui/Toast.jsx';

// Initial state matching our strict validators
const emptyCreate = {
  firstName: '', lastName: '', email: '', phone: '', dob: '', gender: 'MALE', bloodGroup: '',
  address: '', emergencyContact: '', allergies: '', medicalHistory: '', abhaId: '', abhaAddress: ''
};

const editableFields = [
  'firstName', 'lastName', 'phone', 'address', 'bloodGroup', 
  'emergencyContact', 'allergies', 'medicalHistory', 'abhaId', 'abhaAddress'
];

export default function PatientForm({ open, onClose, onSaved, patient }) {
  const isEdit = !!patient;
  const [form, setForm] = useState(emptyCreate);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Populate form if we are editing an existing patient
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
        abhaId: patient.abha_id || '',
        abhaAddress: patient.abha_address || ''
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
        // Only send editable fields to the update endpoint
        const payload = {};
        editableFields.forEach((f) => {
          if (form[f] !== undefined) payload[f] = form[f];
        });
        await patientsApi.update(patient.patient_id, payload);
        toast.success('Patient profile updated successfully');
      } else {
        // Send full payload to register endpoint
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
      title={isEdit ? 'Edit Patient Profile' : 'Register New Patient'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>{isEdit ? 'Save Changes' : 'Register Patient'}</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        
        {/* SECTION 1: Demographics */}
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-3 pb-1 border-b border-[var(--color-border)]">Demographics</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="First name" required value={form.firstName} onChange={update('firstName')} error={errors.firstName} />
            <Input label="Last name" value={form.lastName} onChange={update('lastName')} error={errors.lastName} />
          </div>
          
          {/* Email, DOB, and Gender are usually locked after creation, so we hide them in Edit mode */}
          {!isEdit && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Input label="Email" type="email" value={form.email} onChange={update('email')} error={errors.email} />
                <Input label="Date of birth" type="date" required value={form.dob} onChange={update('dob')} error={errors.dob} />
              </div>
              <div className="mb-4">
                <Select label="Gender" required value={form.gender} onChange={update('gender')} error={errors.gender}>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="Phone" required value={form.phone} onChange={update('phone')} error={errors.phone} />
            <Input label="Blood group" value={form.bloodGroup} onChange={update('bloodGroup')} error={errors.bloodGroup} placeholder="e.g. O+" />
          </div>
          <Input label="Address" value={form.address} onChange={update('address')} error={errors.address} />
        </div>

        {/* SECTION 2: ABDM Integration */}
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-3 pb-1 border-b border-[var(--color-border)]">Digital Health (ABDM)</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="ABHA Number" 
              value={form.abhaId} 
              onChange={update('abhaId')} 
              error={errors.abhaId} 
              placeholder="14-digit ABHA ID" 
              hint="Optional. Used for ABDM sync."
            />
            <Input 
              label="ABHA Address" 
              value={form.abhaAddress} 
              onChange={update('abhaAddress')} 
              error={errors.abhaAddress} 
              placeholder="username@abdm" 
            />
          </div>
        </div>

        {/* SECTION 3: Clinical Data */}
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-3 pb-1 border-b border-[var(--color-border)]">Clinical & Emergency</h3>
          <div className="flex flex-col gap-4">
            <Input label="Emergency contact" value={form.emergencyContact} onChange={update('emergencyContact')} error={errors.emergencyContact} placeholder="Name and phone number" />
            <Textarea label="Allergies" value={form.allergies} onChange={update('allergies')} error={errors.allergies} placeholder="e.g. Penicillin, peanuts - leave blank if none known" />
            <Textarea label="Medical history" value={form.medicalHistory} onChange={update('medicalHistory')} error={errors.medicalHistory} placeholder="Relevant past conditions, surgeries, ongoing medication" />
          </div>
        </div>

      </form>
    </Modal>
  );
}