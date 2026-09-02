import { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { wardsApi } from '../../api/wards.js';
import { toast } from '../../components/ui/Toast.jsx';

export default function AddBedModal({ open, onClose, onSaved, ward }) {
  const [bedNumber, setBedNumber] = useState('');
  const [pricePerDay, setPricePerDay] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) {
      setBedNumber('');
      setPricePerDay('');
      setErrors({});
    }
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      await wardsApi.addBed(ward.ward_id, {
        bedNumber,
        pricePerDay: pricePerDay ? Number(pricePerDay) : undefined
      });
      toast.success(`Bed ${bedNumber} added to ${ward.name}`);
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to add bed.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!ward) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add Bed to ${ward.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving}>Add Bed</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="bg-[var(--color-paper)] p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] mb-2">
          <p className="text-sm font-medium text-[var(--color-ink)]">Ward Capacity: <span className="font-mono-data text-[var(--color-primary)]">{ward.bed?.length || 0} / {ward.capacity}</span></p>
          <p className="text-xs text-[var(--color-ink-soft)] mt-1">Base Room Rate: ₹{(ward.price_per_day / 100).toFixed(2)} / day</p>
        </div>

        <Input 
          label="Bed Number / Identifier" 
          required 
          value={bedNumber} 
          onChange={(e) => setBedNumber(e.target.value)} 
          error={errors.bedNumber}
          placeholder="e.g., A-101, ICU-01"
        />

        <Input 
          label="Custom Price per Day (₹)" 
          type="number"
          step="0.01"
          min="0"
          value={pricePerDay} 
          onChange={(e) => setPricePerDay(e.target.value)} 
          error={errors.pricePerDay}
          hint="Leave blank to use the ward's base room rate."
        />
      </form>
    </Modal>
  );
}
