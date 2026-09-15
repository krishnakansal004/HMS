import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Input, Select } from '../../../components/ui/Input.jsx';
import Button from '../../../components/ui/Button.jsx';
import { tenantsApi } from '../../../api/plans.js';
import { loadRazorpay } from '../../../utils/loadRazorpay.js';
import { toast } from '../../../components/ui/Toast.jsx';

// Same fields, same auto-slug behavior, and the same
// POST /tenants/provision endpoint as CreateTenantModal.jsx (the
// SYSTEM_OWNER-side equivalent of this form) — that endpoint is
// explicitly public + rate-limited (tenantProvisionLimiter) for exactly
// this self-serve case, per backend/src/routes/tenants.js.
export default function RegisterForm({ plans, plansLoading, selectedPlanId, onPlanChange }) {
  const [form, setForm] = useState({
    name: '', slug: '', planId: '', billingPeriod: 'monthly', adminName: '', adminEmail: '', adminPassword: '',
  });
  // Only plans marked `public: true` are offered here. Unlike the
  // SYSTEM_OWNER-internal CreateTenantModal (which legitimately assigns
  // any plan, including private/customized ones, to a tenant), this is a
  // form any internet visitor can submit — offering hidden or
  // access-code-gated enterprise tiers here would let a random visitor
  // self-provision onto a plan that was never meant to be publicly
  // selectable.
  const selectablePlans = (plans || []).filter((p) => p.public);
  const selectedPlan = selectablePlans.find((p) => p.plan_id === form.planId);
  const selectedPrice = Number(selectedPlan?.prices?.[form.billingPeriod] ?? selectedPlan?.prices?.monthly ?? 0);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Reflect a plan chosen from the Plans section above without owning
  // the source of truth for it (LandingPage does) — lets clicking
  // "Choose {plan}" actually land the user on that plan instead of
  // scrolling them to an empty "Select a plan..." dropdown.
  useEffect(() => {
    if (selectedPlanId) setForm((f) => ({ ...f, planId: selectedPlanId }));
  }, [selectedPlanId]);

  function update(field) {
    return (e) => {
      const value = e.target.value;
      setForm((f) => ({ ...f, [field]: value, ...(field === 'planId' ? { billingPeriod: 'monthly' } : {}) }));
      if (field === 'planId') onPlanChange?.(value);
    };
  }

  function handleNameChange(e) {
    const val = e.target.value;
    setForm((f) => ({
      ...f,
      name: val,
      slug: val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    let waitingForPayment = false;
    try {
      const result = await tenantsApi.provision(form);
      const payment = result.data;
      if (!payment?.paymentRequired) {
        setDone(true);
        return;
      }

      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Payment checkout could not be loaded. Please try again.');

      waitingForPayment = true;
      const checkout = new window.Razorpay({
        key: payment.keyId,
        amount: payment.amount,
        currency: payment.currency,
        name: 'HMS Clinical Ledger',
        description: `${payment.planName} hospital subscription`,
        order_id: payment.orderId,
        prefill: payment.prefill,
        theme: { color: '#0ea5e9' },
        handler: async (response) => {
          try {
            await tenantsApi.verifyProvisionPayment({
              signupId: payment.signupId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            });
            setDone(true);
          } catch (err) {
            toast.error(err.message || 'Payment was received but could not be verified yet.');
          } finally {
            setSaving(false);
          }
        },
        modal: { ondismiss: () => { waitingForPayment = false; setSaving(false); } },
      });
      checkout.on('payment.failed', () => {
        waitingForPayment = false;
        setSaving(false);
        toast.error('Payment failed. Your hospital was not provisioned.');
      });
      checkout.open();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Could not register your hospital right now.');
      }
    } finally {
      if (!waitingForPayment) setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center max-w-lg mx-auto">
        <CheckCircle2 size={36} className="text-[var(--color-success)] mx-auto" />
        <h3 className="font-display font-semibold text-lg text-[var(--color-ink)] mt-4">
          Your hospital workspace is ready
        </h3>
        <p className="text-sm text-[var(--color-ink-soft)] mt-2">
          Sign in with the administrator email and password you just set to get started.
        </p>
        <Link
          to="/login"
          state={{ hospitalSlug: form.slug, prefillEmail: form.adminEmail }}
          className="inline-block mt-5"
        >
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:p-8 max-w-lg mx-auto flex flex-col gap-5"
    >
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-3 pb-2 border-b border-[var(--color-border)]">
          Hospital details
        </h3>
        <div className="flex flex-col gap-4">
          <Input label="Hospital name" required value={form.name} onChange={handleNameChange} error={errors.name} />
          <Input
            label="Portal URL slug"
            required
            value={form.slug}
            onChange={update('slug')}
            error={errors.slug}
            hint="e.g. sunrise-hospital — staff and patients will use this to sign in."
          />
          <Select
            label="Plan"
            required
            value={form.planId}
            onChange={update('planId')}
            error={errors.planId}
            disabled={plansLoading}
          >
            <option value="">{plansLoading ? 'Loading plans\u2026' : 'Select a plan...'}</option>
            {selectablePlans.map((p) => (
              <option key={p.plan_id} value={p.plan_id}>{p.name}</option>
            ))}
          </Select>
          {form.planId && (
            <Select label="Billing period" value={form.billingPeriod} onChange={update('billingPeriod')}>
              <option value="monthly">Monthly</option>
              {selectablePlans.find((p) => p.plan_id === form.planId)?.prices?.yearly != null && (
                <option value="yearly">Yearly</option>
              )}
            </Select>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-3 pb-2 border-b border-[var(--color-border)]">
          Primary administrator
        </h3>
        <div className="flex flex-col gap-4">
          <Input label="Full name" required value={form.adminName} onChange={update('adminName')} error={errors.adminName} />
          <Input label="Email" type="email" required value={form.adminEmail} onChange={update('adminEmail')} error={errors.adminEmail} />
          <Input
            label="Password"
            type="password"
            required
            value={form.adminPassword}
            onChange={update('adminPassword')}
            error={errors.adminPassword}
            hint="At least 8 characters, with an uppercase, lowercase, and number."
          />
        </div>
      </div>

      <Button type="submit" size="lg" loading={saving} className="w-full">
        {selectedPrice > 0 ? 'Continue to secure payment' : 'Create your free workspace'}
      </Button>
      <p className="text-xs text-[var(--color-ink-faint)] text-center -mt-2">
        Already registered?{' '}
        <Link to="/login" className="text-[var(--color-primary)] font-medium hover:underline">
          Sign in instead
        </Link>
      </p>
    </form>
  );
}
