import { useState } from 'react';
import { Pill, Plus, AlertTriangle, MinusCircle } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { inventoryApi } from '../../api/inventory.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import DispenseModal from './DispenseModal.jsx';
import MedicineForm from './MedicineForm.jsx';
export default function InventoryList() {
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dispensingMed, setDispensingMed] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  
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
        {/* Medicine Modal */}
      <MedicineForm 
        open={formOpen} 
        onClose={() => setFormOpen(false)} 
        onSaved={refetch} 
      />
        <Button icon={Plus} onClick={() => setFormOpen(true)}>Add Medicine</Button>
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
          <EmptyState icon={Pill} title="No medicines found in inventory" />
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
                      <p className="font-medium text-[var(--color-ink)]">{med.name}</p>
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
                    <Td className="font-mono-data">{(med.selling_price / 100).toFixed(2)}</Td>
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

      {/* Dispense Modal */}
      {dispensingMed && (
        <DispenseModal 
          medicine={dispensingMed} 
          open={!!dispensingMed} 
          onClose={() => setDispensingMed(null)} 
          onSaved={refetch} 
        />
      )}
    </div>
  );
}