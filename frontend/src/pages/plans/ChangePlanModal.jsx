import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { plansApi, tenantsApi } from '../../api/plans.js';
import { toast } from '../../components/ui/Toast.jsx';

export default function ChangePlanModal({ open, onClose, tenant, onSaved }) {
  const [planId, setPlanId] = useState('');
  const [plans, setPlans] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPlanId(tenant?.plan?.plan_id || '');
      plansApi.list()
        .then(res => setPlans(res.data || []))
        .catch(() => toast.error('Failed to load plans'));
    }
  }, [open, tenant]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!planId || planId === tenant?.plan?.plan_id) {
      onClose();
      return;
    }
    
    setSaving(true);
    try {
      await tenantsApi.updatePlan(tenant.tenant_id, planId);
      toast.success('Hospital plan updated successfully.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to update plan.');
    } finally {
      setSaving(false);
    }
  }

  if (!tenant) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Change Plan for ${tenant.name}`} footer={
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} loading={saving}>Confirm Change</Button>
      </>
    }>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="bg-[var(--color-paper)] p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] mb-2">
          <p className="text-sm font-medium text-[var(--color-ink)]">Current Plan: <span className="font-semibold text-[var(--color-primary)]">{tenant.plan?.name || 'Unassigned'}</span></p>
        </div>
        <Select label="Select New Plan" required value={planId} onChange={(e) => setPlanId(e.target.value)}>
          <option value="">Choose a plan...</option>
          {plans.map(p => (
            <option key={p.plan_id} value={p.plan_id}>{p.name}</option>
          ))}
        </Select>
      </form>
    </Modal>
  );
}