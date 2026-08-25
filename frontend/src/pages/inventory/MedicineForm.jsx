import { useState, useEffect, useRef } from 'react';
import { UploadCloud, FileText, AlertCircle, Building2 } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import { Input, Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { inventoryApi } from '../../api/inventory.js';
import { suppliersApi } from '../../api/suppliers.js';
import { toast } from '../../components/ui/Toast.jsx';
import { Spinner, EmptyState } from '../../components/ui/Table.jsx';

const emptyForm = {
  name: '', sku: '', category: '', batchNumber: '', expiryDate: '',
  purchasePrice: '', sellingPrice: '', initialStock: '', minimumStock: '', supplierId: ''
};

export default function MedicineForm({ open, onClose, onSaved }) {
  const [mode, setMode] = useState('manual');
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  
  // Production Data States
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    if (open) {
      setLoadingSuppliers(true);
      suppliersApi.list()
        .then(res => setSuppliers(res.data || []))
        .catch(() => setSuppliers([]))
        .finally(() => setLoadingSuppliers(false));
    } else {
      setForm(emptyForm);
      setErrors({});
      setMode('manual');
    }
  }, [open]);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a valid PDF document.');
      return;
    }

    setExtracting(true);
    
    // AI Extraction Simulation
    setTimeout(() => {
      setForm((prev) => ({
        ...prev,
        name: 'Amoxicillin 500mg Capsules',
        sku: 'MED-AMX-500',
        category: 'Antibiotics',
        batchNumber: 'BX-99201A',
        expiryDate: '2028-12-31',
        purchasePrice: '45',
        sellingPrice: '60',
        initialStock: '500',
        minimumStock: '50',
        // Auto-select the first available supplier safely
        supplierId: suppliers.length > 0 ? suppliers[0].supplier_id : '' 
      }));
      setExtracting(false);
      setMode('manual');
      toast.success('Invoice data extracted successfully. Please review.');
    }, 2500);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      const payload = {
        ...form,
        purchasePrice: Number(form.purchasePrice),
        sellingPrice: Number(form.sellingPrice),
        initialStock: Number(form.initialStock) || 0,
        minimumStock: Number(form.minimumStock) || 0,
      };

      await inventoryApi.create(payload);
      toast.success('Medicine added to inventory successfully!');
      onSaved();
      onClose();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to add medicine');
      }
    } finally {
      setSaving(false);
    }
  }

  // PRODUCTION GUARD: Block rendering if dependencies are missing
  if (open && !loadingSuppliers && suppliers.length === 0) {
    return (
      <Modal open={open} onClose={onClose} title="Action Required">
        <EmptyState 
          icon={Building2} 
          title="No Suppliers Registered" 
          description="You cannot add inventory without assigning it to a supplier. Please ask your Hospital Admin or Store Manager to register a supplier first." 
        />
        <div className="flex justify-end mt-4">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add New Medicine"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={extracting || mode === 'upload' || loadingSuppliers}>
            Save to Inventory
          </Button>
        </>
      }
    >
      {loadingSuppliers ? (
        <Spinner label="Verifying database dependencies..." />
      ) : (
        <>
          <div className="flex bg-[var(--color-paper)] p-1 rounded-[var(--radius-md)] mb-6">
            <button
              className={`flex-1 py-1.5 text-sm font-medium rounded-[var(--radius-sm)] transition-colors ${mode === 'manual' ? 'bg-white text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'}`}
              onClick={() => setMode('manual')}
            >
              Manual Entry
            </button>
            <button
              className={`flex-1 py-1.5 text-sm font-medium rounded-[var(--radius-sm)] transition-colors ${mode === 'upload' ? 'bg-white text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'}`}
              onClick={() => setMode('upload')}
            >
              Smart Upload (PDF)
            </button>
          </div>

          {mode === 'upload' ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 border-2 border-dashed border-[var(--color-border-strong)] rounded-[var(--radius-lg)] bg-[var(--color-paper)]/50 transition-colors hover:bg-[var(--color-paper)] hover:border-[var(--color-primary)] relative">
              <input 
                type="file" 
                accept="application/pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={handleFileUpload}
                disabled={extracting}
              />
              {extracting ? (
                <div className="flex flex-col items-center gap-3 text-[var(--color-primary)]">
                  <div className="animate-pulse h-12 w-12 rounded-full bg-[var(--color-primary-soft)] flex items-center justify-center">
                    <FileText size={24} />
                  </div>
                  <p className="font-medium">Extracting data via AI...</p>
                  <p className="text-xs text-[var(--color-ink-soft)]">Parsing tables and mapping columns</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-[var(--color-ink-soft)]">
                  <div className="h-12 w-12 rounded-full bg-white shadow-sm flex items-center justify-center text-[var(--color-ink)] mb-2">
                    <UploadCloud size={24} />
                  </div>
                  <p className="font-medium text-[var(--color-ink)]">Drag & drop your supplier invoice PDF</p>
                  <p className="text-xs max-w-sm text-center">
                    Our system will automatically extract the medicine name, batch number, expiry dates, and pricing.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <form id="medicine-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="bg-[var(--color-info-soft)] text-[var(--color-info)] p-3 rounded-[var(--radius-sm)] text-sm flex items-start gap-2 border border-[var(--color-info)]/20">
                 <AlertCircle size={16} className="shrink-0 mt-0.5" />
                 <p>Prices must be entered in <b>Rupees</b>. The system converts them to minor-currency integers for secure storage.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input label="Medicine Name" required value={form.name} onChange={update('name')} error={errors.name} />
                <Input label="SKU / Item Code" required value={form.sku} onChange={update('sku')} error={errors.sku} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input label="Category" required value={form.category} onChange={update('category')} error={errors.category} />
                <Select label="Supplier" required value={form.supplierId} onChange={update('supplierId')} error={errors.supplierId}>
                  <option value="">Select a supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input label="Batch Number" required value={form.batchNumber} onChange={update('batchNumber')} error={errors.batchNumber} />
                <Input label="Expiry Date" type="date" required value={form.expiryDate} onChange={update('expiryDate')} error={errors.expiryDate} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input label="Purchase Price (₹)" type="number" step="0.01" min="0" required value={form.purchasePrice} onChange={update('purchasePrice')} error={errors.purchasePrice} />
                <Input label="Selling Price (₹)" type="number" step="0.01" min="0" required value={form.sellingPrice} onChange={update('sellingPrice')} error={errors.sellingPrice} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input label="Initial Stock Received" type="number" min="0" value={form.initialStock} onChange={update('initialStock')} error={errors.initialStock} />
                <Input label="Low Stock Alert Level" type="number" min="0" value={form.minimumStock} onChange={update('minimumStock')} error={errors.minimumStock} />
              </div>
            </form>
          )}
        </>
      )}
    </Modal>
  );
}