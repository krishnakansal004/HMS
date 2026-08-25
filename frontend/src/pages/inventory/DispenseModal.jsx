import { useState } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { inventoryApi } from '../../api/inventory.js';
import { toast } from '../../components/ui/Toast.jsx';

export default function DispenseModal({ open, onClose, onSaved, medicine }) {
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (Number(quantity) > medicine.quantity) {
      toast.error('Cannot dispense more than available stock!');
      return;
    }

    setSaving(true);
    try {
      await inventoryApi.dispense(medicine.medicine_id, {
        quantity: Number(quantity),
        notes: notes.trim()
      });
      toast.success(`${quantity} units of ${medicine.name} dispensed.`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to dispense medicine');
    } finally {
      setSaving(false);
    }
  }

  if (!medicine) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Dispense ${medicine.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving} variant="primary">Confirm Dispense</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="bg-[var(--color-paper)] p-4 rounded-[var(--radius-sm)] border border-[var(--color-border)] mb-2">
          <p className="text-sm font-medium text-[var(--color-ink)]">Current Stock: <span className="font-mono-data text-[var(--color-primary)]">{medicine.quantity} Units</span></p>
          <p className="text-xs text-[var(--color-ink-soft)] mt-1">Batch: {medicine.batch_number}</p>
        </div>

        <Input 
          label="Quantity to Dispense" 
          type="number" 
          min="1" 
          max={medicine.quantity}
          required 
          value={quantity} 
          onChange={(e) => setQuantity(e.target.value)} 
        />
        
        <Textarea 
          label="Dispense Notes / Patient ID" 
          value={notes} 
          onChange={(e) => setNotes(e.target.value)} 
          placeholder="e.g., Prescribed to Patient XYZ..."
        />
      </form>
    </Modal>
  );
}