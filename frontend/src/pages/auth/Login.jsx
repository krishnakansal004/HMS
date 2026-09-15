import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';
import { Input } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { toast } from '../../components/ui/Toast.jsx';

// hospitalSlug is required for every role except SYSTEM_OWNER, per
// authValidator.js. We always render the field — a SYSTEM_OWNER account
// simply leaves it blank — rather than guessing role before login.
export default function Login() {
  const login = useAuthStore((s) => s.login);
  const status = useAuthStore((s) => s.status);
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({
    email: location.state?.prefillEmail || '',
    password: '',
    hospitalSlug: location.state?.hospitalSlug || '',
  });
  const [errors, setErrors] = useState({});

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    try {
      const user = await login(form);
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
      toast.success(`Welcome back, ${user.name || user.email}`);
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
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)] px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-11 w-11 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white flex items-center justify-center mb-3">
            <Stethoscope size={22} />
          </div>
          <h1 className="font-display font-semibold text-xl text-[var(--color-ink)]">Sign in to HMS</h1>
          <p className="text-sm text-[var(--color-ink-soft)] mt-1">Hospital operations, in one place.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-6">
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
            label="Password"
            type="password"
            name="password"
            required
            autoComplete="current-password"
            value={form.password}
            onChange={update('password')}
            error={errors.password}
            placeholder="••••••••"
          />
          <Input
            label="Hospital ID"
            name="hospitalSlug"
            value={form.hospitalSlug}
            onChange={update('hospitalSlug')}
            error={errors.hospitalSlug}
            placeholder="e.g. sunrise-hospital"
            hint="Leave blank only for a System Owner account."
          />
          <Button type="submit" loading={status === 'loading'} className="mt-2 w-full">
            Sign in
          </Button>
          <Link
            to="/forgot-password"
            state={{ hospitalSlug: form.hospitalSlug, email: form.email }}
            className="text-center text-sm text-[var(--color-primary)] hover:underline"
          >
            Forgot password?
          </Link>
        </form>

        <p className="text-center text-sm text-[var(--color-ink-soft)] mt-5">
          New patient?{' '}
          <Link to="/register" className="text-[var(--color-primary)] font-medium hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
