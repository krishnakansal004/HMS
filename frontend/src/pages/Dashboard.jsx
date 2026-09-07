import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users, CalendarClock, ClipboardList, BedDouble, ArrowRight, ArrowUpRight,
  FlaskConical, Receipt, PackageX, UserCheck, Construction, History, CreditCard, 
  Video, CheckCircle2, FileStack, Scan, Clock, Mic
} from 'lucide-react';
import { useAuthStore } from '../store/authStore.js';
import { useAsync } from '../hooks/useAsync.js';
import { patientsApi } from '../api/patients.js';
import { appointmentsApi } from '../api/appointments.js';
import { admissionsApi } from '../api/admissions.js';
import { wardsApi } from '../api/wards.js';
import { inventoryApi } from '../api/inventory.js';
import { labApi } from '../api/lab.js';
import { invoicesApi, paymentsApi } from '../api/invoices.js';
import { attendanceApi } from '../api/attendance.js';
import { prescriptionsApi } from '../api/prescriptions.js';
import { radiologyApi } from '../api/radiology.js';
import Card, { CardHeader, CardBody } from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import StatusPill from '../components/ui/StatusPill.jsx';
import { Table, Thead, Th, Td, Tr, Spinner, ErrorState, EmptyState } from '../components/ui/Table.jsx';
import { navForRole } from '../utils/navConfig.js';
import { ROLE_LABELS, ROLES } from '../utils/roles.js';
import { fullName, formatPaise, formatDateTime, formatDate } from '../utils/format.js';
import { loadRazorpay } from '../utils/loadRazorpay.js';
import { toast } from '../components/ui/Toast.jsx';

function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

const TODAY = new Date().toISOString().slice(0, 10);

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);
  if (user?.role === ROLES.PATIENT) return <PatientDashboard user={user} />;
  return <StaffDashboard user={user} />;
}

