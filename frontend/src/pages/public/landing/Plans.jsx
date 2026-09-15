import { Check, Loader2 } from 'lucide-react';
import Button from '../../../components/ui/Button.jsx';

export default function Plans({ plans, loading, onChoosePlan }) {
  const publicPlans = (plans || []).filter((p) => p.public);
  const hasCustomPlans = (plans || []).some((p) => !p.public);

  function choose(planId) {
    onChoosePlan?.(planId);
    document.getElementById('register')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section id="plans" className="max-w-6xl mx-auto px-4 lg:px-6 py-16 lg:py-24">
      <div className="max-w-2xl">
        <h2 className="font-display font-semibold text-2xl lg:text-[32px] text-[var(--color-ink)]">
          Plans
        </h2>
        <p className="text-[var(--color-ink-soft)] mt-3 text-base">
          Pick a plan when you register your hospital below. Every plan includes the same
          modules — plans differ in staff and doctor limits.
        </p>
        <p className="text-xs text-[var(--color-ink-faint)] mt-2">
          Free plans start immediately. Paid plans are activated after secure Razorpay payment.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[var(--color-ink-faint)] mt-10">
          <Loader2 className="animate-spin" size={18} />
          <span className="text-sm">Loading plans\u2026</span>
        </div>
      )}

      {!loading && publicPlans.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
          {publicPlans.map((plan) => (
            <div
              key={plan.plan_id}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 flex flex-col"
            >
              <h3 className="font-display font-semibold text-lg text-[var(--color-ink)]">
                {plan.name}
              </h3>
              <p className="mt-3">
                <span className="font-display font-semibold text-3xl text-[var(--color-ink)]">
                 {plan.prices?.monthly ?? 0}
                </span>
                <span className="text-sm text-[var(--color-ink-faint)]"> /month</span>
              </p>
              {plan.prices?.yearly != null && (
                <p className="text-xs text-[var(--color-ink-faint)] mt-0.5">
                  or \u20b9{plan.prices.yearly} billed yearly
                </p>
              )}
              <ul className="flex flex-col gap-2 mt-5 text-sm text-[var(--color-ink-soft)]">
                <li className="flex items-center gap-2">
                  <Check size={15} className="text-[var(--color-success)] shrink-0" />
                  {plan.limits?.admins ? `${plan.limits.admins} admin accounts` : 'Unlimited admin accounts'}
                </li>
                <li className="flex items-center gap-2">
                  <Check size={15} className="text-[var(--color-success)] shrink-0" />
                  {plan.limits?.doctors ? `${plan.limits.doctors} doctor accounts` : 'Unlimited doctor accounts'}
                </li>
              </ul>
              <Button className="w-full mt-6" onClick={() => choose(plan.plan_id)}>
                Choose {plan.name}
              </Button>
            </div>
          ))}
        </div>
      )}

      {!loading && publicPlans.length === 0 && (
        <p className="text-sm text-[var(--color-ink-faint)] mt-10">
          Plan pricing isn't published yet — register your hospital below and you'll pick a
          plan as part of setup.
        </p>
      )}

      {!loading && hasCustomPlans && (
        <p className="text-sm text-[var(--color-ink-soft)] mt-6">
          Need something outside a standard plan?{' '}
          <a href="#contact" className="text-[var(--color-primary)] font-medium hover:underline">
            Contact us
          </a>{' '}
          about a custom plan.
        </p>
      )}
    </section>
  );
}
