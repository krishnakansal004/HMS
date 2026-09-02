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
import { useAuthStore } from '../../store/authStore.js';
import { ROLES } from '../../utils/roles.js';

const empty = { patientId: '', bedId: '', admittingDoctorId: '', diagnosis: '' };

export default function AdmissionForm({ open, onClose, onSaved }) {
  const role = useAuthStore((s) => s.user?.role);
  const isDoctor = role === ROLES.DOCTOR;
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [wards, setWards] = useState([]);

  useEffect(() => {
    if (open) {
      patientsApi.list({ limit: 100 })
        .then((res) => setPatients(res.data || []))
        .catch(() => setPatients([]));

      if (!isDoctor) {
        doctorsApi.list()
          .then((res) => setDoctors(Array.isArray(res) ? res : res.data || []))
          .catch(() => setDoctors([]));
      }

      wardsApi.list()
        .then((res) => setWards(res.data || []))
        .catch(() => setWards([]));
    } else {
      setForm(empty);
      setErrors({});
    }
  }, [open, isDoctor]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      await admissionsApi.create({
        patientId: form.patientId,
        bedId: form.bedId || undefined,
        admittingDoctorId: form.admittingDoctorId || undefined,
        diagnosis: form.diagnosis || undefined,
      });

      toast.success('Patient admitted successfully');
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
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Admit Patient</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select label="Patient" required value={form.patientId} onChange={update('patientId')} error={errors.patientId}>
          <option value="">Select patient...</option>
          {patients.map((p) => (
            <option key={p.patient_id} value={p.patient_id}>
              {fullName(p)} {p.phone ? `(${p.phone})` : ''}
            </option>
          ))}
        </Select>

        <Select label="Bed (optional)" value={form.bedId} onChange={update('bedId')} error={errors.bedId} hint="Leave unassigned to admit without a bed">
          <option value="">No bed assigned</option>
          {wards.map((ward) => (
            <optgroup key={ward.ward_id} label={ward.name}>
              {(ward.bed || [])
                .filter((b) => !b.is_occupied)
                .map((b) => (
                  <option key={b.bed_id} value={b.bed_id}>
                    Bed {b.bed_number}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>

        {!isDoctor && (
          <Select label="Admitting Doctor (optional)" value={form.admittingDoctorId} onChange={update('admittingDoctorId')} error={errors.admittingDoctorId}>
            <option value="">Select doctor...</option>
            {doctors.map((doc) => {
              const profile = doc.doctor_profile || {};
              const profileId = profile.doctor_profile_id;
              if (!profileId) return null;
              const dept = profile.department_label || doc.department || '';
              return (
                <option key={profileId} value={profileId}>
                  {profile.designation || 'Dr.'} {doc.name} {dept ? `- ${dept}` : ''}
                </option>
              );
            })}
          </Select>
        )}

        <Textarea
          label="Diagnosis / Reason for admission"
          value={form.diagnosis}
          onChange={update('diagnosis')}
          error={errors.diagnosis}
          placeholder="e.g. Acute appendicitis, scheduled for surgery"
        />
      </form>
    </Modal>
  );
}
