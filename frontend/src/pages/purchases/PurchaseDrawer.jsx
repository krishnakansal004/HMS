import { useEffect, useState } from 'react';
import { Plus, Trash2, Truck } from 'lucide-react';
import Drawer from '../../components/ui/Drawer.jsx';
import Button from '../../components/ui/Button.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import { EmptyState, Spinner } from '../../components/ui/Table.jsx';
import { purchasesApi } from '../../api/purchases.js';
import { suppliersApi } from '../../api/suppliers.js';
import { inventoryApi } from '../../api/inventory.js';
import { toPaise } from '../../utils/format.js';
import { toast } from '../../components/ui/Toast.jsx';

const blankItem = { medicineId: '', quantity: '1', unitCost: '' };

export default function PurchaseDrawer({ open, onClose, onSaved, onRegisterSupplier }) {
  const [supplierId, setSupplierId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([{ ...blankItem }]);
  
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loadingDependencies, setLoadingDependencies] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingDependencies(true);
    Promise.all([suppliersApi.list(), inventoryApi.list({ limit: 500 })])
      .then(([supplierResponse, inventoryResponse]) => {
        setSuppliers(supplierResponse.data || []);
        setMedicines(inventoryResponse.data || []);
      })
      .catch((error) => toast.error(error.message || 'Unable to load purchase dependencies.'))
      .finally(() => setLoadingDependencies(false));
  }, [open]);

  function close() {
    setSupplierId('');
    setOrderId('');
    setOrderDate(new Date().toISOString().slice(0, 10));
    setItems([{ ...blankItem }]);
    onClose();
  }

  function updateItem(index, field, value) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  const addItem = () => setItems((current) => [...current, { ...blankItem }]);
  const removeItem = (index) => setItems((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index));

  const totalDisplay = items.reduce((sum, item) => sum + (Number(item.unitCost || 0) * Number(item.quantity || 0)), 0);

  async function submit(event) {
    event.preventDefault();
    if (!supplierId || !items.every((item) => item.medicineId && Number.isInteger(Number(item.quantity)) && Number(item.quantity) > 0 && item.unitCost !== '')) {
      toast.error('Select a supplier and complete every purchase line.');
      return;
    }
    if (new Set(items.map((item) => item.medicineId)).size !== items.length) {
      toast.error('Each medicine may appear only once in a purchase order.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        supplierId,
        orderId: orderId.trim() || undefined,
        orderDate,
        items: items.map((item) => ({ 
          medicineId: item.medicineId, 
          quantity: Number(item.quantity), 
          unitCost: toPaise(item.unitCost) 
        })),
      };
      await purchasesApi.create(payload);
      toast.success('Purchase order created. Advance it through the receiving workflow before stock changes.');
      onSaved();
      close();
    } catch (error) {
      toast.error(error.message || 'Unable to create purchase order.');
    } finally {
      setSaving(false);
    }
  }

  const missingSupplier = !loadingDependencies && suppliers.length === 0;
  const missingMedicine = !loadingDependencies && medicines.length === 0;

  return (
    <Drawer 
      open={open} 
      onClose={close} 
      title="Create Purchase Order" 
      size="xl" 
      footer={
        !missingSupplier && !missingMedicine && (
          <div className="flex items-center justify-between w-full">
            <div className="font-display font-semibold text-lg text-[var(--color-ink)]">
              Estimated Total: <span className="font-mono-data text-[var(--color-primary)]">₹{totalDisplay.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button onClick={submit} loading={saving}>Submit Order</Button>
            </div>
          </div>
        )
      }
    >
      {loadingDependencies ? (
        <Spinner label="Loading suppliers and inventory..." />
      ) : missingSupplier ? (
        <EmptyState title="No active suppliers" description="Register an active supplier before creating a purchase order." action={<Button onClick={onRegisterSupplier}>Register supplier</Button>} />
      ) : missingMedicine ? (
        <EmptyState title="No inventory medicines" description="Add the medicines that can be purchased before creating a purchase order." />
      ) : (
        <form id="purchase-form" onSubmit={submit} className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-[var(--color-ink)] uppercase tracking-wider mb-1">Vendor & Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Select label="Supplier" required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                <option value="">Choose supplier...</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.supplier_id} value={supplier.supplier_id}>{supplier.name}</option>
                ))}
              </Select>
              <Input label="Supplier Order Ref (Optional)" value={orderId} onChange={(event) => setOrderId(event.target.value)} maxLength={100} placeholder="e.g. PO-2026-89" />
              <Input label="Order Date" type="date" required value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3 mb-4">
              <h4 className="text-sm font-semibold text-[var(--color-ink)] uppercase tracking-wider">Purchase Lines</h4>
              <Button size="sm" variant="secondary" icon={Plus} onClick={addItem}>Add Line</Button>
            </div>
            
            <div className="flex flex-col gap-4">
              {items.map((item, index) => (
                <div key={index} className="flex flex-col gap-4 bg-[var(--color-paper)] p-5 rounded-[var(--radius-md)] border border-[var(--color-border)]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">
                      <Truck size={16} /> Item {index + 1}
                    </span>
                    <button type="button" onClick={() => removeItem(index)} className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] p-1.5 rounded transition-colors" disabled={items.length === 1}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <Select className="md:col-span-6" label="Medicine" required value={item.medicineId} onChange={(event) => updateItem(index, 'medicineId', event.target.value)}>
                      <option value="">Choose medicine...</option>
                      {medicines.map((medicine) => (
                        <option key={medicine.medicine_id} value={medicine.medicine_id}>
                          {medicine.name} (Batch: {medicine.batch_number})
                        </option>
                      ))}
                    </Select>
                    <Input className="md:col-span-3" label="Quantity" type="number" min="1" step="1" required value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} />
                    <Input className="md:col-span-3" label="Unit Cost (₹)" type="number" min="0" step="0.01" required value={item.unitCost} onChange={(event) => updateItem(index, 'unitCost', event.target.value)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>
      )}
    </Drawer>
  );
}