// PATIENT DASHBOARD (THE SECURE EHR VAULT)
function PatientDashboard({ user }) {
  const navigate = useNavigate();

  const { data: apptsData, loading: apptsLoading, error: apptsError } = useAsync(() => appointmentsApi.list({ limit: 10 }), [], 'pat_appts');
  const { data: invoicesData, loading: invLoading, error: invError, refetch: refetchInvs } = useAsync(() => invoicesApi.list({ status: 'pending', limit: 10 }), [], 'pat_invs');
  
  const { data: timelineData, loading: timelineLoading, error: timelineError } = useAsync(async () => {
    const results = await Promise.allSettled([
      prescriptionsApi.list({ limit: 10 }),
      labApi.listOrders({ limit: 10 }),
      radiologyApi.listOrders({ limit: 10 })
    ]);
    const safeData = (res) => res.status === 'fulfilled' && res.value ? res.value.data : [];
    return { prescriptions: safeData(results[0]), labs: safeData(results[1]), radiologies: safeData(results[2]) };
  }, [], 'pat_timeline');

  const appts = apptsData?.data || [];
  const pendingInvoices = invoicesData?.data || invoicesData?.invoices || [];
  const upcomingAppt = appts.find(a => ['scheduled', 'confirmed'].includes(a.status) && new Date(a.slot_start) >= new Date());
  
  const [payingId, setPayingId] = useState(null);

  async function handleOnlinePayment(invoiceId) {
    setPayingId(invoiceId);
    try {
      const isLoaded = await loadRazorpay();
      if (!isLoaded) throw new Error('Failed to load payment gateway. Check your connection.');

      const { data } = await paymentsApi.initiate(invoiceId);

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: user.tenantName || 'Hospital Billing',
        description: 'Online Medical Bill Payment',
        order_id: data.orderId,
        prefill: { name: data.patient.name, email: data.patient.email, contact: data.patient.contact },
        theme: { color: '#0ea5e9' },
        handler: function () {
          toast.success('Payment successful! Processing receipt...');
          refetchInvs();
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (res) => toast.error(`Payment Failed: ${res.error.description}`));
      rzp.open();
    } catch (err) {
      toast.error(err.message || 'Unable to initiate payment.');
    } finally {
      setPayingId(null);
    }
  }

  const timeline = useMemo(() => {
    if (!timelineData) return [];
    const items = [];
    timelineData.prescriptions.forEach(p => items.push({ id: `rx-${p.prescription_id}`, type: 'Prescription', date: p.created_at, title: `Prescription Issued`, subtitle: `Dr. ${p.doctor_profile?.users?.name || 'Unknown'}`, status: p.approval_status }));
    timelineData.labs.forEach(l => items.push({ id: `lab-${l.lab_order_id}`, type: 'Lab', date: l.created_at, title: l.test_name_snapshot, subtitle: `Code: ${l.test_code_snapshot}`, status: l.sample_status }));
    timelineData.radiologies.forEach(r => items.push({ id: `rad-${r.radiology_order_id}`, type: 'Radiology', date: r.created_at, title: r.study_type, subtitle: r.modality, status: r.status }));
    return items.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [timelineData]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">Welcome, {user.name.split(' ')[0]}</h2>
        <p className="text-sm text-[var(--color-ink-soft)] mt-1">Your secure health portal at {user.tenantName || 'the hospital'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-[var(--color-primary)]">
          <CardBody>
            <h3 className="text-xs font-bold text-[var(--color-ink-soft)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <CalendarClock size={16} /> Next Appointment
            </h3>
            {apptsLoading ? <Spinner size={16} label="Checking..." /> : upcomingAppt ? (
              <div>
                <p className="font-display text-xl font-bold text-[var(--color-ink)]">{formatDate(upcomingAppt.slot_start)}</p>
                <p className="text-sm font-medium text-[var(--color-ink-soft)] mt-1">{new Date(upcomingAppt.slot_start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">Dr. {upcomingAppt.doctor_name_snapshot}</p>
                    <p className="text-xs text-[var(--color-ink-faint)] capitalize">{upcomingAppt.type.replace('_', ' ')} Consultation</p>
                  </div>
                  {upcomingAppt.type === 'online' && (
                    <Button size="sm" icon={Video} onClick={() => alert('Telemedicine integration pending Phase C provider selection.')}>Join Call</Button>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState title="No upcoming appointments" description="Need to see a doctor? Book a visit." action={<Button size="sm" onClick={() => navigate('/appointments')}>Book Appointment</Button>} />
            )}
            <div className="mt-5 p-4 border border-dashed border-[var(--color-border-strong)] rounded-[var(--radius-md)] bg-[var(--color-paper)]">
               <div className="flex items-start gap-3">
                 <div className="h-8 w-8 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center shrink-0">
                   <Mic size={16} />
                 </div>
                 <div>
                   <p className="text-sm font-medium text-[var(--color-ink)]">Voice Symptoms Upload</p>
                   <p className="text-xs text-[var(--color-ink-soft)] mt-1">Record your symptoms before your visit to help doctors prepare.</p>
                   <Button size="sm" variant="secondary" className="mt-2" disabled>Record Audio (Coming Soon)</Button>
                 </div>
               </div>
            </div>
          </CardBody>
        </Card>

        <Card className={pendingInvoices.length > 0 ? "border-l-4 border-l-[var(--color-danger)]" : ""}>
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-[var(--color-ink-soft)] uppercase tracking-wider flex items-center gap-2">
                <Receipt size={16} /> Pending Bills
              </h3>
            </div>
            {invLoading ? <Spinner size={16} label="Checking bills..." /> : invError ? <ErrorState message="Could not load bills" /> : pendingInvoices.length > 0 ? (
              <div className="flex flex-col gap-3">
                {pendingInvoices.slice(0, 3).map(inv => {
                  const remaining = Number(inv.total) - Number(inv.amount_paid);
                  return (
                    <div key={inv.invoice_id} className="flex items-center justify-between p-3 bg-[var(--color-danger-soft)]/30 border border-[var(--color-danger)]/20 rounded-[var(--radius-sm)]">
                      <div>
                        <p className="font-mono-data font-bold text-[var(--color-ink)]">{formatPaise(remaining)}</p>
                        <p className="text-xs text-[var(--color-ink-soft)]">Invoice #{inv.invoice_number}</p>
                      </div>
                      <Button size="sm" variant="danger" icon={CreditCard} onClick={() => handleOnlinePayment(inv.invoice_id)} loading={payingId === inv.invoice_id} disabled={payingId !== null && payingId !== inv.invoice_id}>
                        Pay Now
                      </Button>
                    </div>
                  );
                })}
                {pendingInvoices.length > 3 && (
                  <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>View all {pendingInvoices.length} bills</Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-[var(--color-success)]">
                <div className="h-10 w-10 bg-[var(--color-success-soft)] rounded-full flex items-center justify-center mb-2">
                  <CheckCircle2 size={20} />
                </div>
                <p className="text-sm font-medium">All caught up!</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="flex-1 min-h-[400px]">
        <CardHeader title="My Medical Records" subtitle="Lab results, prescriptions, and radiology" action={<History size={18} className="text-[var(--color-primary)]" />} />
        <CardBody>
          {timelineLoading ? <Spinner label="Loading health records..." /> : timelineError ? <ErrorState message="Could not load medical records" /> : timeline.length === 0 ? (
            <EmptyState icon={History} title="No Records Found" description="Your clinical history will securely appear here." />
          ) : (
            <div className="relative border-l-2 border-[var(--color-border-strong)] ml-4 pl-8 py-2 flex flex-col gap-6">
              {timeline.map((item) => (
                <div key={item.id} className="relative">
                  <div className="absolute -left-[49px] top-0 bg-[var(--color-surface)] py-1">
                    <TimelineIcon type={item.type} />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[var(--color-paper)] p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 transition-colors cursor-pointer">
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--color-ink)]">{item.title}</h4>
                      <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">{item.subtitle}</p>
                      <p className="text-[11px] text-[var(--color-ink-faint)] mt-1 font-mono-data flex items-center gap-1.5">
                        <Clock size={10} /> {formatDate(item.date)}
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
    </div>
  );
}
// ... (KEEP StaffDashboard, TimelineIcon, StatCard, AttentionRow, RoadmapNote EXACTLY AS THEY WERE) ...

// STAFF DASHBOARD
function StaffDashboard({ user }) {
  const visible = useMemo(() => new Set(navForRole(user?.role).map((i) => i.key)), [user?.role]);

  const patients = useAsync(
    () => (visible.has('patients') ? patientsApi.list({ limit: 1 }) : Promise.resolve(null)),
    [visible.has('patients')],
    'dash_patients'
  );
  
  const appts = useAsync(
    () => (visible.has('appointments') ? appointmentsApi.list({ date: TODAY, limit: 8 }) : Promise.resolve(null)),
    [visible.has('appointments')],
    'dash_appts'
  );

  const admissions = useAsync(
    () => (visible.has('admissions') ? admissionsApi.list({ status: 'admitted', limit: 1 }) : Promise.resolve(null)),
    [visible.has('admissions')],
    'dash_admissions'
  );

  const wards = useAsync(
    () => (visible.has('wards') ? wardsApi.list() : Promise.resolve(null)),
    [visible.has('wards')],
    'dash_wards'
  );

  const lowStock = useAsync(
    () => (visible.has('inventory') ? inventoryApi.list({ lowStock: true, limit: 5 }) : Promise.resolve(null)),
    [visible.has('inventory')],
    'dash_lowstock'
  );

  const pendingLab = useAsync(
    () => (visible.has('lab') ? labApi.listOrders({ status: 'pending', limit: 1 }) : Promise.resolve(null)),
    [visible.has('lab')],
    'dash_lab'
  );

  const pendingInvoices = useAsync(
    () => (visible.has('invoices') ? invoicesApi.list({ status: 'pending', limit: 1 }) : Promise.resolve(null)),
    [visible.has('invoices')],
    'dash_invoices'
  );

  const onDuty = useAsync(
    () => (visible.has('attendance') ? attendanceApi.list({ status: 'PRESENT', startDate: TODAY, endDate: TODAY, limit: 6 }) : Promise.resolve(null)),
    [visible.has('attendance')],
    'dash_attendance'
  );

  const bedStats = useMemo(() => {
    if (!wards.data?.data) return null;
    let total = 0;
    let occupied = 0;
    for (const ward of wards.data.data) {
      total += ward.bed?.length || 0;
      occupied += ward.bed?.filter((b) => b.is_occupied).length || 0;
    }
    return { total, occupied, pct: total ? Math.round((occupied / total) * 100) : 0 };
  }, [wards.data]);

  const quickLinks = navForRole(user?.role).filter((i) => i.key !== 'dashboard').slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
          Welcome back, {user?.name?.split(' ')[0] || user?.email}
        </h2>
        <p className="text-sm text-[var(--color-ink-soft)] mt-1">
          Signed in as {ROLE_LABELS[user?.role] || user?.role}
          {user?.tenantSlug ? ` | ${user.tenantSlug}` : ''} | {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {visible.has('patients') && (
          <StatCard icon={Users} label="Total patients" state={patients} value={patients.data?.total} to="/patients" />
        )}
        {visible.has('appointments') && (
          <StatCard icon={CalendarClock} label="Appointments today" state={appts} value={appts.data?.total} to="/appointments" />
        )}
        {visible.has('admissions') && (
          <StatCard icon={ClipboardList} label="Active admissions" state={admissions} value={admissions.data?.total} to="/admissions" />
        )}
        {visible.has('wards') && (
          <StatCard
            icon={BedDouble}
            label="Bed occupancy"
            state={wards}
            value={bedStats ? `${bedStats.occupied}/${bedStats.total}` : undefined}
            suffix={bedStats ? `${bedStats.pct}%` : undefined}
            to="/wards"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {visible.has('appointments') && (
          <Card className="lg:col-span-2">
            <CardHeader
              title="Today's appointments"
              subtitle={appts.data?.total ? `${appts.data.total} scheduled for ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : undefined}
              action={
                <Link to="/appointments" className="text-xs font-medium text-[var(--color-primary)] hover:underline flex items-center gap-1">
                  View all <ArrowRight size={12} />
                </Link>
              }
            />
            {appts.loading ? (
              <Spinner label="Loading appointments..." />
            ) : appts.error ? (
              <ErrorState message={appts.error} onRetry={appts.refetch} />
            ) : !appts.data?.data?.length ? (
              <EmptyState icon={CalendarClock} title="No appointments scheduled for today" />
            ) : (
              <Table>
                <Thead>
                  <Th>Patient</Th>
                  <Th>Doctor</Th>
                  <Th>Type</Th>
                  <Th>Time</Th>
                  <Th>Status</Th>
                </Thead>
                <tbody>
                  {[...appts.data.data].reverse().map((a) => (
                    <Tr key={a.appointment_id}>
                      <Td className="font-medium">{fullName(a.patient)}</Td>
                      <Td>{a.doctor_name_snapshot}</Td>
                      <Td className="capitalize">{a.type?.replace(/_/g, ' ') || ''}</Td>
                      <Td>{formatTime(a.slot_start)}</Td>
                      <Td><StatusPill status={a.status} /></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        )}

        {visible.has('wards') && (
          <Card>
            <CardHeader title="Ward occupancy" subtitle="Live bed utilisation" />
            <CardBody className="flex flex-col gap-4">
              {wards.loading ? (
                <Spinner label="Loading wards..." />
              ) : wards.error ? (
                <ErrorState message={wards.error} onRetry={wards.refetch} />
              ) : !wards.data?.data?.length ? (
                <EmptyState icon={BedDouble} title="No wards set up yet" />
              ) : (
                wards.data.data.map((ward) => {
                  const total = ward.bed?.length || 0;
                  const occ = ward.bed?.filter((b) => b.is_occupied).length || 0;
                  const pct = total ? Math.round((occ / total) * 100) : 0;
                  const tone = pct >= 90 ? 'var(--color-danger)' : pct >= 70 ? 'var(--color-accent)' : 'var(--color-primary)';
                  
                  return (
                    <div key={ward.ward_id}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-medium text-[var(--color-ink)]">{ward.name}</span>
                        <span className="font-mono-data text-xs" style={{ color: tone }}>{occ}/{total} | {pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--color-paper)] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone }} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardBody>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(visible.has('inventory') || visible.has('lab') || visible.has('invoices')) && (
          <Card>
            <CardHeader title="Needs attention" />
            <CardBody className="flex flex-col gap-4">
              {visible.has('inventory') && (
                <AttentionRow
                  icon={PackageX}
                  tone="danger"
                  label="Low stock medicines"
                  state={lowStock}
                  to="/inventory"
                  render={() =>
                    lowStock.data?.data?.length ? (
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {lowStock.data.data.map((m) => (
                          <li key={m.medicine_id} className="flex items-center justify-between text-xs">
                            <span className="text-[var(--color-ink)]">{m.name}</span>
                            <span className="font-mono-data text-[var(--color-danger)]">{m.quantity} left | reorder at {m.reorder_level}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[var(--color-ink-soft)] mt-1">All stock levels healthy.</p>
                    )
                  }
                />
              )}
              {visible.has('lab') && (
                <AttentionRow
                  icon={FlaskConical}
                  tone="warning"
                  label="Pending lab orders"
                  state={pendingLab}
                  to="/lab"
                  value={pendingLab.data?.total}
                />
              )}
              {visible.has('invoices') && (
                <AttentionRow
                  icon={Receipt}
                  tone="accent"
                  label="Pending invoices"
                  state={pendingInvoices}
                  to="/invoices"
                  value={pendingInvoices.data?.total}
                />
              )}
            </CardBody>
          </Card>
        )}

        {visible.has('attendance') && (
          <Card>
            <CardHeader
              title="On duty today"
              subtitle={onDuty.data?.total !== undefined ? `${onDuty.data.total} checked in` : undefined}
              action={
                <Link to="/attendance" className="text-xs font-medium text-[var(--color-primary)] hover:underline flex items-center gap-1">
                  View all <ArrowRight size={12} />
                </Link>
              }
            />
            <CardBody>
              {onDuty.loading ? (
                <Spinner label="Loading attendance..." />
              ) : onDuty.error ? (
                <ErrorState message={onDuty.error} onRetry={onDuty.refrefetch} />
              ) : !onDuty.data?.data?.length ? (
                <EmptyState icon={UserCheck} title="No check-ins recorded yet today" />
              ) : (
                <ul className="flex flex-col gap-3">
                  {onDuty.data.data.map((r) => (
                    <li key={r.attendance_id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)] flex items-center justify-center text-xs font-semibold">
                          {(r.users?.name || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}
                        </div>
                        <span className="font-medium text-[var(--color-ink)]">{r.users?.name || 'Unknown'}</span>
                      </div>
                      <StatusPill status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        )}
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <h3 className="font-display font-semibold text-[15px]">Quick access</h3>
        </div>
        <CardBody className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {quickLinks.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3.5 py-3 text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] transition-colors"
            >
              <item.icon size={16} className="text-[var(--color-primary)]" />
              {item.label}
            </Link>
          ))}
        </CardBody>
      </Card>
      
      <RoadmapNote />
    </div>
  );
}

// HELPER COMPONENTS

function TimelineIcon({ type }) {
  const ICONS = {
    Prescription: <FileStack size={14}/>,
    Lab: <FlaskConical size={14}/>,
    Radiology: <Scan size={14}/>
  };
  return (
    <div className="h-8 w-8 rounded-full border shadow-sm flex items-center justify-center bg-white text-[var(--color-ink-soft)] border-[var(--color-border-strong)] z-10">
      {ICONS[type] || <History size={14}/>}
    </div>
  );
}

function StatCard({ icon: Icon, label, state, value, suffix, to }) {
  return (
    <Card>
      <CardBody>
        {state.loading ? (
          <Spinner label={`Loading...`} />
        ) : state.error ? (
          <ErrorState message={state.error} onRetry={state.refetch} />
        ) : (
          <Link to={to} className="flex items-center justify-between group">
            <div>
              <p className="text-xs font-medium text-[var(--color-ink-soft)] uppercase tracking-wide">{label}</p>
              <p className="font-display text-3xl font-semibold text-[var(--color-ink)] mt-1">
                {value ?? '--'}
                {suffix && <span className="text-base font-medium text-[var(--color-ink-soft)] ml-1.5">{suffix}</span>}
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center">
                <Icon size={18} />
              </div>
              <ArrowUpRight size={14} className="text-[var(--color-ink-faint)] group-hover:text-[var(--color-primary)] transition-colors" />
            </div>
          </Link>
        )}
      </CardBody>
    </Card>
  );
}

const ATTENTION_TONES = {
  danger: { bg: 'bg-[var(--color-danger-soft)]', text: 'text-[var(--color-danger)]' },
  warning: { bg: 'bg-[var(--color-warning-soft)]', text: 'text-[var(--color-warning)]' },
  accent: { bg: 'bg-[var(--color-accent-soft)]', text: 'text-[var(--color-accent)]' },
};

function AttentionRow({ icon: Icon, tone, label, state, to, value, render }) {
  const t = ATTENTION_TONES[tone] || ATTENTION_TONES.accent;
  return (
    <Link to={to} className="flex flex-col gap-1 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
          <div className={`h-7 w-7 rounded-full flex items-center justify-center ${t.bg} ${t.text}`}>
            <Icon size={14} />
          </div>
          {label}
        </div>
        {state.loading ? (
          <span className="text-xs text-[var(--color-ink-faint)]">...</span>
        ) : state.error ? (
          <span className="text-xs text-[var(--color-danger)]">error</span>
        ) : value !== undefined ? (
          <span className="font-mono-data text-sm font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-primary)]">{value}</span>
        ) : null}
      </div>
      {render && !state.loading && !state.error && render()}
    </Link>
  );
}

function RoadmapNote() {
  return (
    <Card>
      <CardBody className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] flex items-center justify-center">
          <Construction size={16} />
        </div>
        <div>
          <p className="font-medium text-sm text-[var(--color-ink)]">More dashboard widgets are coming with later phases</p>
          <p className="text-xs text-[var(--color-ink-soft)] mt-1 max-w-2xl">
            A 7-day admissions/discharge trend, a live activity feed, and a full multi-department
            staff roster all need backend work that isn't live yet (a dashboard aggregation
            endpoint, an exposed audit-log route, and the HR/Staff module respectively) — each is
            sitting in <code className="font-mono-data text-[11px] bg-[var(--color-paper)] px-1 py-0.5 rounded">backend/_legacy-archive/</code> or
            on the roadmap, not forgotten. They'll be added here as each phase ships.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

// import { useAuthStore } from '../store/authStore.js';
// import { ROLES } from '../utils/roles.js';

// import PatientDashboard from './dashboard/PatientDashboard.jsx';
// import FrontDeskDashboard from './dashboard/FrontDeskDashboard.jsx';
// import ClinicalDashboard from './dashboard/ClinicalDashboard.jsx';
// import FinanceDashboard from './dashboard/FinanceDashboard.jsx';
// import PharmacyDashboard from './dashboard/PharmacyDashboard.jsx';
// import DiagnosticsDashboard from './dashboard/DiagnosticsDashboard.jsx';
// import ExecutiveDashboard from './dashboard/ExecutiveDashboard.jsx';

// import LegacyStaffDashboard from './dashboard/LegacyStaffDashboard.jsx';

// export default function Dashboard() {
//   const user = useAuthStore((s) => s.user);

//   switch (user?.role) {
//     case ROLES.PATIENT:
//       return <PatientDashboard user={user} />;
      
//     case ROLES.HOSPITAL_ADMIN:
//     case ROLES.RECEPTIONIST:
//     case ROLES.HR: // Map HR to Front Desk for now as it handles Attendance/Admissions
//       return <FrontDeskDashboard user={user} />;
      
//     case ROLES.DOCTOR:
//     case ROLES.NURSE:
//       return <ClinicalDashboard user={user} />;
      
//     case ROLES.ACCOUNTANT:
//     case ROLES.CASHIER:
//       return <FinanceDashboard user={user} />;
      
//     case ROLES.PHARMACIST:
//     case ROLES.STORE_MANAGER:
//       return <PharmacyDashboard user={user} />;
      
//     case ROLES.LAB_TECHNICIAN:
//     case ROLES.RADIOLOGY_TECHNICIAN:
//       return <DiagnosticsDashboard user={user} />;
      
//     case ROLES.DIRECTOR:
//     case ROLES.SYSTEM_OWNER:
//       return <ExecutiveDashboard user={user} />;
      
//     default:
//       // Failsafe for unforeseen roles
//       return <LegacyStaffDashboard user={user} />;
//   }
// }