import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { prescriptionsApi } from '../../api/prescriptions.js';
import { patientsApi } from '../../api/patients.js';
import { doctorsApi } from '../../api/doctors.js';
import { useAuthStore } from '../../store/authStore.js';
import { toast } from '../../components/ui/Toast.jsx';
import { fullName } from '../../utils/format.js';
import { Spinner } from '../../components/ui/Table.jsx';

const emptyItem = { medicineName: '', dosage: '', frequency: '', durationDays: 1, instructions: '' };

export default function CreatePrescriptionModal({ open, onClose, onSaved }) {
  const user = useAuthStore((s) => s.user);
  
  const [form, setForm] = useState({ patientId: '', doctorProfileId: '', diagnosis: '', instructions: '' });
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  
  const [patients, setPatients] = useState([]);
  const [loadingDeps, setLoadingDeps] = useState(false);

  useEffect(() => {
    if (open && user?.id) {
      setLoadingDeps(true);
      
      // Fetch patients AND the logged-in doctor's specific clinical profile
      Promise.all([
        patientsApi.list({ limit: 100 }),
        doctorsApi.getById(user.id)
      ])
        .then(([patientsRes, doctorRes]) => {
          setPatients(patientsRes.data || []);
          
          // Securely bind this prescription to the logged-in doctor's profile ID
          const profileId = doctorRes.data?.doctor_profile?.doctor_profile_id;
          if (profileId) {
            setForm(f => ({ ...f, doctorProfileId: profileId }));
          } else {
            toast.error('Critical: Clinical profile missing for this account.');
          }
        })
        .catch(() => toast.error('Failed to load clinical dependencies'))
        .finally(() => setLoadingDeps(false));
    } else {
      setForm({ patientId: '', doctorProfileId: '', diagnosis: '', instructions: '' });
      setItems([{ ...emptyItem }]);
      setErrors({});
    }
  }, [open, user]);

  function updateForm(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  const addItem = () => setItems([...items, { ...emptyItem }]);
  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.patientId || !form.doctorProfileId || items.length === 0) return;

    setSaving(true);
    setErrors({});
    try {
      await prescriptionsApi.create({
        ...form,
        items: items.map(i => ({
          ...i,
          durationDays: Number(i.durationDays) // Strict integer conversion
        }))
      });
      toast.success('Prescription issued successfully.');
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to issue prescription');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Issue Prescription"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={loadingDeps || items.length === 0 || !form.doctorProfileId}>Sign & Issue</Button>
        </>
      }
    >
      {loadingDeps ? (
        <Spinner label="Loading records..." />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Patient" required value={form.patientId} onChange={updateForm('patientId')} error={errors.patientId}>
              <option value="">Select a patient...</option>
              {patients.map((p) => (
                <option key={p.patient_id} value={p.patient_id}>{fullName(p)}</option>
              ))}
            </Select>

            {/* Read-only verification of the prescribing authority */}
            <Input label="Prescribing Doctor" disabled value={`Dr. ${user?.name}`} />
          </div>

          <Input label="Clinical Diagnosis" required value={form.diagnosis} onChange={updateForm('diagnosis')} error={errors.diagnosis} placeholder="Primary condition being treated" />
          
          <div>
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 mb-3 mt-2">
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">Medication Regimen</h3>
              <Button size="sm" variant="secondary" icon={Plus} onClick={addItem}>Add Medicine</Button>
            </div>
            
            <div className="flex flex-col gap-3">
              {items.map((item, index) => (
                <div key={index} className="flex flex-col md:flex-row items-start gap-3 bg-[var(--color-paper)] p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-1">
                    <Input className="col-span-2" placeholder="Medicine Name" required value={item.medicineName} onChange={(e) => updateItem(index, 'medicineName', e.target.value)} />
                    <Input placeholder="Dosage (e.g. 500mg)" required value={item.dosage} onChange={(e) => updateItem(index, 'dosage', e.target.value)} />
                    <Input placeholder="Freq (e.g. 1-0-1)" required value={item.frequency} onChange={(e) => updateItem(index, 'frequency', e.target.value)} />
                    <Input type="number" min="1" placeholder="Days" required value={item.durationDays} onChange={(e) => updateItem(index, 'durationDays', e.target.value)} />
                  </div>
                  <button type="button" onClick={() => removeItem(index)} className="p-2 mt-1 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] rounded-md transition-colors" disabled={items.length === 1}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <Textarea label="General Instructions / Advice" value={form.instructions} onChange={updateForm('instructions')} error={errors.instructions} placeholder="Dietary restrictions, follow-up timelines..." />
        </form>
      )}
    </Modal>
  );
}