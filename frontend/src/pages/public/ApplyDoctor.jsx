import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Stethoscope, CheckCircle2 } from 'lucide-react';
import { doctorApplicationsApi } from '../../api/doctorApplications.js';
import { Input, Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { toast } from '../../components/ui/Toast.jsx';

const initialForm = {
  name: '', email: '', phone: '', specialization: '', 
  department: '', education: '', yearsExperience: '', message: ''
};

export default function ApplyDoctor() {
  const { hospitalSlug } = useParams(); // Automatically pulled from the URL
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await doctorApplicationsApi.submit({
        ...form,
        hospitalSlug, // Pass the URL slug seamlessly to the backend
        yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : undefined
      });
      setSubmitted(true);
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to submit application.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)] px-4">
        <div className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-8 text-center flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)] flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Application Received</h2>
          <p className="text-sm text-[var(--color-ink-soft)]">
            Thank you for applying. Our administrative team will review your application and contact you via email shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)] px-4 py-12">
      <div className="w-full max-w-2xl bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-6 md:p-8 shadow-sm">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="h-12 w-12 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white flex items-center justify-center mb-4">
            <Stethoscope size={24} />
          </div>
          <h1 className="font-display font-semibold text-2xl text-[var(--color-ink)]">Join Our Medical Team</h1>
          <p className="text-sm text-[var(--color-ink-soft)] mt-1 max-w-md">
            Submit your credentials below to apply for a practitioner role at our facility.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input label="Full Name" required value={form.name} onChange={update('name')} error={errors.name} />
            <Input label="Email" type="email" required value={form.email} onChange={update('email')} error={errors.email} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input label="Phone" value={form.phone} onChange={update('phone')} error={errors.phone} />
            <Input label="Specialization" required value={form.specialization} onChange={update('specialization')} error={errors.specialization} placeholder="e.g. Cardiology" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input label="Department" value={form.department} onChange={update('department')} error={errors.department} />
            <Input label="Years of Experience" type="number" min="0" value={form.yearsExperience} onChange={update('yearsExperience')} error={errors.yearsExperience} />
          </div>

          <Input label="Education / Qualifications" value={form.education} onChange={update('education')} error={errors.education} />
          <Textarea label="Cover Letter / Message" value={form.message} onChange={update('message')} error={errors.message} />

          <Button type="submit" loading={saving} size="lg" className="mt-4">
            Submit Application
          </Button>
        </form>
      </div>
    </div>
  );
}