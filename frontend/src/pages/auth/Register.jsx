import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';
import { Input, Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { toast } from '../../components/ui/Toast.jsx';

const initialForm = {
  firstName: '', lastName: '', email: '', password: '', phone: '', gender: 'MALE', dob: '', hospitalSlug: '',
};

// Patient self-service signup only — backend/src/routes/auth.js has no
// public staff registration route. Staff accounts are provisioned by a
// HOSPITAL_ADMIN / DIRECTOR from inside the app, which isn't built yet
// (out of Phase 0/1 scope).
export default function Register() {
  const register = useAuthStore((s) => s.register);
  const status = useAuthStore((s) => s.status);
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    try {
      await register(form);
      toast.success('Account created — sign in to continue.');
      navigate('/login', { replace: true });
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message);
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="h-11 w-11 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white flex items-center justify-center mb-3">
            <Stethoscope size={22} />
          </div>
          <h1 className="font-display font-semibold text-xl text-[var(--color-ink)]">Create your patient account</h1>
          <p className="text-sm text-[var(--color-ink-soft)] mt-1 text-center">Book appointments and manage your records online.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-6">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First name" name="firstName" required value={form.firstName} onChange={update('firstName')} error={errors.firstName} />
            <Input label="Last name" name="lastName" required value={form.lastName} onChange={update('lastName')} error={errors.lastName} />
          </div>
          <Input label="Email" type="email" name="email" required autoComplete="email" value={form.email} onChange={update('email')} error={errors.email} />
          <Input label="Password" type="password" name="password" required autoComplete="new-password" value={form.password} onChange={update('password')} error={errors.password} hint="At least 8 characters." />
          <Input label="Phone" name="phone" required value={form.phone} onChange={update('phone')} error={errors.phone} placeholder="10-digit mobile number" />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Gender" name="gender" required value={form.gender} onChange={update('gender')} error={errors.gender}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </Select>
            <Input label="Date of birth" type="date" name="dob" required value={form.dob} onChange={update('dob')} error={errors.dob} />
          </div>
          <Input label="Hospital ID" name="hospitalSlug" required value={form.hospitalSlug} onChange={update('hospitalSlug')} error={errors.hospitalSlug} placeholder="e.g. sunrise-hospital" />
          <Button type="submit" loading={status === 'loading'} className="mt-2 w-full">
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-[var(--color-ink-soft)] mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--color-primary)] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
