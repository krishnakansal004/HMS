import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { appointmentsApi } from '../../api/appointments.js';
import { patientsApi } from '../../api/patients.js';
import { doctorsApi } from '../../api/doctors.js';
import { toast } from '../../components/ui/Toast.jsx';
import { fullName } from '../../utils/format.js';

const empty = { patientId: '', doctorId: '', startTime: '', endTime: '', type: 'walk_in', notes: '' };

export default function AppointmentForm({ open, onClose, onSaved }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);

  useEffect(() => {
    if (open) {
      // Fetch patients
      patientsApi.list({ limit: 100 })
        .then(res => setPatients(res.data || []))
        .catch(() => setPatients([]));

      // Fetch doctors and handle response envelopes
      doctorsApi.list()
        .then(res => {
          const list = Array.isArray(res) ? res : (res.data || []);
          setDoctors(list);
        })
        .catch(() => setDoctors([]));
    } else {
      setForm(empty);
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
      await appointmentsApi.create({
        ...form,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
      });
      
      toast.success('Appointment booked successfully');
      setForm(empty);
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to book appointment');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Book Appointment"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Book Appointment</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Patient Dropdown */}
        <Select label="Patient" required value={form.patientId} onChange={update('patientId')} error={errors.patientId}>
          <option value="">Select patient...</option>
          {patients.map((p) => (
            <option key={p.patient_id} value={p.patient_id}>
              {fullName(p) || p.first_name} {p.phone ? `(${p.phone})` : ''}
            </option>
          ))}
        </Select>

        {/* Doctor Dropdown - Maps strictly to Prisma's doctor_profile_id */}
        <Select label="Doctor" required value={form.doctorId} onChange={update('doctorId')} error={errors.doctorId}>
          <option value="">Select doctor...</option>
          {doctors.map((doc) => {
            const profile = doc.doctor_profile || {};
            const profileId = profile.doctor_profile_id; // <--- The exact PK required by Prisma
            if (!profileId) return null; // Skip if profile isn't loaded
            
            const dept = profile.department_label || doc.department || '';
            return (
              <option key={profileId} value={profileId}>
                {profile.designation || 'Dr.'} {doc.name} {dept ? `- ${dept}` : ''}
              </option>
            );
          })}
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Start time" type="datetime-local" required value={form.startTime} onChange={update('startTime')} error={errors.startTime} />
          <Input label="End time" type="datetime-local" required value={form.endTime} onChange={update('endTime')} error={errors.endTime} />
        </div>

        <Select label="Consultation Type" required value={form.type} onChange={update('type')} error={errors.type}>
          <option value="walk_in">Walk-in</option>
          <option value="online">Online / Telemedicine</option>
        </Select>

        <Textarea label="Notes" value={form.notes} onChange={update('notes')} error={errors.notes} />
      </form>
    </Modal>
  );
}