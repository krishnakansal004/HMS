import { useState } from 'react';
import { Plus, BedDouble, UserMinus, UserCheck } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { wardsApi } from '../../api/wards.js';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Spinner, EmptyState, ErrorState } from '../../components/ui/Table.jsx';
import { toast } from '../../components/ui/Toast.jsx';

// Role-Based Access Control
import { useAuthStore } from '../../store/authStore.js';
import { ROLES } from '../../utils/roles.js';

// Modals
import WardForm from './WardForm.jsx';
import AddBedModal from './AddBedModal.jsx';
import AssignBedModal from './AssignBedModal.jsx';

export default function WardsList() {
  const user = useAuthStore((s) => s.user);
  
  // Backend RBAC matching: Only Admins/Directors can create Wards and Beds
  const canManageInfrastructure = user?.role === ROLES.HOSPITAL_ADMIN || user?.role === ROLES.DIRECTOR;
  
  // Backend RBAC matching: Doctors cannot manually assign/release beds
  const canManageBeds = [ROLES.HOSPITAL_ADMIN, ROLES.NURSE, ROLES.RECEPTIONIST, ROLES.DIRECTOR].includes(user?.role);

  const [wardFormOpen, setWardFormOpen] = useState(false);
  const [addBedWard, setAddBedWard] = useState(null);
  const [assignBed, setAssignBed] = useState(null);

  const { data, loading, error, refetch } = useAsync(() => wardsApi.list(), [], 'wards_list');
  const wards = data?.data || [];

  async function handleReleaseBed(bedId, bedNumber) {
    if (!window.confirm(`Are you sure you want to release bed ${bedNumber}?`)) return;
    try {
      await wardsApi.releaseBed(bedId);
      toast.success(`Bed ${bedNumber} is now available.`);
      refetch();
    } catch (err) {
      toast.error(err.message || 'Failed to release bed.');
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Wards & Beds</h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">Manage inpatient facility capacity</p>
        </div>
        
        {/* FIX 4: Add Ward button only visible to authorized roles */}
        {canManageInfrastructure && (
          <Button icon={Plus} onClick={() => setWardFormOpen(true)}>Add Ward</Button>
        )}
      </div>

      {loading ? (
        <Card className="py-12"><Spinner label="Loading facility data..." /></Card>
      ) : error ? (
        <Card className="py-12"><ErrorState message={error} onRetry={refetch} /></Card>
      ) : wards.length === 0 ? (
        <Card>
          <EmptyState
            icon={BedDouble}
            title="No Wards Configured"
            description={canManageInfrastructure ? "Create your first ward to start managing inpatient beds." : "No wards have been configured by the hospital administration yet."}
            action={canManageInfrastructure && <Button size="sm" icon={Plus} onClick={() => setWardFormOpen(true)}>Add Ward</Button>}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {wards.map(ward => {
            const isFull = ward.bed?.length >= ward.capacity;
            return (
              <Card key={ward.ward_id} className="overflow-hidden">
                <div className="bg-[var(--color-paper)] border-b border-[var(--color-border)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-[var(--color-ink)] flex items-center gap-2">
                      {ward.name}
                      <span className="text-[10px] bg-[var(--color-border-strong)] text-[var(--color-ink)] px-2 py-0.5 rounded-full uppercase tracking-widest">{ward.type}</span>
                    </h3>
                    <p className="text-xs text-[var(--color-ink-soft)] mt-1">
                      Floor: {ward.floor || 'N/A'} • Capacity: <span className="font-mono-data font-semibold">{ward.bed?.length || 0}/{ward.capacity}</span> Beds
                    </p>
                  </div>
                  
                  {/* FIX 4: Add Bed button only visible to authorized roles */}
                  {canManageInfrastructure && (
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      icon={Plus} 
                      onClick={() => setAddBedWard(ward)} 
                      disabled={isFull}
                    >
                      {isFull ? 'Ward Full' : 'Add Bed'}
                    </Button>
                  )}
                </div>

                <div className="p-5">
                  {(!ward.bed || ward.bed.length === 0) ? (
                    <p className="text-sm text-[var(--color-ink-faint)] text-center py-4 italic">No beds added to this ward yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                      {ward.bed.map(bed => (
                        <div 
                          key={bed.bed_id} 
                          className={`border rounded-[var(--radius-sm)] p-3 flex flex-col items-center justify-between text-center gap-3 transition-colors ${
                            bed.is_occupied 
                              ? 'border-[var(--color-danger)] bg-[var(--color-danger-soft)]' 
                              : 'border-[var(--color-success)] bg-[var(--color-success-soft)] hover:border-[var(--color-success)]/60'
                          }`}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <BedDouble size={24} className={bed.is_occupied ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'} />
                            <span className="font-mono-data font-semibold text-sm text-[var(--color-ink)]">{bed.bed_number}</span>
                          </div>
                          
                          {/* Assign / Release functionality locked to authorized roles */}
                          {canManageBeds ? (
                            <div className="w-full">
                              {bed.is_occupied ? (
                                <Button 
                                  size="sm" 
                                  variant="danger" 
                                  icon={UserMinus} 
                                  className="w-full text-[11px] h-7 px-0" 
                                  onClick={() => handleReleaseBed(bed.bed_id, bed.bed_number)}
                                >
                                  Release
                                </Button>
                              ) : (
                                <Button 
                                  size="sm" 
                                  variant="secondary" 
                                  icon={UserCheck} 
                                  className="w-full text-[11px] h-7 px-0 !text-[var(--color-success)] !border-[var(--color-success)] hover:!bg-[var(--color-success)] hover:!text-white" 
                                  onClick={() => setAssignBed(bed)}
                                >
                                  Assign
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] uppercase font-semibold text-[var(--color-ink-faint)] tracking-wider">
                              {bed.is_occupied ? 'Occupied' : 'Available'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Mounted Modals */}
      <WardForm open={wardFormOpen} onClose={() => setWardFormOpen(false)} onSaved={refetch} />
      <AddBedModal open={!!addBedWard} onClose={() => setAddBedWard(null)} ward={addBedWard} onSaved={refetch} />
      <AssignBedModal open={!!assignBed} onClose={() => setAssignBed(null)} bed={assignBed} onSaved={refetch} />
    </div>
  );
}