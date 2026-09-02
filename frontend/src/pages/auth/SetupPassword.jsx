import { useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { KeyRound, CheckCircle2 } from 'lucide-react';
import { authApi } from '../../api/auth.js';
import { Input } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { toast } from '../../components/ui/Toast.jsx';

// Landing page for the link sent by both doctorService.createDoctor and
// doctorManagementService.reviewApplication (approval branch) — either
// path provisions a users row with no password_hash and a real setup
// token instead. Without this page, the email those flows send links
// nowhere and the account stays permanently unreachable.
export default function SetupPassword() {
  const { hospitalSlug } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});

    if (form.newPassword !== form.confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match.' });
      return;
    }
    if (!token) {
      toast.error('This setup link is missing its token. Please use the link from your email exactly as sent.');
      return;
    }

    setSaving(true);
    try {
      await authApi.setupPassword({ token, hospitalSlug, newPassword: form.newPassword });
      setDone(true);
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'This setup link is invalid or has expired.');
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
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Password set</h2>
          <p className="text-sm text-[var(--color-ink-soft)]">
            Your account is ready. You can now log in with your new password.
          </p>
          <Button onClick={() => navigate('/login')} className="mt-2">Go to login</Button>
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
          <h1 className="font-display font-semibold text-2xl text-[var(--color-ink)]">Set your password</h1>
          <p className="text-sm text-[var(--color-ink-soft)] mt-1">
            Choose a password to activate your account.
          </p>
        </div>

        {!token && (
          <p className="text-sm text-[var(--color-danger)] text-center mb-4">
            This link is missing its setup token — please open the link from your email directly rather than typing the URL by hand.
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="New password"
            type="password"
            required
            value={form.newPassword}
            onChange={update('newPassword')}
            error={errors.newPassword}
            hint="At least 8 characters, with an uppercase letter, lowercase letter, and a number."
          />
          <Input
            label="Confirm password"
            type="password"
            required
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
            error={errors.confirmPassword}
          />
          <Button type="submit" loading={saving} size="lg" className="mt-2">
            Set password
          </Button>
        </form>

        <p className="text-xs text-[var(--color-ink-faint)] text-center mt-6">
          Already set your password? <Link to="/login" className="text-[var(--color-primary)] hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
