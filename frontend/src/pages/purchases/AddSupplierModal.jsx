import { useState } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { suppliersApi } from '../../api/suppliers.js';
import { toast } from '../../components/ui/Toast.jsx';

export default function AddSupplierModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', contactPhone: '', contactEmail: '' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      await suppliersApi.create(form);
      toast.success('Supplier onboarded successfully.');
      onSaved();
      onClose();
      setForm({ name: '', contactPhone: '', contactEmail: '' });
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to create supplier.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Onboard New Supplier"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Add Supplier</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Supplier / Vendor Name" required value={form.name} onChange={update('name')} error={errors.name} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Contact Phone" required value={form.contactPhone} onChange={update('contactPhone')} error={errors.contactPhone} />
          <Input label="Contact Email" type="email" value={form.contactEmail} onChange={update('contactEmail')} error={errors.contactEmail} />
        </div>
      </form>
    </Modal>
  );
}