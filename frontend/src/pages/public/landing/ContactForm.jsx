import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Input, Textarea } from '../../../components/ui/Input.jsx';
import Button from '../../../components/ui/Button.jsx';
import { queriesApi } from '../../../api/queries.js';
import { toast } from '../../../components/ui/Toast.jsx';

// POST /api/queries — public, rate-limited (publicFormLimiter), no auth.
// Submissions land in the SYSTEM_OWNER's unassigned-queries inbox
// (GET /api/queries/unassigned) for follow-up. For visitors who aren't
// ready to self-provision via RegisterForm above.
export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await queriesApi.submit(form);
      setDone(true);
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Could not send your message right now.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center max-w-lg mx-auto">
        <CheckCircle2 size={32} className="text-[var(--color-success)] mx-auto" />
        <h3 className="font-display font-semibold text-lg text-[var(--color-ink)] mt-4">
          Message sent
        </h3>
        <p className="text-sm text-[var(--color-ink-soft)] mt-2">
          Thanks — we'll get back to you at the email you provided.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:p-8 max-w-lg mx-auto flex flex-col gap-4"
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Input label="Name" required value={form.name} onChange={update('name')} error={errors.name} />
        <Input label="Email" type="email" required value={form.email} onChange={update('email')} error={errors.email} />
      </div>
      <Input label="Phone (optional)" value={form.phone} onChange={update('phone')} error={errors.phone} />
      <Textarea
        label="Message"
        required
        rows={4}
        value={form.message}
        onChange={update('message')}
        error={errors.message}
        placeholder="Tell us about your hospital and what you're looking for."
      />
      <Button type="submit" size="lg" loading={saving} className="w-full">
        Send message
      </Button>
    </form>
  );
}
