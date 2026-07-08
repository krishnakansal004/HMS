import { useProfileRender } from '../utils/profiler';
import { useEffect, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { doctorDashboard, listDoctorAttendance, markDoctorAttendance } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { todayStr } from '../utils/time'
import { Calendar, Clock, Users, Pill, FileText, CheckCircle, Activity, Heart, Stethoscope } from 'lucide-react'
import StatCard from '../components/common/StatCard'

export default function DoctorDashboard() {
    useProfileRender('DoctorDashboard', true);
    const { user } = useAuth()

    const { data: dashboardData, isLoading: loading, error: queryError } = useQuery({
        queryKey: ['doctorDashboard'],
        queryFn: doctorDashboard,
        enabled: !!user,
    })

    const error = queryError?.message || null
    const data = useMemo(() => dashboardData || null, [dashboardData])

    const counts = data?.counts || {}
    const cards = useMemo(() => ([
        { label: 'Today\'s Appointments', value: counts.todayAppointments || 0, color: 'text-indigo-600', bg: 'bg-indigo-50', icon: Calendar },
        { label: 'Next 7 Days', value: counts.next7Appointments || 0, color: 'text-cyan-600', bg: 'bg-cyan-50', icon: Clock },
        { label: 'Patients (30d)', value: counts.patientsSeen30d || 0, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Users },
        { label: 'Pending Prescriptions', value: counts.pendingPrescriptions || 0, color: 'text-amber-600', bg: 'bg-amber-50', icon: Pill },
        { label: 'Issued Today', value: counts.prescriptionsIssuedToday || 0, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50', icon: FileText }
    ]), [counts])

    // Gentle reminder to mark attendance once per day
    const today = useMemo(() => todayStr(), [])
    const { data: attendanceRecords } = useQuery({
        queryKey: ['doctorAttendance', today],
        queryFn: () => listDoctorAttendance({ date: today }),
        enabled: !!user,
    })

    useEffect(() => {
        if (!attendanceRecords) return
        const marked = Array.isArray(attendanceRecords) && attendanceRecords.some(r => r.date === today)
        if (!marked) {
            toast.info('Please mark attendance for today')
        }
    }, [attendanceRecords, today])

    return (
        <div className="space-y-8 pb-10">
            <Hero user={user} />
            {error && <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-100 text-sm">{error}</div>}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {cards.map(c => (
                    <StatCard
                        key={c.label}
                        label={c.label}
                        value={c.value}
                        icon={c.icon}
                        iconColor={c.color}
                        iconBg={c.bg}
                        loading={loading}
                    />
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <Upcoming appointments={data?.upcoming || []} loading={loading} />
                <PendingPrescriptions items={data?.pendingPrescriptions || []} loading={loading} />
                <Responsibilities />
            </div>

            <GlobalHealth />
            <InspirationalGallery />
        </div>
    )
}

function Hero({ user }) {
    return (
        <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-indigo-600 via-sky-600 to-teal-600 text-white shadow-lg">
            <div className="p-6 md:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
                <div className="max-w-xl">
                    <h1 className="text-3xl font-semibold leading-tight">Doctor Care Dashboard</h1>
                    <p className="text-white/90 mt-2 text-sm md:text-base leading-relaxed">Focused view of your clinical responsibilities, upcoming cases, prescription approvals and patient flow. Strive for compassionate, evidence-based care every day.</p>
                    <div className="flex gap-3 mt-6 flex-wrap">
                        <Link to="/appointments" className="btn bg-white/10 hover:bg-white/20 border-white/20 text-white btn-sm backdrop-blur-sm w-full sm:w-auto text-center">Manage Appointments</Link>
                        <Link to="/availability" className="btn bg-white/10 hover:bg-white/20 border-white/20 text-white btn-sm backdrop-blur-sm w-full sm:w-auto text-center">Edit Availability</Link>
                        <Link to="/prescription-templates" className="btn bg-white/10 hover:bg-white/20 border-white/20 text-white btn-sm backdrop-blur-sm w-full sm:w-auto text-center">Templates</Link>
                    </div>
                </div>
                <div className="hidden lg:grid grid-cols-3 gap-3 shrink-0 w-full md:w-auto">
                    <div className="w-24 h-24 rounded-xl bg-white/10 backdrop-blur border border-white/10 flex flex-col items-center justify-center text-center p-2">
                        <Users size={24} className="mb-2 opacity-80" />
                        <span className="text-[10px] uppercase tracking-wider opacity-70">Team</span>
                    </div>
                    <div className="w-24 h-24 rounded-xl bg-white/10 backdrop-blur border border-white/10 flex flex-col items-center justify-center text-center p-2">
                        <Stethoscope size={24} className="mb-2 opacity-80" />
                        <span className="text-[10px] uppercase tracking-wider opacity-70">Clinical</span>
                    </div>
                    <div className="w-24 h-24 rounded-xl bg-white/10 backdrop-blur border border-white/10 flex flex-col items-center justify-center text-center p-2">
                        <Heart size={24} className="mb-2 opacity-80" />
                        <span className="text-[10px] uppercase tracking-wider opacity-70">Care</span>
                    </div>
                </div>
            </div>
        </div>
    )
}



function Upcoming({ appointments, loading }) {
    return (
        <section className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">Upcoming Appointments</h2>
                <Link to="/appointments" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View All</Link>
            </div>
            <div className="p-0 flex-1">
                {loading ? <div className="p-6 text-slate-500 text-sm">Loading…</div> : appointments.length === 0 ? <div className="p-6 text-slate-500 text-sm">No upcoming appointments.</div> : (
                    <ul className="divide-y divide-slate-100">
                        {appointments.map(a => (
                            <li key={a.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 grid place-items-center">
                                        <Calendar size={18} />
                                    </div>
                                    <div>
                                        <div className="font-medium text-slate-900">{new Date(a.at).toLocaleString()}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">{a.patientName} • Token #{a.token}</div>
                                    </div>
                                </div>
                                <Link to="/appointments" className="btn btn-xs btn-outline">Open</Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    )
}

function PendingPrescriptions({ items, loading }) {
    return (
        <section className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">Pending Prescriptions</h2>
                <Link to="/prescriptions" className="text-xs font-medium text-indigo-600 hover:text-indigo-700">View All</Link>
            </div>
            <div className="p-0 flex-1">
                {loading ? <div className="p-6 text-slate-500 text-sm">Loading…</div> : items.length === 0 ? <div className="p-6 text-slate-500 text-sm">No pending approvals.</div> : (
                    <ul className="divide-y divide-slate-100">
                        {items.map(p => (
                            <li key={p.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div>
                                    <div className="font-medium text-sm text-slate-900">Rx #{p.id.slice(-6)}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">{new Date(p.createdAt).toLocaleDateString()}</div>
                                </div>
                                <Link to="/prescriptions" className="btn btn-xs btn-outline">Review</Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    )
}

function Responsibilities() {
    const responsibilities = [
        { title: 'Patient-Centered', desc: 'Listen actively and tailor plans.' },
        { title: 'Documentation', desc: 'Maintain precise records.' },
        { title: 'Stewardship', desc: 'Prescribe responsibly.' },
    ]
    return (
        <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-full">
            <h2 className="font-semibold text-slate-800 mb-4">Core Focus</h2>
            <ul className="space-y-4">
                {responsibilities.map(r => (
                    <li key={r.title} className="flex gap-3">
                        <div className="mt-0.5 w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center shrink-0">
                            <CheckCircle size={12} strokeWidth={3} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-900">{r.title}</div>
                            <div className="text-xs text-slate-500 leading-relaxed">{r.desc}</div>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    )
}

function GlobalHealth() {
    const stats = [
        { label: 'Chronic Disease', value: 'Rising globally; emphasize lifestyle.' },
        { label: 'Antibiotics', value: 'Reduce unnecessary prescriptions.' },
        { label: 'Telemedicine', value: 'Hybrid care models expanding.' },
        { label: 'Prevention', value: 'Vaccination & screening focus.' },
    ]
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Activity size={18} className="text-slate-400" />
                Global Health Snapshot
            </h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                {stats.map(s => (
                    <div key={s.label} className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="text-sm font-medium text-slate-700 mb-1">{s.label}</div>
                        <div className="text-xs text-slate-500 leading-relaxed">{s.value}</div>
                    </div>
                ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-4 text-center">Indicative trends only. Consult WHO / CDC sources for current statistics.</p>
        </div>
    )
}

function InspirationalGallery() {
    // Removed external images to keep it clean and robust, or could just keep a simple static section
    return null
}

// Deprecated SafeImage and MultiSourceImage as we simplified the gallery out for cleaner UI
