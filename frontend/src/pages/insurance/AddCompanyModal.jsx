import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { insuranceApi } from '../../api/insurance.js';
import { toast } from '../../components/ui/Toast.jsx';

const emptyForm = { name: '', code: '', contactPerson: '', email: '', phone: '', corporateDiscount: '0' };

export default function AddCompanyModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setErrors({});
    }
  }, [open]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      await insuranceApi.createCompany({
        ...form,
        corporateDiscount: Number(form.corporateDiscount) || 0
      });
      toast.success('Insurance provider registered successfully.');
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to register company');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Insurance Provider (TPA)"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Register TPA</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Company Name" required value={form.name} onChange={update('name')} error={errors.name} placeholder="e.g. Star Health" />
          <Input label="TPA Code" required value={form.code} onChange={update('code')} error={errors.code} placeholder="e.g. SH-01" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Contact Person" value={form.contactPerson} onChange={update('contactPerson')} error={errors.contactPerson} />
          <Input label="Corporate Discount (%)" type="number" min="0" max="100" value={form.corporateDiscount} onChange={update('corporateDiscount')} error={errors.corporateDiscount} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Email Address" type="email" value={form.email} onChange={update('email')} error={errors.email} />
          <Input label="Phone Number" value={form.phone} onChange={update('phone')} error={errors.phone} />
        </div>
      </form>
    </Modal>
  );
}