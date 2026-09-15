import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Stethoscope, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { doctorsApi } from '../../api/doctors.js';
import { availabilityApi, DAY_LABELS } from '../../api/availability.js';
import Card, { CardHeader, CardBody } from '../../components/ui/Card.jsx';
import { Spinner, ErrorState } from '../../components/ui/Table.jsx';

export default function DoctorDetails() {
  const { id } = useParams();
  
  // Fetch both Doctor Profile and their Schedule in parallel
  const { data: docRes, loading: docLoading, error: docError } = useAsync(() => doctorsApi.getById(id), [id]);
  const { data: availRes, loading: availLoading } = useAsync(() => availabilityApi.getByDoctor(id), [id]);

  const doctor = docRes?.data;
  const profile = doctor?.doctor_profile || {};
  const schedule = availRes?.data?.days || [];

  if (docLoading) return <Spinner label="Loading doctor profile..." />;
  if (docError) return <ErrorState message={docError} />;
  if (!doctor) return <ErrorState message="Doctor not found" />;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/doctors" className="p-2 rounded-full hover:bg-[var(--color-paper)] text-[var(--color-ink-soft)] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
            {profile.designation || 'Dr.'} {doctor.name}
          </h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">
            {profile.specialization} • {profile.department_label}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Demographics */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card>
            <CardHeader title="Profile" action={<Stethoscope size={18} className="text-[var(--color-primary)]" />} />
            <CardBody className="flex flex-col gap-4">
              <DetailRow label="Email" value={doctor.email} />
              <DetailRow label="Status" value={profile.active ? 'Active' : 'Inactive'} />
              <DetailRow label="Experience" value={`${profile.experience_years || 0} Years`} />
              <DetailRow label="Consultation Fee" value={`₹${profile.consultation_fee}`} />
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Weekly Schedule */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader title="Weekly Availability" action={<Clock size={18} className="text-[var(--color-accent)]" />} />
            <CardBody>
              {availLoading ? (
                <Spinner label="Loading schedule..." />
              ) : schedule.length === 0 ? (
                <p className="text-sm text-[var(--color-ink-soft)] italic">No schedule configured yet.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {schedule.map((day, idx) => (
                    <div key={idx} className={`flex items-center justify-between p-3 rounded-[var(--radius-sm)] border ${day.enabled ? 'border-[var(--color-border)] bg-[var(--color-surface)]' : 'border-dashed border-[var(--color-border-strong)] bg-[var(--color-paper)] opacity-60'}`}>
                      <div className="flex items-center gap-3 w-1/4">
                        {day.enabled ? <CheckCircle2 size={16} className="text-[var(--color-success)]" /> : <XCircle size={16} className="text-[var(--color-ink-faint)]" />}
                        <span className="text-sm font-semibold">{DAY_LABELS[day.dayOfWeek]}</span>
                      </div>
                      
                      <div className="flex-1 text-sm text-[var(--color-ink)]">
                        {day.enabled ? `${day.startTime} - ${day.endTime}` : 'Off Duty'}
                      </div>
                      
                      <div className="text-xs text-[var(--color-ink-faint)] text-right w-1/4">
                        {day.enabled ? `${day.slotDurationMin} min slots` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between items-start border-b border-[var(--color-border)] pb-3 last:border-0 last:pb-0">
      <span className="text-sm font-medium text-[var(--color-ink-soft)]">{label}</span>
      <span className="text-sm text-[var(--color-ink)] text-right max-w-[60%] font-medium">{value}</span>
    </div>
  );
}
