import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { appointmentsApi } from '../../api/appointments.js';
import { patientsApi } from '../../api/patients.js';
import { doctorsApi } from '../../api/doctors.js';
import { toast } from '../../components/ui/Toast.jsx';
import { fullName } from '../../utils/format.js';
import { useAuthStore } from '../../store/authStore.js';
import { ROLES } from '../../utils/roles.js';
import { Spinner } from '../../components/ui/Table.jsx';

const empty = { patientId: '', doctorId: '', startTime: '', endTime: '', type: 'walk_in', notes: '' };

export default function AppointmentForm({ open, onClose, onSaved }) {
  const user = useAuthStore((s) => s.user);
  const isDoctor = user?.role === ROLES.DOCTOR;
  const isPatient = user?.role === ROLES.PATIENT;

  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingDeps, setLoadingDeps] = useState(false);
  
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);

  useEffect(() => {
    if (open) {
      setLoadingDeps(true);
      const fetches = [];
      
      if (!isPatient) fetches.push(patientsApi.list({ limit: 100 }));
      if (isDoctor) fetches.push(doctorsApi.getById(user.id));
      else fetches.push(doctorsApi.list());

      Promise.all(fetches)
        .then((results) => {
          if (!isPatient) {
            setPatients(results[0].data || []);
            if (isDoctor) {
               const profileId = results[1].data?.doctor_profile?.doctor_profile_id;
               if (profileId) setForm(f => ({ ...f, doctorId: profileId }));
            } else {
               setDoctors(Array.isArray(results[1]) ? results[1] : (results[1].data || []));
            }
          } else {
            // Patient workflow: results[0] is doctors list
            setDoctors(Array.isArray(results[0]) ? results[0] : (results[0].data || []));
          }
        })
        .catch(err => toast.error('Failed to load scheduling data: ' + err.message))
        .finally(() => setLoadingDeps(false));
    } else {
      setForm(empty);
      setErrors({});
    }
  }, [open, isDoctor, isPatient, user]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const payload = { ...form };
      if (isPatient) delete payload.patientId; // Let backend auto-resolve

      await appointmentsApi.create({
        ...payload,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
      });
      
      toast.success('Appointment booked successfully');
      setForm(empty);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to book appointment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Book Appointment" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} loading={saving} disabled={loadingDeps || (!form.doctorId && isDoctor)}>Confirm Booking</Button>
      </>
    }>
      {loadingDeps ? (
        <Spinner label="Loading schedule..." />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Patients do not select themselves */}
          {!isPatient && (
            <Select label="Patient" required value={form.patientId} onChange={update('patientId')}>
              <option value="">Select patient...</option>
              {patients.map((p) => (
                <option key={p.patient_id} value={p.patient_id}>{fullName(p)}</option>
              ))}
            </Select>
          )}

          {isDoctor ? (
            <Input label="Attending Doctor" disabled value={`Dr. ${user.name}`} />
          ) : (
            <Select label="Select Doctor" required value={form.doctorId} onChange={update('doctorId')}>
              <option value="">Choose a specialist...</option>
              {doctors.map((doc) => {
                const profileId = doc.doctor_profile?.doctor_profile_id;
                if (!profileId) return null;
                const dept = doc.doctor_profile?.department_label || doc.department || '';
                return <option key={profileId} value={profileId}>{doc.doctor_profile?.designation || 'Dr.'} {doc.name} {dept ? `- ${dept}` : ''}</option>;
              })}
            </Select>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input label="Start time" type="datetime-local" required value={form.startTime} onChange={update('startTime')} />
            <Input label="End time" type="datetime-local" required value={form.endTime} onChange={update('endTime')} />
          </div>
          
          <Select label="Consultation Type" required value={form.type} onChange={update('type')}>
            <option value="walk_in">In-Person Visit</option>
            <option value="online">Online / Telemedicine</option>
          </Select>
          <Textarea label="Notes / Reason for visit" value={form.notes} onChange={update('notes')} />
        </form>
      )}
    </Modal>
  );
}