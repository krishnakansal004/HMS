import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { invoicesApi, INVOICE_ITEM_TYPES } from '../../api/invoices.js';
import { patientsApi } from '../../api/patients.js';
import { toast } from '../../components/ui/Toast.jsx';
import { fullName } from '../../utils/format.js';
import { Spinner } from '../../components/ui/Table.jsx';

const emptyItem = { entityType: 'OTHER', description: '', quantity: 1, unitPrice: '', gstRate: 0 };

export default function GenerateInvoiceForm({ open, onClose, onSaved }) {
  const [patientId, setPatientId] = useState('');
  const [items, setItems] = useState([{ ...emptyItem }]);
  const [discount, setDiscount] = useState('0');
  
  const [patients, setPatients] = useState([]);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [loadingCharges, setLoadingCharges] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLoadingDeps(true);
      patientsApi.list({ limit: 100 })
        .then(res => setPatients(res.data || []))
        .catch(() => toast.error('Failed to load patients'))
        .finally(() => setLoadingDeps(false));
    } else {
      setPatientId('');
      setItems([{ ...emptyItem }]);
      setDiscount('0');
    }
  }, [open]);

  // Real-time calculations for UI display
  const subtotalDisplay = items.reduce((sum, item) => sum + (Number(item.unitPrice) * Number(item.quantity)), 0);
  const taxDisplay = items.reduce((sum, item) => {
    const lineTotal = Number(item.unitPrice) * Number(item.quantity);
    return sum + (lineTotal * (Number(item.gstRate) / 100));
  }, 0);
  const totalDisplay = subtotalDisplay + taxDisplay - Number(discount);

  const addItem = () => setItems([...items, { ...emptyItem }]);
  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    if (field !== 'sourceKey' && (newItems[index].sourceKey || newItems[index].entityId)) {
      newItems[index].sourceKey = undefined;
      newItems[index].entityId = undefined;
    }
    setItems(newItems);
  };
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  async function loadPatientCharges(nextPatientId) {
    setPatientId(nextPatientId);
    setItems([{ ...emptyItem }]);
    if (!nextPatientId) return;
    setLoadingCharges(true);
    try {
      const response = await invoicesApi.getPatientCharges(nextPatientId);
      const charges = response.data || [];
      if (charges.length) {
        setItems(charges.map((item) => ({
          entityType: item.entityType,
          entityId: item.entityId,
          sourceKey: item.sourceKey,
          description: item.description,
          quantity: item.quantity,
          unitPrice: (Number(item.unitPrice) / 100).toFixed(2),
          gstRate: item.gstRate,
        })));
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load patient charges');
    } finally {
      setLoadingCharges(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!patientId || items.length === 0) return;
    
    if (totalDisplay < 0) {
      toast.error('Total cannot be negative. Check your discount.');
      return;
    }

    setSaving(true);
    try {
     // Deep convert display decimals to minor-currency (paise) integers
      const payload = {
        patientId,
        discount: Math.round(Number(discount) * 100),
        taxRate: 0, 
        items: items.map(i => ({
          entityType: i.entityType,
          entityId: i.entityId,
          sourceKey: i.sourceKey,
          description: i.description.trim(),
          itemName: i.description.trim(),
          quantity: Number(i.quantity),
          unitPrice: Math.round(Number(i.unitPrice) * 100),
          gstRate: Number(i.gstRate)
        }))
      };

      await invoicesApi.create(payload);
      toast.success('Invoice generated successfully.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to generate invoice');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate New Invoice"
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="font-display font-semibold text-lg text-[var(--color-ink)]">
            Net Total: <span className="font-mono-data text-[var(--color-primary)]">₹{totalDisplay.toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} loading={saving} disabled={loadingDeps || items.length === 0 || !patientId || loadingCharges}>
              Generate & Save
            </Button>
          </div>
        </div>
      }
    >
      {loadingDeps ? (
        <Spinner label="Loading patients..." />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Select label="Select Patient" required value={patientId} onChange={(e) => loadPatientCharges(e.target.value)} disabled={loadingCharges}>
            <option value="">Choose a patient...</option>
            {patients.map(p => (
              <option key={p.patient_id} value={p.patient_id}>
                {fullName(p)} {p.phone ? `(${p.phone})` : ''}
              </option>
            ))}
          </Select>

          <div>
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 mb-3">
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">Line Items</h3>
              <Button size="sm" variant="secondary" icon={Plus} onClick={addItem}>Add Item</Button>
            </div>
            
            {loadingCharges && <Spinner label="Loading patient charges..." />}
            <div className="flex flex-col gap-3">
              {items.map((item, index) => (
                <div key={index} className="flex items-start gap-3 bg-[var(--color-paper)] p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
                  <Select className="w-40" value={item.entityType} onChange={(e) => updateItem(index, 'entityType', e.target.value)}>
                    {INVOICE_ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                  
                  <Input 
                    className="flex-1" 
                    placeholder="Description / Name" 
                    required 
                    value={item.description} 
                    onChange={(e) => updateItem(index, 'description', e.target.value)} 
                  />
                  
                  <Input 
                    type="number" min="1" className="w-20" placeholder="Qty" 
                    required value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} 
                  />
                  
                  <Input 
                    type="number" step="0.01" min="0" className="w-28" placeholder="Price (₹)" 
                    required value={item.unitPrice} onChange={(e) => updateItem(index, 'unitPrice', e.target.value)} 
                  />
                  
                  <Input 
                    type="number" min="0" max="100" className="w-24" placeholder="GST %" 
                    value={item.gstRate} onChange={(e) => updateItem(index, 'gstRate', e.target.value)} 
                  />
                  
                  <button type="button" onClick={() => removeItem(index)} className="p-2 mt-1 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] rounded-md transition-colors" disabled={items.length === 1}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 text-sm text-[var(--color-ink-soft)] mt-4 p-4 border border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-sm">
            <div className="flex justify-between w-64"><span>Subtotal:</span> <span className="font-mono-data text-[var(--color-ink)]">₹{subtotalDisplay.toFixed(2)}</span></div>
            <div className="flex justify-between w-64"><span>Taxes (GST):</span> <span className="font-mono-data text-[var(--color-ink)]">₹{taxDisplay.toFixed(2)}</span></div>
            <div className="flex justify-between w-64 items-center">
              <span>Discount (₹):</span> 
              <Input type="number" step="0.01" min="0" className="w-24 !py-1" value={discount} onChange={(e) => setDiscount(e.target.value || '0')} />
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}