import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { wardsApi } from '../../api/wards.js';
import { toast } from '../../components/ui/Toast.jsx';

const initialForm = {
  name: '',
  type: 'GENERAL',
  floor: '',
  capacity: '',
  pricePerDay: ''
};

export default function WardForm({ open, onClose, onSaved }) {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      setForm(initialForm);
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
      // Data casting: Ensure strings from inputs are sent as numbers to the API
      await wardsApi.create({
        ...form,
        capacity: Number(form.capacity) || 0,
        pricePerDay: Number(form.pricePerDay) || 0
      });
      
      toast.success('Ward created successfully');
      onSaved(); // Triggers the list to refetch
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to create ward');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add New Ward"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Create Ward</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input 
            label="Ward Name" 
            required 
            value={form.name} 
            onChange={update('name')} 
            error={errors.name} 
            placeholder="e.g. South Wing A" 
          />
          <Select 
            label="Ward Type" 
            required 
            value={form.type} 
            onChange={update('type')} 
            error={errors.type}
          >
            <option value="GENERAL">General</option>
            <option value="ICU">ICU</option>
            <option value="PRIVATE">Private</option>
            <option value="EMERGENCY">Emergency</option>
            <option value="MATERNITY">Maternity</option>
          </Select>
        </div>
        
        <Input 
          label="Floor/Location" 
          value={form.floor} 
          onChange={update('floor')} 
          error={errors.floor} 
          placeholder="e.g. 3rd Floor" 
        />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input 
            label="Total Capacity (Beds)" 
            type="number" 
            min="1"
            required 
            value={form.capacity} 
            onChange={update('capacity')} 
            error={errors.capacity} 
          />
          <Input 
            label="Base Price per Day (₹)" 
            type="number" 
            min="0"
            step="0.01"
            required 
            value={form.pricePerDay} 
            onChange={update('pricePerDay')} 
            error={errors.pricePerDay} 
          />
        </div>
        
        <p className="text-xs text-[var(--color-ink-faint)] mt-2">
          * Beds must be added individually to this ward after creation.
        </p>
      </form>
    </Modal>
  );
}