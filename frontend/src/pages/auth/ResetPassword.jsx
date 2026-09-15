import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, KeyRound } from 'lucide-react';
import { authApi } from '../../api/auth.js';
import { Input } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { toast } from '../../components/ui/Toast.jsx';

export default function ResetPassword() {
  const { hospitalSlug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function update(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});
    if (!token) {
      toast.error('This reset link is missing its token or is invalid.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match.' });
      return;
    }
    setSaving(true);
    try {
      await authApi.resetPassword({
        token,
        newPassword: form.newPassword,
        ...(hospitalSlug ? { hospitalSlug } : {}),
      });
      setDone(true);
    } catch (error) {
      if (error.fieldErrors?.length) {
        const fieldErrors = {};
        error.fieldErrors.forEach((item) => { fieldErrors[item.field] = item.message; });
        setErrors(fieldErrors);
      } else {
        toast.error(error.message || 'This reset link is invalid or has expired.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)] px-4">
        <div className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-8 text-center flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)] flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <h1 className="font-display text-xl font-semibold text-[var(--color-ink)]">Password reset</h1>
          <p className="text-sm text-[var(--color-ink-soft)]">Your password has been changed. You can now log in.</p>
          <Button onClick={() => navigate('/login', { state: { hospitalSlug } })} className="mt-2">Go to login</Button>
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
          <h1 className="font-display font-semibold text-2xl text-[var(--color-ink)]">Create a new password</h1>
          <p className="text-sm text-[var(--color-ink-soft)] mt-1">This reset link can only be used once and expires in 10 minutes.</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="New password"
            type="password"
            name="newPassword"
            required
            autoComplete="new-password"
            value={form.newPassword}
            onChange={update('newPassword')}
            error={errors.newPassword}
            hint="At least 8 characters, with an uppercase letter, lowercase letter, and a number."
          />
          <Input
            label="Confirm password"
            type="password"
            name="confirmPassword"
            required
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
            error={errors.confirmPassword}
          />
          <Button type="submit" loading={saving} size="lg" className="mt-2">Reset password</Button>
        </form>
        <p className="text-xs text-[var(--color-ink-faint)] text-center mt-6">
          <Link to="/login" className="text-[var(--color-primary)] hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
