import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import { plansApi, planRequestsApi } from '../../api/plans.js';
import { toast } from '../ui/Toast.jsx';

function displayPrice(plan, period) {
  const monthly = Number(plan.prices?.monthly || 0);
  const amount = period === 'yearly'
    ? Number(plan.prices?.yearly ?? monthly * 12)
    : monthly;
  return Number.isFinite(amount) ? amount : 0;
}

export default function UpgradePlanModal({ open, onClose, currentPlanId, currentPlanName }) {
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    plansApi.publicList()
      .then((response) => {
        if (!active) return;
        const upgradeOptions = (response.data || []).filter((plan) => (
          plan.plan_id !== currentPlanId && (Number(plan.prices?.monthly || 0) > 0 || Number(plan.prices?.yearly || 0) > 0)
        ));
        setPlans(upgradeOptions);
        setSelectedPlanId((current) => upgradeOptions.some((plan) => plan.plan_id === current)
          ? current
          : upgradeOptions[0]?.plan_id || '');
      })
      .catch((error) => {
        if (active) toast.error(error.message || 'Unable to load upgrade options.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [open, currentPlanId]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.plan_id === selectedPlanId) || null,
    [plans, selectedPlanId],
  );

  async function submit() {
    if (!selectedPlan) return;
    setSubmitting(true);
    try {
      await planRequestsApi.create({ planId: selectedPlan.plan_id, period });
      toast.success(`Your request for ${selectedPlan.name} has been sent for review.`);
      onClose();
    } catch (error) {
      toast.error(error.message || 'Unable to send your upgrade request.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upgrade your hospital plan"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Not now</Button>
          <Button icon={ArrowUpRight} onClick={submit} disabled={!selectedPlan} loading={submitting}>
            Send upgrade request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-sm text-[var(--color-ink-soft)]">
            {currentPlanName ? `You are currently on ${currentPlanName}. ` : ''}
            Choose a plan to unlock more capacity and modules.
          </p>
          <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
            Your access remains unchanged until the request is reviewed.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center text-sm text-[var(--color-ink-soft)]">
            <Loader2 size={18} className="animate-spin" /> Loading upgrade options…
          </div>
        ) : plans.length === 0 ? (
          <p className="rounded-[var(--radius-md)] bg-[var(--color-paper)] px-4 py-3 text-sm text-[var(--color-ink-soft)]">
            There are no published paid plans available to request right now.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              {plans.map((plan) => {
                const selected = selectedPlanId === plan.plan_id;
                return (
                  <button
                    key={plan.plan_id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.plan_id)}
                    className={`w-full text-left rounded-[var(--radius-md)] border p-3.5 transition-colors ${selected ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]' : 'border-[var(--color-border)] hover:bg-[var(--color-paper)]'}`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-medium text-[var(--color-ink)]">{plan.name}</span>
                      {selected && <Check size={17} className="text-[var(--color-primary)]" />}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--color-ink-soft)]">
                      {plan.limits?.admins} admins · {plan.limits?.doctors} doctors · {plan.limits?.staff} staff · {plan.limits?.patients} patients
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="block text-sm font-medium text-[var(--color-ink)]">
              Billing cycle
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="mt-1.5 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-ink)]"
              >
                <option value="monthly">Monthly{selectedPlan ? ` — ₹${displayPrice(selectedPlan, 'monthly')}` : ''}</option>
                <option value="yearly">Yearly{selectedPlan ? ` — ₹${displayPrice(selectedPlan, 'yearly')}` : ''}</option>
              </select>
            </label>
          </>
        )}
      </div>
    </Modal>
  );
}
