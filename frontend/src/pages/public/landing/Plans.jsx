import { Check, Lock, Loader2 } from 'lucide-react';
import Button from '../../../components/ui/Button.jsx';
import { scrollToSection } from '../../../utils/scrollToSection.js';

const MODULES = [
  ['billing', 'Billing & online payments'],
  ['lab_radiology', 'Lab & radiology orders'],
  ['inventory', 'Pharmacy & inventory'],
  ['hrms', 'Staff & HR management'],
  ['payroll', 'Payroll processing'],
  ['clinical_media', 'Clinical documents & media'],
  ['voice_notes', 'Patient voice notes'],
  ['advanced_analytics', 'Advanced analytics'],
  ['abdm', 'ABDM readiness'],
];

function limitValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 'Not specified';
}

export default function Plans({ plans, loading, onChoosePlan }) {
  const publicPlans = (plans || []).filter((p) => p.public);
  const hasCustomPlans = (plans || []).some((p) => !p.public);

  function choose(planId) {
    onChoosePlan?.(planId);
    scrollToSection('register');
  }

  return (
    <section id="plans" className="max-w-6xl mx-auto px-4 lg:px-6 py-16 lg:py-24">
      <div className="max-w-2xl">
        <h2 className="font-display font-semibold text-2xl lg:text-[32px] text-[var(--color-ink)]">
          Plans
        </h2>
        <p className="text-[var(--color-ink-soft)] mt-3 text-base">
          Start with the clinical essentials, then unlock the operational systems that help
          your hospital scale. Every upgrade adds capacity and capability.
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
            (() => {
              const features = plan.limits?.features || {};
              const hasFeatureMap = Object.keys(features).length > 0;
              const paid = Number(plan.prices?.monthly || 0) > 0;
              return (
            <div
              key={plan.plan_id}
              className={`rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-6 flex flex-col ${paid ? 'border-[var(--color-primary)] shadow-[0_8px_30px_rgba(14,107,98,0.12)]' : 'border-[var(--color-border)]'}`}
            >
              <div className="flex items-start justify-between gap-3">
              <h3 className="font-display font-semibold text-lg text-[var(--color-ink)]">
                {plan.name}
              </h3>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-primary)] bg-[var(--color-primary-soft)] px-2 py-1 rounded-full">
                  {paid ? 'Full operations' : 'Core essentials'}
                </span>
              </div>
              <p className="mt-3">
                <span className="font-display font-semibold text-3xl text-[var(--color-ink)]">
                 {paid ? `₹${plan.prices?.monthly}` : 'Free'}
                </span>
                {paid && <span className="text-sm text-[var(--color-ink-faint)]"> /month</span>}
              </p>
              {plan.prices?.yearly != null && (
                <p className="text-xs text-[var(--color-ink-faint)] mt-0.5">
                  or \u20b9{plan.prices.yearly} billed yearly
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 mt-5 text-xs text-[var(--color-ink-soft)]">
                <span className="rounded-[var(--radius-sm)] bg-[var(--color-paper)] px-2.5 py-2"><strong className="text-[var(--color-ink)]">{limitValue(plan.limits?.admins)}</strong> admins</span>
                <span className="rounded-[var(--radius-sm)] bg-[var(--color-paper)] px-2.5 py-2"><strong className="text-[var(--color-ink)]">{limitValue(plan.limits?.doctors)}</strong> doctors</span>
                <span className="rounded-[var(--radius-sm)] bg-[var(--color-paper)] px-2.5 py-2"><strong className="text-[var(--color-ink)]">{limitValue(plan.limits?.staff)}</strong> staff</span>
                <span className="rounded-[var(--radius-sm)] bg-[var(--color-paper)] px-2.5 py-2"><strong className="text-[var(--color-ink)]">{limitValue(plan.limits?.patients)}</strong> patients</span>
              </div>
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-faint)] mb-2">Module access</p>
                <ul className="flex flex-col gap-2 text-sm">
                  {hasFeatureMap ? MODULES.map(([key, label]) => (
                    <li key={key} className={`flex items-center gap-2 ${features[key] ? 'text-[var(--color-ink-soft)]' : 'text-[var(--color-ink-faint)] line-through'}`}>
                      {features[key] ? <Check size={15} className="text-[var(--color-success)] shrink-0" /> : <Lock size={13} className="shrink-0" />}
                      {label}
                    </li>
                  )) : (
                    <li className="flex items-center gap-2 text-[var(--color-ink-soft)]"><Check size={15} className="text-[var(--color-success)]" /> Core clinical modules</li>
                  )}
                  {(plan.limits?.customFeatures || []).map((feature) => (
                    <li key={`custom-${feature}`} className="flex items-center gap-2 text-[var(--color-ink-soft)]">
                      <Check size={15} className="text-[var(--color-accent)] shrink-0" /> {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <Button className="w-full mt-6" onClick={() => choose(plan.plan_id)}>
                Choose {plan.name}
              </Button>
            </div>
              );
            })()
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
          <button type="button" onClick={() => scrollToSection('contact')} className="text-[var(--color-primary)] font-medium hover:underline">
            Contact us
          </button>{' '}
          about a custom plan.
        </p>
      )}
    </section>
  );
}
