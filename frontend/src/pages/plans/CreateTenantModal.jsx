import { useState } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { tenantsApi } from '../../api/plans.js';
import { toast } from '../../components/ui/Toast.jsx';

export default function CreateTenantModal({ open, onClose, onSaved, plans }) {
  const [form, setForm] = useState({
    name: '', slug: '', planId: '', adminName: '', adminEmail: '', adminPassword: ''
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  // Auto-generate a URL-friendly slug from the hospital name
  function handleNameChange(e) {
    const val = e.target.value;
    setForm(f => ({
      ...f, 
      name: val, 
      slug: val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await tenantsApi.adminProvision(form);
      toast.success('Hospital tenant and admin account provisioned successfully.');
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to provision tenant.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Provision New Hospital"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Create Tenant</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-3 pb-1 border-b border-[var(--color-border)]">Hospital Details</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="Hospital Name" required value={form.name} onChange={handleNameChange} error={errors.name} />
            <Input label="Portal URL Slug" required value={form.slug} onChange={update('slug')} error={errors.slug} hint="e.g., sunrise-hospital" />
          </div>
          <Select label="Subscription Plan" required value={form.planId} onChange={update('planId')} error={errors.planId}>
            <option value="">Select a plan...</option>
            {plans.map(p => (
              <option key={p.plan_id} value={p.plan_id}>{p.name}</option>
            ))}
          </Select>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-3 pb-1 border-b border-[var(--color-border)]">Primary Administrator</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="Admin Full Name" required value={form.adminName} onChange={update('adminName')} error={errors.adminName} />
            <Input label="Admin Email" type="email" required value={form.adminEmail} onChange={update('adminEmail')} error={errors.adminEmail} />
          </div>
          <Input 
            label="Temporary Password" 
            type="password" 
            required 
            value={form.adminPassword} 
            onChange={update('adminPassword')} 
            error={errors.adminPassword} 
            hint="Must be at least 8 characters with an uppercase, lowercase, and number." 
          />
        </div>
      </form>
    </Modal>
  );
}
