import { useState } from 'react';
import { Plus, BedDouble } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { wardsApi } from '../../api/wards.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import WardForm from './WardForm.jsx'; // <-- IMPORT THE FORM

export default function WardsList() {
  const [formOpen, setFormOpen] = useState(false); // <-- ADD MODAL STATE
  const { data, loading, error, refetch } = useAsync(() => wardsApi.list(), [], 'wards_list');
  const wards = data?.data || [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Wards & Beds</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Manage inpatient facility capacity</p>
        </div>
        {/* <-- WIRE THE ONCLICK HANDLER --> */}
        <Button icon={Plus} onClick={() => setFormOpen(true)}>Add Ward</Button>
      </div>

      <Card>
        {/* ... (Keep existing Table rendering logic from previous step) ... */}
      </Card>

      {/* <-- MOUNT THE MODAL --> */}
      <WardForm 
        open={formOpen} 
        onClose={() => setFormOpen(false)} 
        onSaved={refetch} 
      />
    </div>
  );
}