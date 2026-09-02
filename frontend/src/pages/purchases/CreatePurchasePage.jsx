import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Input, Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import Card, { CardHeader, CardBody } from '../../components/ui/Card.jsx';
import { purchasesApi } from '../../api/purchases.js';
import { suppliersApi } from '../../api/suppliers.js';
import { inventoryApi } from '../../api/inventory.js';
import { toast } from '../../components/ui/Toast.jsx';
import { Spinner, EmptyState } from '../../components/ui/Table.jsx';
import { toPaise } from '../../utils/format.js';
import { useSessionDraft } from '../../hooks/useSessionDraft.js';
import { useLeaveGuard } from '../../hooks/useLeaveGuard.js';
import AddSupplierModal from './AddSupplierModal.jsx'; // Overlay retained for context

const blankItem = { medicineId: '', quantity: '1', unitCost: '' };
const initialState = { supplierId: '', orderId: '', orderDate: new Date().toISOString().slice(0, 10), items: [{ ...blankItem }] };

export default function CreatePurchasePage() {
  const navigate = useNavigate();
  const [draft, setDraft, clearDraft] = useSessionDraft('purchase_draft', initialState);
  
  const [suppliers, setSuppliers] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loadingDependencies, setLoadingDependencies] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);

  const isDirty = draft.supplierId !== '' || draft.orderId !== '' || draft.items.length > 1 || draft.items[0].medicineId !== '';
  useLeaveGuard(isDirty && !saving);

  const loadDependencies = () => {
    setLoadingDependencies(true);
    Promise.all([suppliersApi.list(), inventoryApi.list({ limit: 500 })])
      .then(([suppRes, invRes]) => {
        setSuppliers(suppRes.data || []);
        setMedicines(invRes.data || []);
      })
      .catch((error) => toast.error(error.message || 'Unable to load dependencies.'))
      .finally(() => setLoadingDependencies(false));
  };

  useEffect(() => {
    loadDependencies();
  }, []);

  const totalDisplay = draft.items.reduce((sum, item) => sum + (Number(item.unitCost || 0) * Number(item.quantity || 0)), 0);

  const updateDraft = (field, value) => setDraft(prev => ({ ...prev, [field]: value }));
  const addItem = () => setDraft(prev => ({ ...prev, items: [...prev.items, { ...blankItem }] }));
  const updateItem = (index, field, value) => {
    setDraft(prev => {
      const newItems = [...prev.items];
      newItems[index][field] = value;
      return { ...prev, items: newItems };
    });
  };
  const removeItem = (index) => setDraft(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

  async function submit(event) {
    event.preventDefault();
    if (!draft.supplierId || !draft.items.every((i) => i.medicineId && Number(i.quantity) > 0 && i.unitCost !== '')) {
      toast.error('Select a supplier and complete every purchase line.');
      return;
    }
    
    if (new Set(draft.items.map((i) => i.medicineId)).size !== draft.items.length) {
      toast.error('Each medicine may appear only once in a purchase order.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        supplierId: draft.supplierId,
        orderId: draft.orderId.trim() || undefined,
        orderDate: draft.orderDate,
        items: draft.items.map((i) => ({
           medicineId: i.medicineId,
           quantity: Number(i.quantity),
           unitCost: toPaise(i.unitCost)
        })),
      };
      await purchasesApi.create(payload);
      toast.success('Purchase order created successfully.');
      clearDraft();
      navigate('/purchases', { replace: true });
    } catch (error) {
      toast.error(error.message || 'Unable to create purchase order.');
      setSaving(false);
    }
  }

  if (loadingDependencies) return <Spinner label="Loading suppliers and inventory..." />;
  if (suppliers.length === 0) return (
    <>
      <EmptyState title="No active suppliers" description="Register an active supplier before creating a PO." action={<Button onClick={() => setSupplierModalOpen(true)}>Register supplier</Button>} />
      <AddSupplierModal open={supplierModalOpen} onClose={() => setSupplierModalOpen(false)} onSaved={loadDependencies} />
    </>
  );

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/purchases" className="p-2 rounded-full hover:bg-[var(--color-paper)] text-[var(--color-ink-soft)] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Create Purchase Order</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Draft and submit a new PO</p>
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Vendor & Details" />
          <CardBody className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Select required value={draft.supplierId} onChange={(e) => updateDraft('supplierId', e.target.value)}>
              <option value="">Choose supplier...</option>
              {suppliers.map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>)}
            </Select>
            <Input label="Supplier Order Ref (Optional)" value={draft.orderId} onChange={(e) => updateDraft('orderId', e.target.value)} placeholder="e.g. PO-2026-89" />
            <Input label="Order Date" type="date" required value={draft.orderDate} onChange={(e) => updateDraft('orderDate', e.target.value)} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Purchase Lines" action={<Button size="sm" variant="secondary" icon={Plus} onClick={addItem}>Add Line</Button>} />
          <CardBody className="flex flex-col gap-4">
            {draft.items.map((item, index) => (
              <div key={index} className="flex items-center gap-3 bg-[var(--color-paper)] p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
                <Select className="flex-1" required value={item.medicineId} onChange={(e) => updateItem(index, 'medicineId', e.target.value)}>
                  <option value="">Select medicine to restock...</option>
                  {medicines.map(m => (
                    <option key={m.medicine_id} value={m.medicine_id}>{m.name} (Batch: {m.batch_number})</option>
                  ))}
                </Select>
                <Input type="number" min="1" className="w-24" placeholder="Qty" required value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} />
                <Input type="number" step="0.01" min="0" className="w-32" placeholder="Unit Cost (₹)" required value={item.unitCost} onChange={(e) => updateItem(index, 'unitCost', e.target.value)} />
                <button type="button" onClick={() => removeItem(index)} className="p-2 mt-1 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] rounded-md transition-colors" disabled={draft.items.length === 1}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </CardBody>
        </Card>

        <div className="flex items-center justify-between sticky bottom-4 bg-[var(--color-paper)]/90 backdrop-blur-sm p-4 rounded-xl border border-[var(--color-border)] shadow-sm">
          <div className="font-display font-semibold text-lg text-[var(--color-ink)]">
            Est. Total: <span className="font-mono-data text-[var(--color-primary)]">₹{totalDisplay.toFixed(2)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate('/purchases')}>Cancel</Button>
            <Button type="submit" loading={saving}>Submit Order</Button>
          </div>
        </div>
      </form>
      <AddSupplierModal open={supplierModalOpen} onClose={() => setSupplierModalOpen(false)} onSaved={loadDependencies} />
    </div>
  );
}