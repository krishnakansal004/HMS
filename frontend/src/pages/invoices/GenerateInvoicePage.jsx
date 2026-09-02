import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Input, Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import Card, { CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { invoicesApi, INVOICE_ITEM_TYPES } from '../../api/invoices.js';
import { patientsApi } from '../../api/patients.js';
import { toast } from '../../components/ui/Toast.jsx';
import { fullName } from '../../utils/format.js';
import { Spinner } from '../../components/ui/Table.jsx';
import { useSessionDraft } from '../../hooks/useSessionDraft.js';
import { useLeaveGuard } from '../../hooks/useLeaveGuard.js';

const emptyItem = { entityType: 'OTHER', description: '', quantity: 1, unitPrice: '', gstRate: 0 };
const initialState = { patientId: '', items: [{ ...emptyItem }], discount: '0' };

export default function GenerateInvoicePage() {
  const navigate = useNavigate();
  // State backed by sessionStorage
  const [draft, setDraft, clearDraft] = useSessionDraft('invoice_draft', initialState);
  
  const [patients, setPatients] = useState([]);
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [saving, setSaving] = useState(false);

  // Check if form has been modified to trigger leave guard
  const isDirty = draft.patientId !== '' || draft.items.length > 1 || draft.items[0].description !== '' || draft.discount !== '0';
  useLeaveGuard(isDirty && !saving); // Disable guard while actively saving

  useEffect(() => {
    setLoadingDeps(true);
    patientsApi.list({ limit: 100 })
      .then(res => setPatients(res.data || []))
      .catch(() => toast.error('Failed to load patients'))
      .finally(() => setLoadingDeps(false));
  }, []);

  const subtotalDisplay = draft.items.reduce((sum, item) => sum + (Number(item.unitPrice) * Number(item.quantity)), 0);
  const taxDisplay = draft.items.reduce((sum, item) => {
    const lineTotal = Number(item.unitPrice) * Number(item.quantity);
    return sum + (lineTotal * (Number(item.gstRate) / 100));
  }, 0);
  const totalDisplay = subtotalDisplay + taxDisplay - Number(draft.discount);

  const addItem = () => setDraft(prev => ({ ...prev, items: [...prev.items, { ...emptyItem }] }));
  
  const updateItem = (index, field, value) => {
    setDraft(prev => {
      const newItems = [...prev.items];
      newItems[index][field] = value;
      return { ...prev, items: newItems };
    });
  };

  const removeItem = (index) => {
    setDraft(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!draft.patientId || draft.items.length === 0) return;
    if (totalDisplay < 0) {
      toast.error('Total cannot be negative. Check your discount.');
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        patientId: draft.patientId,
        discount: Math.round(Number(draft.discount) * 100),
        taxRate: 0, 
        items: draft.items.map(i => ({
          entityType: i.entityType,
          description: i.description.trim(),
          itemName: i.description.trim(),
          quantity: Number(i.quantity),
          unitPrice: Math.round(Number(i.unitPrice) * 100),
          gstRate: Number(i.gstRate)
        }))
      };
      await invoicesApi.create(payload);
      toast.success('Invoice generated successfully.');
      clearDraft(); // Wipe session storage on success
      navigate('/invoices', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Failed to generate invoice');
      setSaving(false);
    }
  }

  if (loadingDeps) return <Spinner label="Loading patients..." />;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/invoices" className="p-2 rounded-full hover:bg-[var(--color-paper)] text-[var(--color-ink-soft)] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Generate Invoice</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Create a new patient bill</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Patient Details" />
          <CardBody>
            <Select required value={draft.patientId} onChange={(e) => setDraft(p => ({ ...p, patientId: e.target.value }))}>
              <option value="">Choose a patient...</option>
              {patients.map(p => (
                <option key={p.patient_id} value={p.patient_id}>
                  {fullName(p)} {p.phone ? `(${p.phone})` : ''}
                </option>
              ))}
            </Select>
          </CardBody>
        </Card>

        <Card>
          <CardHeader 
            title="Line Items" 
            action={<Button size="sm" variant="secondary" icon={Plus} onClick={addItem}>Add Item</Button>} 
          />
          <CardBody className="flex flex-col gap-3">
            {draft.items.map((item, index) => (
              <div key={index} className="flex items-start gap-3 bg-[var(--color-paper)] p-3 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
                <Select className="w-40" value={item.entityType} onChange={(e) => updateItem(index, 'entityType', e.target.value)}>
                  {INVOICE_ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </Select>
                <Input
                  className="flex-1" placeholder="Description / Name" required
                  value={item.description} onChange={(e) => updateItem(index, 'description', e.target.value)}
                />
                <Input
                  type="number" min="1" className="w-20" placeholder="Qty" required
                  value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                />
                <Input
                  type="number" step="0.01" min="0" className="w-28" placeholder="Price (₹)" required
                  value={item.unitPrice} onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                />
                <Input
                  type="number" min="0" max="100" className="w-24" placeholder="GST %"
                  value={item.gstRate} onChange={(e) => updateItem(index, 'gstRate', e.target.value)}
                />
                <button type="button" onClick={() => removeItem(index)} className="p-2 mt-1 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] rounded-md transition-colors" disabled={draft.items.length === 1}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col items-end gap-2 text-sm text-[var(--color-ink-soft)]">
            <div className="flex justify-between w-64"><span>Subtotal:</span> <span className="font-mono-data text-[var(--color-ink)]">₹{subtotalDisplay.toFixed(2)}</span></div>
            <div className="flex justify-between w-64"><span>Taxes (GST):</span> <span className="font-mono-data text-[var(--color-ink)]">₹{taxDisplay.toFixed(2)}</span></div>
            <div className="flex justify-between w-64 items-center">
              <span>Discount (₹):</span> 
              <Input type="number" step="0.01" min="0" className="w-24 !py-1" value={draft.discount} onChange={(e) => setDraft(p => ({ ...p, discount: e.target.value || '0' }))} />
            </div>
            <div className="flex justify-between w-64 mt-3 pt-3 border-t border-[var(--color-border)] font-display font-semibold text-lg text-[var(--color-ink)]">
              <span>Net Total:</span> <span className="font-mono-data text-[var(--color-primary)]">₹{totalDisplay.toFixed(2)}</span>
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-3 sticky bottom-4 bg-[var(--color-paper)]/90 backdrop-blur-sm p-4 rounded-xl border border-[var(--color-border)] shadow-sm">
          <Button variant="ghost" onClick={() => navigate('/invoices')}>Cancel</Button>
          <Button type="submit" loading={saving} disabled={draft.items.length === 0 || !draft.patientId}>
            Generate & Save
          </Button>
        </div>
      </form>
    </div>
  );
}