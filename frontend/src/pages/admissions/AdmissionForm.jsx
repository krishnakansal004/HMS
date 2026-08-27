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
import { useAuthStore } from '../../store/authStore.js';
import { ROLES } from '../../utils/roles.js';

export default function AdmissionForm({ open, onClose, onSaved }) {
  const user = useAuthStore((s) => s.user);
  const isDoctor = user?.role === ROLES.DOCTOR;

  const [form, setForm] = useState({ patientId: '', bedId: '', admittingDoctorId: '', diagnosis: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingDeps, setLoadingDeps] = useState(false);

  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [wards, setWards] = useState([]);

  useEffect(() => {
    if (open) {
      setLoadingDeps(true);
      
      const fetches = [patientsApi.list({ limit: 100 }), wardsApi.list()];
      if (isDoctor) {
        fetches.push(doctorsApi.getById(user.id));
      } else {
        fetches.push(doctorsApi.list());
      }

      Promise.all(fetches)
      .then(([patientsRes, wardsRes, doctorsRes]) => {
        setPatients(patientsRes.data || []);
        setWards(wardsRes.data || []);

        if (isDoctor) {
          const profileId = doctorsRes.data?.doctor_profile?.doctor_profile_id;
          if (profileId) {
            setForm(f => ({ ...f, admittingDoctorId: profileId }));
          }
        } else {
          setDoctors(Array.isArray(doctorsRes) ? doctorsRes : (doctorsRes.data || []));
        }
      })
      .catch((err) => toast.error('Failed to load admission dependencies: ' + err.message))
      .finally(() => setLoadingDeps(false));
    } else {
      setForm({ patientId: '', bedId: '', admittingDoctorId: '', diagnosis: '' });
      setErrors({});
    }
  }, [open, isDoctor, user]);

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

          {/* Doctor vs Admin UI handling */}
          {isDoctor ? (
             <Input label="Admitting Doctor" disabled value={`Dr. ${user.name}`} />
          ) : (
            <Select label="Admitting Doctor" required value={form.admittingDoctorId} onChange={update('admittingDoctorId')} error={errors.admittingDoctorId}>
              <option value="">Select doctor...</option>
              {doctors.map((doc) => {
                const profileId = doc.doctor_profile?.doctor_profile_id;
                if (!profileId) return null;
                return (
                  <option key={profileId} value={profileId}>
                    {doc.doctor_profile?.designation || 'Dr.'} {doc.name}
                  </option>
                );
              })}
            </Select>
          )}

          <Select label="Assign Bed (Optional - Ops Team can assign later)" value={form.bedId} onChange={update('bedId')} error={errors.bedId}>
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

          <Textarea 
            label="Initial Diagnosis / Reason for Admission" 
            required
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