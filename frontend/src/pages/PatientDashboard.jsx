import { useProfileRender } from '../utils/profiler';

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { getMyAppointments, getMyPrescriptions, listMyInvoices, listMyReports } from '../services/api'
import { Calendar, Pill, FileText, Stethoscope, ChevronRight, Clock, MapPin, CreditCard, Activity, ArrowRight } from 'lucide-react'
import StatCard from '../components/common/StatCard'
import { motion } from 'framer-motion'
import PageContainer from '../components/Admin/PageContainer'

export default function PatientDashboard() {
    useProfileRender('PatientDashboard', true);
    const { user } = useAuth()
    const { hospitalSlug } = useParams()
    // Build the correct base path for portal navigation
    const portalBase = hospitalSlug ? `/portal/${hospitalSlug}` : (user?.tenantSlug ? `/portal/${user.tenantSlug}` : '')

    const { data: aptsData, isLoading: aptsLoading } = useQuery({
        queryKey: ['myAppointments'],
        queryFn: getMyAppointments,
        enabled: !!user,
    })

    const { data: presData, isLoading: presLoading } = useQuery({
        queryKey: ['myPrescriptions'],
        queryFn: getMyPrescriptions,
        enabled: !!user,
    })

    const { data: invData, isLoading: invLoading } = useQuery({
        queryKey: ['myInvoices'],
        queryFn: listMyInvoices,
        enabled: !!user,
    })

    const { data: repsData, isLoading: repsLoading } = useQuery({
        queryKey: ['myReports'],
        queryFn: listMyReports,
        enabled: !!user,
    })

    const appointments = useMemo(() => Array.isArray(aptsData) ? aptsData : [], [aptsData])
    const prescriptions = useMemo(() => Array.isArray(presData) ? presData : [], [presData])
    const invoices = useMemo(() => Array.isArray(invData) ? invData : [], [invData])
    const reports = useMemo(() => Array.isArray(repsData) ? repsData : [], [repsData])

    const loading = aptsLoading || presLoading || invLoading || repsLoading

    const upcoming = useMemo(() => {
        const now = new Date()
        return appointments
            .filter(a => a.status === 'scheduled' && a.slotStart && new Date(a.slotStart) > now)
            .sort((a, b) => new Date(a.slotStart) - new Date(b.slotStart))[0] || null
    }, [appointments])

    return (
        <PageContainer>
            {/* Hero Section */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 text-white shadow-xl shadow-blue-200/50">
                <div className="absolute top-0 right-0 p-12 opacity-10">
                    <Activity size={200} />
                </div>

                <div className="relative p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="space-y-4 max-w-2xl">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white shadow-sm">
                                Patient Portal
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-3xl md:text-4xl font-bold leading-tight">
                                Welcome back, {user?.name?.split(' ')[0]}!
                            </h1>
                            <p className="text-blue-50 text-base md:text-lg leading-relaxed opacity-90">
                                Track your health journey, manage appointments, and access your medical records securely from one place.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3 pt-2">
                            {upcoming ? (
                                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 flex items-center gap-4 pr-6">
                                    <div className="w-12 h-12 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg">
                                        <Calendar size={24} />
                                    </div>
                                    <div>
                                        <div className="text-xs text-blue-100 font-medium uppercase tracking-wide">Next Appointment</div>
                                        <div className="text-base font-bold">{new Date(upcoming.slotStart).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                                        <div className="text-sm text-blue-100">{new Date(upcoming.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} with Dr. {upcoming.doctor?.name}</div>
                                    </div>
                                </div>
                            ) : (
                                <Link to="/my-appointments" className="btn bg-white text-blue-600 border-none hover:bg-blue-50">
                                    Book Your First Appointment
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className="hidden md:block relative">
                        <div className="w-32 h-32 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center animate-pulse">
                            <Stethoscope size={64} className="text-white opacity-90" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <StatCard
                    label="Active Prescriptions"
                    value={loading ? '...' : prescriptions.length}
                    subtitle="View formulations"
                    icon={Pill}
                    iconColor="text-pink-600"
                    iconBg="bg-pink-50"
                    action={<Link to="/prescriptions" className="text-xs font-semibold text-pink-600 flex items-center gap-1 hover:underline mt-2">View All <ArrowRight size={12} /></Link>}
                />
                <StatCard
                    label="Medical Reports"
                    value={loading ? '...' : reports.length}
                    subtitle="Lab results & files"
                    icon={FileText}
                    iconColor="text-sky-600"
                    iconBg="bg-sky-50"
                    action={<Link to="/my-reports" className="text-xs font-semibold text-sky-600 flex items-center gap-1 hover:underline mt-2">Browse Files <ArrowRight size={12} /></Link>}
                />
                <StatCard
                    label="Paid Invoices"
                    value={loading ? '...' : invoices.length}
                    subtitle="Transaction history"
                    icon={CreditCard}
                    iconColor="text-amber-600"
                    iconBg="bg-amber-50"
                    action={<Link to="/my-billing" className="text-xs font-semibold text-amber-600 flex items-center gap-1 hover:underline mt-2">View History <ArrowRight size={12} /></Link>}
                />
                <StatCard
                    label="Appointments"
                    value={loading ? '...' : appointments.filter(a => a.status === 'completed').length}
                    subtitle="Completed visits"
                    icon={Calendar}
                    iconColor="text-emerald-600"
                    iconBg="bg-emerald-50"
                    action={<Link to="/my-appointments" className="text-xs font-semibold text-emerald-600 flex items-center gap-1 hover:underline mt-2">History <ArrowRight size={12} /></Link>}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Upcoming Schedule */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                    <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                <Clock size={20} />
                            </div>
                            <h3 className="font-bold text-slate-800">Upcoming Schedule</h3>
                        </div>
                        <Link to="/my-appointments" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                            View Calendar <ChevronRight size={16} />
                        </Link>
                    </div>

                    <div className="flex-1 min-h-[300px]">
                        {loading ? (
                            <div className="h-full flex items-center justify-center text-slate-400">Loading schedule...</div>
                        ) : appointments.filter(a => a.status === 'scheduled').length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50/30">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                                    <Calendar size={32} />
                                </div>
                                <h4 className="text-slate-900 font-semibold">No upcoming appointments</h4>
                                <p className="text-slate-500 text-sm mt-1 max-w-xs">You don't have any scheduled visits. Book a consultation with our doctors today.</p>
                                <Link to="/my-appointments" className="btn btn-primary mt-6">Book New Appointment</Link>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {appointments
                                    .filter(a => a.status === 'scheduled')
                                    .sort((a, b) => new Date(a.slotStart) - new Date(b.slotStart))
                                    .slice(0, 5)
                                    .map(a => (
                                        <div key={a._id} className="p-6 flex items-center gap-5 hover:bg-slate-50 transition-colors group">
                                            <div className="flex flex-col items-center justify-center w-16 h-18 rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
                                                <span className="text-xs font-bold uppercase text-slate-500 mt-1">{new Date(a.slotStart).toLocaleString('default', { month: 'short' })}</span>
                                                <span className="text-2xl font-bold text-slate-800 leading-none mb-1">{new Date(a.slotStart).getDate()}</span>
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-600 border border-blue-100">
                                                        {a.type || 'Consultation'}
                                                    </span>
                                                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                                        <Clock size={12} /> {new Date(a.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-slate-800 text-lg">Dr. {a.doctor?.name || 'Unknown Doctor'}</h4>
                                                <div className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                                                    Token #{a.tokenNumber} <span className="text-slate-300">•</span> {a.doctor?.specialty || 'General Physician'}
                                                </div>
                                            </div>

                                            <Link to="/my-appointments" className="btn btn-outline btn-sm transition-opacity">
                                                Details
                                            </Link>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                        <h3 className="font-bold text-slate-800 mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-1 gap-3">
                            <Link to="/my-appointments" className="group flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-indigo-200 bg-gradient-to-r from-white to-slate-50 hover:to-indigo-50 transition-all shadow-sm hover:shadow-md">
                                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <Calendar size={22} />
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-slate-800 text-sm">Book Appointment</div>
                                    <div className="text-xs text-slate-500 mt-0.5">Schedule a visit with a doctor</div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white text-slate-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    <ChevronRight size={16} />
                                </div>
                            </Link>

                            <Link to={`${portalBase}/find-doctors`} className="group flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-cyan-200 bg-gradient-to-r from-white to-slate-50 hover:to-cyan-50 transition-all shadow-sm hover:shadow-md">
                                <div className="w-12 h-12 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <Stethoscope size={22} />
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-slate-800 text-sm">Find Doctor</div>
                                    <div className="text-xs text-slate-500 mt-0.5">Search specialists near you</div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white text-slate-400 flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                                    <ChevronRight size={16} />
                                </div>
                            </Link>

                            <Link to="/my-reports" className="group flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-purple-200 bg-gradient-to-r from-white to-slate-50 hover:to-purple-50 transition-all shadow-sm hover:shadow-md">
                                <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <FileText size={22} />
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-slate-800 text-sm">Upload Reports</div>
                                    <div className="text-xs text-slate-500 mt-0.5">Save and organize medical docs</div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white text-slate-400 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                    <ChevronRight size={16} />
                                </div>
                            </Link>
                        </div>
                    </div>

                    {/* Tip Card */}
                    <div className="bg-gradient-to-br from-orange-100 to-amber-50 rounded-2xl p-6 border border-orange-100">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-orange-200 text-orange-700 flex items-center justify-center shrink-0">
                                <Activity size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-orange-900 text-sm">Health Tip</h4>
                                <p className="text-xs text-orange-800/80 mt-1 leading-relaxed">
                                    Maintain a balanced diet and stay hydrated! Regular check-ups help detect issues early.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageContainer>
    )
}

