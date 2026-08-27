import { useState, useEffect } from 'react';
import { Plus, Trash2, Pill } from 'lucide-react';
import Drawer from '../../components/ui/Drawer.jsx';
import { Input, Select, Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { prescriptionsApi } from '../../api/prescriptions.js';
import { appointmentsApi } from '../../api/appointments.js';
import { doctorsApi } from '../../api/doctors.js';
import { useAuthStore } from '../../store/authStore.js';
import { toast } from '../../components/ui/Toast.jsx';
import { fullName } from '../../utils/format.js';
import { Spinner } from '../../components/ui/Table.jsx';

const emptyItem = { medicineName: '', dosage: '', frequency: '', durationDays: 1, instructions: '' };

export default function PrescriptionDrawer({ open, onClose, onSaved, prefilledPatient = null }) {
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
      
      if (prefilledPatient) {
        setForm(f => ({ ...f, patientId: prefilledPatient.patient_id }));
        setPatients([prefilledPatient]); // Seed dropdown with this single patient
      }

      doctorsApi.getById(user.id).then(async (docRes) => {
        const profileId = docRes.data?.doctor_profile?.doctor_profile_id;
        if (!profileId) throw new Error('Clinical profile missing');
        setForm(f => ({ ...f, doctorProfileId: profileId }));

        // Only fetch "My Patients" if we didn't open this from a specific Patient's Chart
        if (!prefilledPatient) {
          const appts = await appointmentsApi.list({ doctorId: profileId, limit: 100 });
          const uniquePatients = new Map();
          (appts.data || []).forEach(a => {
            if (a.patient) uniquePatients.set(a.patient_id, a.patient);
          });
          setPatients(Array.from(uniquePatients.values()));
        }
      })
      .catch(err => toast.error('Failed to load clinical context: ' + err.message))
      .finally(() => setLoadingDeps(false));
    } else {
      setForm({ patientId: '', doctorProfileId: '', diagnosis: '', instructions: '' });
      setItems([{ ...emptyItem }]);
      setErrors({});
    }
  }, [open, user, prefilledPatient]);

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
        items: items.map(i => ({ ...i, durationDays: Number(i.durationDays) }))
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
    <Drawer open={open} onClose={onClose} title="Issue Prescription" size="xl" footer={
      <>
        <Button variant="secondary" onClick={onClose}>Discard</Button>
        <Button onClick={handleSubmit} loading={saving} disabled={loadingDeps || items.length === 0 || !form.doctorProfileId}>Sign & Issue</Button>
      </>
    }>
      {loadingDeps ? (
        <Spinner label="Loading records..." />
      ) : (
        <form id="rx-form" onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-[var(--color-ink)] uppercase tracking-wider mb-1">Clinical Context</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Select label="Patient" required value={form.patientId} onChange={updateForm('patientId')} error={errors.patientId} disabled={!!prefilledPatient}>
                <option value="">Select a patient...</option>
                {patients.map((p) => (
                  <option key={p.patient_id} value={p.patient_id}>{fullName(p)}</option>
                ))}
              </Select>
              <Input label="Prescribing Doctor" disabled value={`Dr. ${user?.name}`} />
            </div>
            {patients.length === 0 && !prefilledPatient && (
              <p className="text-xs text-[var(--color-warning)] font-medium -mt-3">No prior patients found in your schedule. Only patients with prior appointments will appear here.</p>
            )}
            <Input label="Primary Diagnosis" required value={form.diagnosis} onChange={updateForm('diagnosis')} error={errors.diagnosis} placeholder="e.g., Acute Pharyngitis" />
          </div>

          <div>
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3 mb-4">
              <h4 className="text-sm font-semibold text-[var(--color-ink)] uppercase tracking-wider">Medication Regimen</h4>
              <Button size="sm" variant="secondary" icon={Plus} onClick={addItem}>Add Medicine</Button>
            </div>
            <div className="flex flex-col gap-4">
              {items.map((item, index) => (
                <div key={index} className="flex flex-col gap-4 bg-[var(--color-paper)] p-5 rounded-[var(--radius-md)] border border-[var(--color-border)]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
                      <Pill size={16} /> Medicine {index + 1}
                    </span>
                    <button type="button" onClick={() => removeItem(index)} className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] p-1.5 rounded transition-colors" disabled={items.length === 1}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <Input className="md:col-span-5" label="Medicine Name" required value={item.medicineName} onChange={(e) => updateItem(index, 'medicineName', e.target.value)} />
                    <Input className="md:col-span-3" label="Dosage" required value={item.dosage} onChange={(e) => updateItem(index, 'dosage', e.target.value)} />
                    <Input className="md:col-span-2" label="Frequency" required value={item.frequency} onChange={(e) => updateItem(index, 'frequency', e.target.value)} />
                    <Input className="md:col-span-2" label="Days" type="number" min="1" required value={item.durationDays} onChange={(e) => updateItem(index, 'durationDays', e.target.value)} />
                  </div>
                  <Input label="Specific Instructions (Optional)" value={item.instructions} onChange={(e) => updateItem(index, 'instructions', e.target.value)} />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-[var(--color-ink)] uppercase tracking-wider mb-1">General Advice</h4>
            <Textarea label="Follow-up & Instructions" value={form.instructions} onChange={updateForm('instructions')} error={errors.instructions} />
          </div>
        </form>
      )}
    </Drawer>
  );
}