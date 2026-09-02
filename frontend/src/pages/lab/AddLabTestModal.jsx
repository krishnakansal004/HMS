import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { labApi } from '../../api/lab.js';
import { toast } from '../../components/ui/Toast.jsx';

const emptyForm = { name: '', code: '', category: '', sampleType: '', price: '', referenceRange: '' };

export default function AddLabTestModal({ open, onClose, onSaved }) {
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
      // Backend LabService converts this Rupee float into Paise minor-currency
      const payload = {
        ...form,
        price: Number(form.price)
      };

      await labApi.addCatalogTest(payload);
      toast.success('Lab test added to catalog successfully!');
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to add test to catalog');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Test to Catalog"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Save to Catalog</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Test Name" required value={form.name} onChange={update('name')} error={errors.name} placeholder="e.g. Complete Blood Count" />
          <Input label="Test Code" required value={form.code} onChange={update('code')} error={errors.code} placeholder="e.g. CBC-01" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Category (Optional)" value={form.category} onChange={update('category')} error={errors.category} placeholder="e.g. Hematology" />
          <Input label="Sample Type (Optional)" value={form.sampleType} onChange={update('sampleType')} error={errors.sampleType} placeholder="e.g. Blood, Urine" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Price (₹)" type="number" step="0.01" min="0" required value={form.price} onChange={update('price')} error={errors.price} />
          <Input label="Reference Range (Optional)" value={form.referenceRange} onChange={update('referenceRange')} error={errors.referenceRange} placeholder="e.g. 4.0 - 5.5 million/mcL" />
        </div>
      </form>
    </Modal>
  );
}