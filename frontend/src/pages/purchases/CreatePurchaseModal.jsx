import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { purchasesApi } from '../../api/purchases.js';
import { suppliersApi } from '../../api/suppliers.js';
import { inventoryApi } from '../../api/inventory.js';
import { toast } from '../../components/ui/Toast.jsx';
import { Spinner } from '../../components/ui/Table.jsx';

const emptyItem = { medicineId: '', quantity: 1, unitCost: '' };

export default function CreatePurchaseModal({ open, onClose, onSaved }) {
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([{ ...emptyItem }]);
  
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLoadingDeps(true);
      Promise.all([
        suppliersApi.list(),
        inventoryApi.list({ limit: 500 }) // Fetching catalog to restock
      ])
      .then(([suppRes, medRes]) => {
        setSuppliers(suppRes.data || []);
        setMedicines(medRes.data || []);
      })
      .catch(() => toast.error('Failed to load supply chain dependencies'))
      .finally(() => setLoadingDeps(false));
    } else {
      setSupplierId('');
      setItems([{ ...emptyItem }]);
    }
  }, [open]);

  const totalDisplay = items.reduce((sum, item) => sum + (Number(item.unitCost) * Number(item.quantity)), 0);

  const addItem = () => setItems([...items, { ...emptyItem }]);
  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!supplierId || items.length === 0) return;

    setSaving(true);
    try {
      const payload = {
        supplierId,
        items: items.map(i => ({
          medicineId: i.medicineId,
          quantity: Number(i.quantity),
          unitCost: Math.round(Number(i.unitCost) * 100) // Convert to paise
        }))
      };

      await purchasesApi.create(payload);
      toast.success('Purchase order created successfully.');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to create purchase order');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Purchase Order"
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="font-display font-semibold text-lg text-[var(--color-ink)]">
            Est. Total: <span className="font-mono-data text-[var(--color-primary)]">₹{totalDisplay.toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} loading={saving} disabled={loadingDeps || items.length === 0 || !supplierId}>
              Submit PO
            </Button>
          </div>
        </div>
      }
    >
      {loadingDeps ? (
        <Spinner label="Loading suppliers and catalog..." />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Select label="Vendor / Supplier" required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Select a supplier...</option>
            {suppliers.map(s => (
              <option key={s.supplier_id} value={s.supplier_id}>{s.name} ({s.contact_phone})</option>
            ))}
          </Select>

          <div>
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 mb-3">
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">Order Items</h3>
              <Button size="sm" variant="secondary" icon={Plus} onClick={addItem}>Add Item</Button>
            </div>
            
            <div className="flex flex-col gap-3">
              {items.map((item, index) => (
                <div key={index} className="flex items-start gap-3 bg-[var(--color-paper)] p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
                  <Select className="flex-1" required value={item.medicineId} onChange={(e) => updateItem(index, 'medicineId', e.target.value)}>
                    <option value="">Select medicine to restock...</option>
                    {medicines.map(m => (
                      <option key={m.medicine_id} value={m.medicine_id}>{m.name} (Batch: {m.batch_number})</option>
                    ))}
                  </Select>
                  
                  <Input type="number" min="1" className="w-24" placeholder="Qty" required value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} />
                  <Input type="number" step="0.01" min="0" className="w-32" placeholder="Unit Cost (₹)" required value={item.unitCost} onChange={(e) => updateItem(index, 'unitCost', e.target.value)} />
                  
                  <button type="button" onClick={() => removeItem(index)} className="p-2 mt-1 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] rounded-md transition-colors" disabled={items.length === 1}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}