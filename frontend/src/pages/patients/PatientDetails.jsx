import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, User, Activity, AlertCircle, HeartPulse, FileText, CalendarClock } from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { patientsApi } from '../../api/patients.js';
import Card, { CardHeader, CardBody } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { Spinner, ErrorState } from '../../components/ui/Table.jsx';
import { formatDate, fullName } from '../../utils/format.js';

export default function PatientDetails() {
  const { id } = useParams();
  const { data: response, loading, error } = useAsync(() => patientsApi.getById(id), [id]);
  const patient = response?.data;

  if (loading) return <Spinner label="Loading patient ledger..." />;
  if (error) return <ErrorState message={error} />;
  if (!patient) return <ErrorState message="Patient not found" />;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/patients" className="p-2 rounded-full hover:bg-[var(--color-paper)] text-[var(--color-ink-soft)] transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
            {fullName(patient)}
          </h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5 font-mono-data">
            ID: {patient.patient_id}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button icon={CalendarClock}>Book Appointment</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Demographics & ABDM */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card>
            <CardHeader title="Demographics" action={<User size={18} className="text-[var(--color-primary)]" />} />
            <CardBody className="flex flex-col gap-4">
              <DetailRow label="Date of Birth" value={formatDate(patient.date_of_birth)} />
              <DetailRow label="Gender" value={patient.gender} />
              <DetailRow label="Blood Group" value={patient.blood_group || '—'} />
              <DetailRow label="Phone" value={patient.phone} />
              <DetailRow label="Email" value={patient.email || '—'} />
              <DetailRow label="Emergency Contact" value={patient.emergency_contact || '—'} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Digital Health (ABDM)" action={<Activity size={18} className="text-[var(--color-accent)]" />} />
            <CardBody className="flex flex-col gap-4">
              <DetailRow label="ABHA Number" value={patient.abha_id ? formatAbha(patient.abha_id) : 'Not linked'} />
              <DetailRow label="ABHA Address" value={patient.abha_address || 'Not linked'} />
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Clinical History & Timeline */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <CardHeader title="Clinical Overview" action={<HeartPulse size={18} className="text-[var(--color-danger)]" />} />
            <CardBody className="flex flex-col gap-5">
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-ink)] flex items-center gap-2 mb-2">
                  <AlertCircle size={16} className="text-[var(--color-warning)]" />
                  Known Allergies
                </h4>
                <p className="text-sm text-[var(--color-ink-soft)] bg-[var(--color-warning-soft)] p-3 rounded-md border border-[var(--color-warning)]/20">
                  {patient.allergies || 'No known allergies reported.'}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-ink)] mb-2">Medical History</h4>
                <p className="text-sm text-[var(--color-ink-soft)] whitespace-pre-wrap">
                  {patient.medical_history || 'No prior medical history recorded.'}
                </p>
              </div>
            </CardBody>
          </Card>

          <Card className="flex-1 min-h-[300px]">
            <CardHeader title="Clinical Timeline" />
            <CardBody className="flex flex-col items-center justify-center text-center h-full py-10">
               <div className="h-12 w-12 rounded-full bg-[var(--color-paper)] text-[var(--color-ink-faint)] flex items-center justify-center mb-3">
                 <FileText size={24} />
               </div>
               <h3 className="font-display font-medium text-[var(--color-ink)]">Timeline Ready</h3>
               <p className="text-sm text-[var(--color-ink-soft)] mt-1 max-w-sm">
                 Prescriptions, Lab Orders, and Admissions will automatically populate here in Phase 3.
               </p>
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
      <span className="text-sm text-[var(--color-ink)] text-right max-w-[60%]">{value}</span>
    </div>
  );
}

// Helper to format ABHA ID as XX-XXXX-XXXX-XXXX for UI display
function formatAbha(id) {
  if (!id || id.length !== 14) return id;
  return `${id.slice(0, 2)}-${id.slice(2, 6)}-${id.slice(6, 10)}-${id.slice(10, 14)}`;
}