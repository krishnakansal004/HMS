import { useState } from 'react';
import { Plus, UserRound, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync.js';
import { doctorsApi } from '../../api/doctors.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import DoctorForm from './DoctorForm.jsx';
import { initials } from '../../utils/format.js';

export default function DoctorsList() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const { data, loading, error, refetch } = useAsync(() => doctorsApi.list(), []);
  
  const doctors = data?.data || [];

  function openCreate() {
    setEditingDoc(null);
    setFormOpen(true);
  }

  function openEdit(doc) {
    setEditingDoc(doc);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Medical Staff</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Manage doctors and consultants</p>
        </div>
        <Button icon={Plus} onClick={openCreate}>Register Doctor</Button>
      </div>

      <Card>
        {loading ? (
          <Spinner label="Loading doctors..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : doctors.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="No doctors registered yet"
            action={<Button size="sm" icon={Plus} onClick={openCreate}>Register Doctor</Button>}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Doctor</Th>
              <Th>Department</Th>
              <Th>Contact</Th>
              <Th>Fee</Th>
              <Th className="text-right">Actions</Th>
            </Thead>
            <tbody>
              {doctors.map((doc) => {
                const profile = doc.doctor_profile || {};
                return (
                  <Tr key={doc.user_id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="h-8 w-8 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)] flex items-center justify-center text-xs font-semibold shrink-0">
                          {initials(doc.name)}
                        </span>
                        <div>
                          <Link to={`/doctors/${doc.user_id}`} className="font-medium hover:text-[var(--color-primary)] hover:underline">
                            {profile.designation || 'Dr.'} {doc.name}
                          </Link>
                          <p className="text-xs text-[var(--color-ink-faint)] font-mono-data">
                            {profile.active ? 'Active' : 'Inactive'}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <p className="font-medium">{profile.department_label}</p>
                      <p className="text-xs text-[var(--color-ink-faint)]">{profile.specialization}</p>
                    </Td>
                    <Td>
                      <p>{doc.email}</p>
                      <p className="text-xs text-[var(--color-ink-faint)]">{doc.phone || 'N/A'}</p>
                    </Td>
                    <Td>₹{profile.consultation_fee}</Td>
                    <Td className="text-right">
                      <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEdit(doc)}>
                        Edit
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      <DoctorForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} doctor={editingDoc} />
    </div>
  );
}