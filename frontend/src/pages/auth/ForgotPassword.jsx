import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, MailCheck } from 'lucide-react';
import { authApi } from '../../api/auth.js';
import { Input } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { toast } from '../../components/ui/Toast.jsx';

export default function ForgotPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: location.state?.email || '',
    hospitalSlug: location.state?.hospitalSlug || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      await authApi.forgotPassword({
        email: form.email,
        ...(form.hospitalSlug.trim() ? { hospitalSlug: form.hospitalSlug.trim() } : {}),
      });
      setSent(true);
    } catch (error) {
      if (error.fieldErrors?.length) {
        const fieldErrors = {};
        error.fieldErrors.forEach((item) => { fieldErrors[item.field] = item.message; });
        setErrors(fieldErrors);
      } else {
        toast.error(error.message || 'Unable to process the request.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)] px-4">
        <div className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-8 text-center flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)] flex items-center justify-center">
            <MailCheck size={24} />
          </div>
          <h1 className="font-display text-xl font-semibold text-[var(--color-ink)]">Check your email</h1>
          <p className="text-sm text-[var(--color-ink-soft)]">
            If an account matches those details, we sent a password reset link. The link expires in 10 minutes.
          </p>
          <Button onClick={() => navigate('/login')} className="mt-2">Back to login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)] px-4">
      <div className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-8">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="h-12 w-12 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white flex items-center justify-center mb-4">
            <KeyRound size={24} />
          </div>
          <h1 className="font-display font-semibold text-2xl text-[var(--color-ink)]">Forgot password?</h1>
          <p className="text-sm text-[var(--color-ink-soft)] mt-1">We’ll send you a secure reset link.</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            name="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            error={errors.email}
            placeholder="you@hospital.com"
          />
          <Input
            label="Hospital ID"
            name="hospitalSlug"
            value={form.hospitalSlug}
            onChange={update('hospitalSlug')}
            error={errors.hospitalSlug}
            placeholder="e.g. sunrise-hospital"
            hint="Required for hospital accounts. Leave blank only for a System Owner account."
          />
          <Button type="submit" loading={saving} size="lg" className="mt-2">Send reset link</Button>
        </form>
        <p className="text-xs text-[var(--color-ink-faint)] text-center mt-6">
          Remembered your password? <Link to="/login" className="text-[var(--color-primary)] hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
