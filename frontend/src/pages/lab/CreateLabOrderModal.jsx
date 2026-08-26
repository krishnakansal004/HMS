import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { labApi } from '../../api/lab.js';
import { patientsApi } from '../../api/patients.js';
import { doctorsApi } from '../../api/doctors.js';
import { toast } from '../../components/ui/Toast.jsx';
import { fullName, formatPaise } from '../../utils/format.js';
import { Spinner } from '../../components/ui/Table.jsx';

export default function CreateLabOrderModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ patientId: '', testId: '', doctorProfileId: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingDeps, setLoadingDeps] = useState(false);

  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    if (open) {
      setLoadingDeps(true);
      Promise.all([
        patientsApi.list({ limit: 100 }),
        doctorsApi.list(),
        labApi.getCatalog()
      ])
      .then(([patientsRes, doctorsRes, catalogRes]) => {
        setPatients(patientsRes.data || []);
        setDoctors(Array.isArray(doctorsRes) ? doctorsRes : (doctorsRes.data || []));
        setCatalog(catalogRes.data || []);
      })
      .catch(() => toast.error('Failed to load clinical dependencies'))
      .finally(() => setLoadingDeps(false));
    } else {
      setForm({ patientId: '', testId: '', doctorProfileId: '' });
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
      if (!payload.doctorProfileId) delete payload.doctorProfileId;

      await labApi.createOrder(payload);
      toast.success('Lab test ordered successfully!');
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to order lab test');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Order Lab Test"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={loadingDeps || catalog.length === 0}>Create Order</Button>
        </>
      }
    >
      {loadingDeps ? (
        <Spinner label="Loading clinical data..." />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Select label="Patient" required value={form.patientId} onChange={update('patientId')} error={errors.patientId}>
            <option value="">Select a patient...</option>
            {patients.map(p => (
              <option key={p.patient_id} value={p.patient_id}>{fullName(p)}</option>
            ))}
          </Select>

          <Select label="Lab Test" required value={form.testId} onChange={update('testId')} error={errors.testId}>
            <option value="">Select a test from the catalog...</option>
            {catalog.map(t => (
              <option key={t.test_id} value={t.test_id}>
                {t.name} ({t.code}) - {formatPaise(t.price)}
              </option>
            ))}
          </Select>

          <Select label="Referring Doctor (Optional)" value={form.doctorProfileId} onChange={update('doctorProfileId')} error={errors.doctorProfileId}>
            <option value="">None / External</option>
            {doctors.map((doc) => {
              const profileId = doc.doctor_profile?.doctor_profile_id;
              if (!profileId) return null;
              return <option key={profileId} value={profileId}>Dr. {doc.name}</option>;
            })}
          </Select>

          {catalog.length === 0 && (
            <p className="text-xs text-[var(--color-danger)] font-medium mt-1">
              No lab tests are configured in the catalog. Please ask your Admin to add tests first.
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}