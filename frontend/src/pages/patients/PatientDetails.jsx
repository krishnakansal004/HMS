import { useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Activity, AlertCircle, HeartPulse, 
  CalendarClock, BedDouble, FileStack, FlaskConical, Scan, Receipt, History, Plus,Clock
} from 'lucide-react';
import { useAsync } from '../../hooks/useAsync.js';
import { patientsApi } from '../../api/patients.js';
import { appointmentsApi } from '../../api/appointments.js';
import { admissionsApi } from '../../api/admissions.js';
import { prescriptionsApi } from '../../api/prescriptions.js';
import { labApi } from '../../api/lab.js';
import { radiologyApi } from '../../api/radiology.js';
import { invoicesApi } from '../../api/invoices.js';
import Card, { CardHeader, CardBody } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { Spinner, ErrorState, EmptyState } from '../../components/ui/Table.jsx';
import { formatDate, formatDateTime, fullName } from '../../utils/format.js';
import { useAuthStore } from '../../store/authStore.js';
import { ROLES } from '../../utils/roles.js';

// Drawers (You will create/update these next)
import PrescriptionDrawer from '../prescriptions/PrescriptionDrawer.jsx';

export default function PatientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isDoctor = user?.role === ROLES.DOCTOR;

  const [activeTab, setActiveTab] = useState('overview');
  const [prescriptionOpen, setPrescriptionOpen] = useState(false);

  // 1. Fetch Core Patient Profile
  const { data: response, loading, error } = useAsync(() => patientsApi.getById(id), [id]);
  const patient = response?.data;

  // 2. Fetch Unified Timeline Data
  const { data: timelineData, loading: timelineLoading, refetch: refetchTimeline } = useAsync(async () => {
    const results = await Promise.allSettled([
      appointmentsApi.list({ patientId: id, limit: 20 }),
      admissionsApi.list({ patientId: id, limit: 5 }),
      prescriptionsApi.list({ patientId: id, limit: 20 }),
      labApi.listOrders({ patientId: id, limit: 20 }),
      radiologyApi.listOrders({ patientId: id, limit: 20 }),
      invoicesApi.list({ patientId: id, limit: 20 })
    ]);
    
    const safeData = (res) => res.status === 'fulfilled' && res.value ? (res.value.data || res.value.invoices || []) : [];
    
    return {
      appointments: safeData(results[0]),
      admissions: safeData(results[1]),
      prescriptions: safeData(results[2]),
      labs: safeData(results[3]),
      radiologies: safeData(results[4]),
      invoices: safeData(results[5]),
    };
  }, [id], `patient_timeline_${id}`);

  // 3. Compile and sort all records chronologically
  const timeline = useMemo(() => {
    if (!timelineData) return [];
    const items = [];
    
    timelineData.appointments.forEach(a => items.push({ id: `appt-${a.appointment_id}`, type: 'Appointment', date: a.slot_start, title: `Consultation (${a.type.replace('_', ' ')})`, subtitle: `Dr. ${a.doctor_name_snapshot}`, status: a.status }));
    timelineData.admissions.forEach(a => items.push({ id: `adm-${a.admission_id}`, type: 'Admission', date: a.admission_date, title: `Inpatient Admission`, subtitle: a.diagnosis, status: a.status }));
    timelineData.prescriptions.forEach(p => items.push({ id: `rx-${p.prescription_id}`, type: 'Prescription', date: p.created_at, title: `Prescription Issued`, subtitle: `Dr. ${p.doctor_profile?.users?.name || 'Unknown'}`, status: p.approval_status }));
    timelineData.labs.forEach(l => items.push({ id: `lab-${l.lab_order_id}`, type: 'Lab', date: l.created_at, title: l.test_name_snapshot, subtitle: `Code: ${l.test_code_snapshot}`, status: l.sample_status }));
    timelineData.radiologies.forEach(r => items.push({ id: `rad-${r.radiology_order_id}`, type: 'Radiology', date: r.created_at, title: r.study_type, subtitle: r.modality, status: r.status }));
    timelineData.invoices.forEach(i => items.push({ id: `inv-${i.invoice_id}`, type: 'Invoice', date: i.created_at, title: `Invoice #${i.invoice_number}`, subtitle: `Total: ₹${(i.total/100).toFixed(2)}`, status: i.status }));
    
    return items.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [timelineData]);

  if (loading) return <Spinner label="Loading patient chart..." />;
  if (error) return <ErrorState message={error} />;
  if (!patient) return <ErrorState message="Patient not found" />;

  // Check active admission status from the timeline data
  const activeAdmission = timelineData?.admissions?.find(a => a.status === 'admitted');

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Actions */}
      <div className="flex items-start justify-between gap-4 flex-wrap bg-[var(--color-surface)] p-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-sm">
        <div className="flex items-center gap-4">
          <Link to="/patients" className="p-2 rounded-full bg-[var(--color-paper)] hover:bg-[var(--color-border)] text-[var(--color-ink-soft)] transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
                {fullName(patient)}
              </h2>
              {activeAdmission ? (
                <StatusPill status="admitted" label={`Admitted - Bed ${activeAdmission.bed?.bed_number || 'TBD'}`} />
              ) : (
                <StatusPill status="discharged" label="Outpatient" tone="neutral" />
              )}
            </div>
            <p className="text-sm text-[var(--color-ink-soft)] mt-1 font-mono-data">
              ID: {patient.patient_id.toUpperCase().split('-')[0]} • {patient.gender} • {patient.date_of_birth ? `${new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} Yrs` : 'Age Unknown'}
            </p>
          </div>
        </div>
        
        {/* Doctor-Specific Actions */}
        <div className="flex gap-2">
          {isDoctor && (
            <>
              <Button onClick={() => setPrescriptionOpen(true)} icon={FileStack}>Prescribe</Button>
              <Button variant="secondary" icon={FlaskConical} onClick={() => navigate('/lab')}>Order Lab</Button>
            </>
          )}
          {!isDoctor && (
            <Button onClick={() => navigate('/appointments')} icon={CalendarClock}>Book Appt</Button>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-[var(--color-border)] gap-6 px-2">
        {['overview', 'timeline'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab 
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]' 
                : 'border-transparent text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card>
              <CardHeader title="Clinical History" action={<HeartPulse size={18} className="text-[var(--color-danger)]" />} />
              <CardBody className="flex flex-col gap-6">
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
                  <h4 className="text-sm font-semibold text-[var(--color-ink)] mb-2">Past Medical History</h4>
                  <p className="text-sm text-[var(--color-ink-soft)] whitespace-pre-wrap bg-[var(--color-paper)] p-4 rounded-md">
                    {patient.medical_history || 'No prior medical history recorded.'}
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="lg:col-span-1 flex flex-col gap-6">
            <Card>
              <CardHeader title="Demographics" action={<User size={18} className="text-[var(--color-primary)]" />} />
              <CardBody className="flex flex-col gap-4">
                <DetailRow label="Date of Birth" value={formatDate(patient.date_of_birth)} />
                <DetailRow label="Blood Group" value={patient.blood_group || '--'} />
                <DetailRow label="Phone" value={patient.phone} />
                <DetailRow label="Email" value={patient.email || '--'} />
                <DetailRow label="Emergency" value={patient.emergency_contact || '--'} />
                <DetailRow label="ABHA ID" value={patient.abha_id || '--'} />
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {/* Tab Content: Timeline */}
      {activeTab === 'timeline' && (
        <Card className="flex-1 min-h-[400px]">
          <CardHeader title="Unified Clinical Timeline" subtitle="Chronological history of interactions" action={<History size={18} className="text-[var(--color-primary)]" />} />
          <CardBody>
            {timelineLoading ? (
              <Spinner label="Syncing records..." />
            ) : timeline.length === 0 ? (
              <EmptyState icon={History} title="No Records Found" description="Appointments, labs, and invoices will appear here." />
            ) : (
              <div className="relative border-l-2 border-[var(--color-border-strong)] ml-4 pl-8 py-2 flex flex-col gap-8">
                {timeline.map((item) => (
                  <div key={item.id} className="relative">
                    <div className="absolute -left-[49px] top-0 bg-[var(--color-surface)] py-1">
                      <TimelineIcon type={item.type} />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 bg-[var(--color-paper)] p-4 rounded-[var(--radius-md)] border border-[var(--color-border)]">
                      <div>
                        <h4 className="text-[15px] font-semibold text-[var(--color-ink)]">{item.title}</h4>
                        <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">{item.subtitle}</p>
                        <p className="text-xs text-[var(--color-ink-faint)] mt-2 font-mono-data flex items-center gap-2">
                          <Clock size={12} /> {formatDateTime(item.date)}
                        </p>
                      </div>
                      <StatusPill status={item.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Drawers */}
      {isDoctor && (
        <PrescriptionDrawer 
          open={prescriptionOpen} 
          onClose={() => setPrescriptionOpen(false)} 
          onSaved={refetchTimeline}
          prefilledPatient={patient}
        />
      )}
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

function TimelineIcon({ type }) {
  const ICONS = {
    Appointment: <CalendarClock size={16} />, Admission: <BedDouble size={16} />, Prescription: <FileStack size={16} />,
    Lab: <FlaskConical size={16} />, Radiology: <Scan size={16} />, Invoice: <Receipt size={16} />
  };
  const COLORS = {
    Appointment: 'bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)] border-[var(--color-primary)]',
    Admission: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger)]',
    Prescription: 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]',
    Lab: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning)]',
    Radiology: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] border-[var(--color-accent)]',
    Invoice: 'bg-white text-[var(--color-ink-soft)] border-[var(--color-border-strong)]'
  };

  return (
    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm z-10 ${COLORS[type] || COLORS.Invoice}`}>
      {ICONS[type]}
    </div>
  );
}