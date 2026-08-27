import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { radiologyApi, RADIOLOGY_URGENCY } from '../../api/radiology.js';
import { patientsApi } from '../../api/patients.js';
import { doctorsApi } from '../../api/doctors.js';
import { useAuthStore } from '../../store/authStore.js';
import { ROLES } from '../../utils/roles.js';
import { toast } from '../../components/ui/Toast.jsx';
import { fullName } from '../../utils/format.js';
import { Spinner } from '../../components/ui/Table.jsx';

const MODALITIES = ['X-RAY', 'MRI', 'CT', 'ULTRASOUND', 'ECG', 'PET', 'FLUOROSCOPY'];

export default function OrderRadiologyModal({ open, onClose, onSaved }) {
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState({ patientId: '', doctorProfileId: '', modality: 'X-RAY', studyType: '', bodyPart: '', urgency: 'routine', price: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingDeps, setLoadingDeps] = useState(false);

  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);

  useEffect(() => {
    if (open) {
      setLoadingDeps(true);
      const fetches = [patientsApi.list({ limit: 100 })];
      
      if (user?.role === ROLES.DOCTOR) {
        fetches.push(doctorsApi.getById(user.id));
      } else {
        fetches.push(doctorsApi.list());
      }

      Promise.all(fetches)
        .then(([patientsRes, doctorsRes]) => {
          setPatients(patientsRes.data || []);
          
          if (user?.role === ROLES.DOCTOR) {
            const profileId = doctorsRes.data?.doctor_profile?.doctor_profile_id;
            if (profileId) setForm(f => ({ ...f, doctorProfileId: profileId }));
          } else {
            setDoctors(Array.isArray(doctorsRes) ? doctorsRes : (doctorsRes.data || []));
          }
        })
        .catch(() => toast.error('Failed to load clinical dependencies'))
        .finally(() => setLoadingDeps(false));
    } else {
      setForm({ patientId: '', doctorProfileId: '', modality: 'X-RAY', studyType: '', bodyPart: '', urgency: 'routine', price: '', notes: '' });
      setErrors({});
    }
  }, [open, user]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      await radiologyApi.createOrder({
        ...form,
        price: Number(form.price) // Backend service converts to paise automatically
      });
      toast.success('Radiology study ordered successfully.');
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to order study');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Order Radiology Study"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={loadingDeps || (!form.doctorProfileId && user?.role === ROLES.DOCTOR)}>
            Submit Order
          </Button>
        </>
      }
    >
      {loadingDeps ? (
        <Spinner label="Loading records..." />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Patient" required value={form.patientId} onChange={update('patientId')} error={errors.patientId}>
              <option value="">Select a patient...</option>
              {patients.map((p) => (
                <option key={p.patient_id} value={p.patient_id}>{fullName(p)}</option>
              ))}
            </Select>

            {user?.role === ROLES.DOCTOR ? (
               <Input label="Ordering Doctor" disabled value={`Dr. ${user.name}`} />
            ) : (
              <Select label="Ordering Doctor" required value={form.doctorProfileId} onChange={update('doctorProfileId')} error={errors.doctorProfileId}>
                <option value="">Select a doctor...</option>
                {doctors.map((doc) => {
                  const pId = doc.doctor_profile?.doctor_profile_id;
                  if (!pId) return null;
                  return <option key={pId} value={pId}>Dr. {doc.name}</option>;
                })}
              </Select>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select label="Modality" required value={form.modality} onChange={update('modality')} error={errors.modality}>
              {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
            <Input className="md:col-span-2" label="Study Type" required value={form.studyType} onChange={update('studyType')} error={errors.studyType} placeholder="e.g. Chest AP/PA, Brain w/ Contrast" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Body Part" value={form.bodyPart} onChange={update('bodyPart')} error={errors.bodyPart} placeholder="e.g. Chest, Skull, Pelvis" />
            <Select label="Urgency" required value={form.urgency} onChange={update('urgency')} error={errors.urgency}>
              {RADIOLOGY_URGENCY.map(u => <option key={u} value={u} className="capitalize">{u}</option>)}
            </Select>
            <Input label="Price (₹)" type="number" step="0.01" min="0" required value={form.price} onChange={update('price')} error={errors.price} />
          </div>

          <Textarea label="Clinical Notes / Indications" value={form.notes} onChange={update('notes')} error={errors.notes} placeholder="Reason for scan, suspected conditions..." />
        </form>
      )}
    </Modal>
  );
}