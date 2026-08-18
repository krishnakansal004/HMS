import { useState } from 'react';
import { Plus, UserRound } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { doctorsApi } from '../../api/doctors.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Table, Thead, Th, Tr, Td, Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import DoctorForm from './DoctorForm.jsx';

export default function DoctorsList() {
  const [formOpen, setFormOpen] = useState(false);
  
  const { data, loading, error, refetch } = useAsync(() => doctorsApi.list(), []);
  
  // FIX 1: Unwrap the data array from the API envelope
  const doctors = data?.data || []; 

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Medical Staff</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Manage doctors and consultants</p>
        </div>
        <Button icon={Plus} onClick={() => setFormOpen(true)}>Register Doctor</Button>
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
            description="Add your first doctor to allow patients to book appointments."
            action={<Button size="sm" icon={Plus} onClick={() => setFormOpen(true)}>Register Doctor</Button>}
          />
        ) : (
          <Table>
            <Thead>
              <Th>Doctor Name</Th>
              <Th>Department & Specialization</Th>
              <Th>Contact</Th>
              <Th>Fee</Th>
              <Th>Status</Th>
            </Thead>
            <tbody>
              {doctors.map((doc) => {
                // FIX 2: Map to Prisma's exact nested output structure
                const profile = doc.doctor_profile || {};
                
                return (
                  <Tr key={doc.user_id}>
                    <Td className="font-medium">{profile.designation || 'Dr.'} {doc.name}</Td>
                    <Td>
                      <p>{profile.department_label}</p>
                      <p className="text-xs text-[var(--color-ink-faint)]">{profile.specialization}</p>
                    </Td>
                    <Td>
                      <p>{doc.email}</p>
                      <p className="text-xs text-[var(--color-ink-faint)]">{doc.phone}</p>
                    </Td>
                    <Td>₹{profile.consultation_fee}</Td>
                    <Td>
                      <span className={`text-xs px-2 py-1 rounded-full ${profile.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {profile.active ? 'Active' : 'Inactive'}
                      </span>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <DoctorForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={refetch} />
    </div>
  );
}