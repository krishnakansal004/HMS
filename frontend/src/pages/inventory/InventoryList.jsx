import { useState } from 'react';
import { Pill, Plus, AlertTriangle, MinusCircle } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { inventoryApi } from '../../api/inventory.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import DispenseModal from './DispenseModal.jsx';
import MedicineDrawer from './MedicineDrawer.jsx';
import Drawer from '../../components/ui/Drawer.jsx';
import { formatDateTime } from '../../utils/format.js';

export default function InventoryList() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dispensingMed, setDispensingMed] = useState(null);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data, loading, error, refetch } = useAsync(
    () => inventoryApi.list({ search: search || undefined, limit: 50 }),
    [search]
  );
  const medicines = data?.data || [];

  function handleSearchSubmit(e) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Pharmacy Inventory</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Manage stock, dispensations, and low-stock alerts</p>
        </div>
        <Button icon={Plus} onClick={() => setDrawerOpen(true)}>Add Medicine</Button>
      </div>

      <Card>
        <div className="p-4 border-b border-[var(--color-border)]">
          <form onSubmit={handleSearchSubmit} className="flex gap-2 max-w-md">
            <Input
              placeholder="Search by medicine name or batch..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant="secondary">Search</Button>
          </form>
        </div>

        {loading ? (
          <Spinner label="Loading inventory..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : medicines.length === 0 ? (
          <EmptyState 
            icon={Pill} 
            title="No medicines found in inventory" 
            description={search ? "Try clearing your search." : "Add your first medicine to establish the catalog."}
            action={!search && <Button size="sm" icon={Plus} onClick={() => setDrawerOpen(true)}>Add Medicine</Button>}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Medicine</Th>
              <Th>Batch / Expiry</Th>
              <Th>Stock Level</Th>
              <Th>Price (₹)</Th>
              <Th className="text-right">Actions</Th>
            </Thead>
            <tbody>
              {medicines.map((med) => {
                const isLowStock = med.quantity <= med.reorder_level;
                return (
                  <Tr key={med.medicine_id}>
                    <Td>
                      <button
                        type="button"
                        className="font-medium text-[var(--color-primary)] hover:underline text-left"
                        onClick={() => setSelectedMedicine(med)}
                      >
                        {med.name}
                      </button>
                      <p className="text-xs text-[var(--color-ink-faint)]">Supplier: {med.supplier?.name || 'Unknown'}</p>
                    </Td>
                    <Td>
                      <p className="font-mono-data text-sm">{med.batch_number}</p>
                      <p className="text-xs text-[var(--color-ink-faint)]">Exp: {new Date(med.expiry_date).toLocaleDateString()}</p>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono-data font-semibold ${isLowStock ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}`}>
                          {med.quantity} Units
                        </span>
                        {isLowStock && <AlertTriangle size={14} className="text-[var(--color-danger)]" title="Low Stock!" />}
                      </div>
                    </Td>
                    <Td className="font-mono-data">{Number(med.selling_price || 0).toFixed(2)}</Td>
                    <Td className="text-right">
                      <Button size="sm" variant="secondary" icon={MinusCircle} onClick={() => setDispensingMed(med)} disabled={med.quantity <= 0}>
                        Dispense
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <MedicineDrawer 
        open={drawerOpen} 
        onClose={() => setDrawerOpen(false)} 
        onSaved={refetch} 
      />
      {dispensingMed && (
        <DispenseModal 
          medicine={dispensingMed} 
          open={!!dispensingMed} 
          onClose={() => setDispensingMed(null)} 
          onSaved={refetch} 
        />
      )}
      <MedicineDetailsDrawer
        medicine={selectedMedicine}
        onClose={() => setSelectedMedicine(null)}
      />
    </div>
  );
}

function MedicineDetailsDrawer({ medicine, onClose }) {
  if (!medicine) return null;

  const detailRows = [
    ['SKU / Item Code', medicine.sku],
    ['Category', medicine.category],
    ['Supplier', medicine.supplier?.name],
    ['Supplier Phone', medicine.supplier?.contact_phone],
    ['Batch Number', medicine.batch_number],
    ['Expiry Date', medicine.expiry_date ? new Date(medicine.expiry_date).toLocaleDateString('en-IN') : '—'],
    ['Purchase Price', `₹${Number(medicine.purchase_price || 0).toFixed(2)}`],
    ['Selling Price', `₹${Number(medicine.selling_price || 0).toFixed(2)}`],
    ['GST Rate', `${Number(medicine.gst_rate || 0).toFixed(2)}%`],
    ['Current Stock', `${medicine.quantity ?? 0} units`],
    ['Low Stock Alert', `${medicine.reorder_level ?? 0} units`],
    ['Added', formatDateTime(medicine.created_at)],
    ['Last Updated', formatDateTime(medicine.updated_at)],
  ];

  return (
    <Drawer open={!!medicine} onClose={onClose} title={medicine.name} size="md">
      <div className="flex flex-col gap-5">
        <div className="rounded-[var(--radius-md)] bg-[var(--color-paper)] p-4">
          <p className="text-xs uppercase tracking-wider text-[var(--color-ink-faint)]">Medicine details</p>
          <p className="mt-1 font-mono-data text-sm text-[var(--color-ink-soft)]">{medicine.medicine_id}</p>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {detailRows.map(([label, value]) => (
            <div key={label} className="border-b border-[var(--color-border)] pb-3">
              <dt className="text-xs text-[var(--color-ink-faint)]">{label}</dt>
              <dd className="mt-1 text-sm font-medium text-[var(--color-ink)]">{value || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Drawer>
  );
}