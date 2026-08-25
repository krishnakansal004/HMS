import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { admissionsApi } from '../../api/admissions.js';
import { patientsApi } from '../../api/patients.js';
import { doctorsApi } from '../../api/doctors.js';
import { wardsApi } from '../../api/wards.js';
import { toast } from '../../components/ui/Toast.jsx';
import { fullName } from '../../utils/format.js';
import { Spinner } from '../../components/ui/Table.jsx';

export default function AdmissionForm({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ patientId: '', bedId: '', admittingDoctorId: '', diagnosis: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingDeps, setLoadingDeps] = useState(false);

  // Relational Dependencies
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [wards, setWards] = useState([]);

  useEffect(() => {
    if (open) {
      setLoadingDeps(true);
      Promise.all([
        patientsApi.list({ limit: 100 }),
        doctorsApi.list(),
        wardsApi.list()
      ])
      .then(([patientsRes, doctorsRes, wardsRes]) => {
        setPatients(patientsRes.data || []);
        setDoctors(Array.isArray(doctorsRes) ? doctorsRes : (doctorsRes.data || []));
        setWards(wardsRes.data || []);
      })
      .catch(() => toast.error('Failed to load form dependencies'))
      .finally(() => setLoadingDeps(false));
    } else {
      setForm({ patientId: '', bedId: '', admittingDoctorId: '', diagnosis: '' });
      setErrors({});
    }
  }, [open]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      const payload = { ...form };
      if (!payload.bedId) delete payload.bedId;
      if (!payload.admittingDoctorId) delete payload.admittingDoctorId;

      await admissionsApi.create(payload);
      toast.success('Patient admitted successfully!');
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to admit patient');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Admit Patient"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={loadingDeps}>Confirm Admission</Button>
        </>
      }
    >
      {loadingDeps ? (
        <Spinner label="Loading clinical data..." />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Select label="Select Patient" required value={form.patientId} onChange={update('patientId')} error={errors.patientId}>
            <option value="">Choose a patient...</option>
            {patients.map((p) => (
              <option key={p.patient_id} value={p.patient_id}>
                {fullName(p)} {p.phone ? `(${p.phone})` : ''}
              </option>
            ))}
          </Select>

          <Select label="Assign Bed (Optional)" value={form.bedId} onChange={update('bedId')} error={errors.bedId}>
            <option value="">No bed assigned yet</option>
            {wards.map((w) => {
              const availableBeds = (w.bed || []).filter(b => !b.is_occupied);
              if (availableBeds.length === 0) return null;
              return (
                <optgroup key={w.ward_id} label={`${w.name} (${w.type})`}>
                  {availableBeds.map(b => (
                    <option key={b.bed_id} value={b.bed_id}>
                      Bed {b.bed_number} - ₹{(b.price_per_day / 100).toFixed(2)}/day
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </Select>

          <Select label="Admitting Doctor (Optional)" value={form.admittingDoctorId} onChange={update('admittingDoctorId')} error={errors.admittingDoctorId}>
            <option value="">Select doctor...</option>
            {doctors.map((doc) => {
              const profile = doc.doctor_profile || {};
              const profileId = profile.doctor_profile_id; // The exact PK required by Prisma
              
              if (!profileId) return null; // Skip if clinical profile isn't fully loaded

              return (
                <option key={profileId} value={profileId}>
                  {profile.designation || 'Dr.'} {doc.name} {profile.department_label ? `- ${profile.department_label}` : ''}
                </option>
              );
            })}
          </Select>

          <Textarea 
            label="Initial Diagnosis / Reason for Admission" 
            value={form.diagnosis} 
            onChange={update('diagnosis')} 
            error={errors.diagnosis} 
            placeholder="Describe the clinical reason for this inpatient admission..."
          />
        </form>
      )}
    </Modal>
  );
}