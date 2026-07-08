import { useProfileRender } from '../utils/profiler';
import { useEffect, useState, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { listDoctorPatients, updateAppointment, getAppointment, createPrescription, emailPrescription, cancelAppointment } from '../services/api'
import { toast } from 'react-toastify'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'
import {
    User, Calendar, Clock, Loader2, Pill, Search,
    MoreVertical, Phone, Mail, MapPin, Video, Link,
    Plus, ChevronRight, ChevronDown, CheckCircle, XCircle
} from 'lucide-react'

export default function DoctorPatients() {
    useProfileRender('DoctorPatients', true);
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [expanded, setExpanded] = useState({}) // track which patient rows are expanded to show all appointments

    // -- TanStack Query --
    const { data: patients = [], isLoading, error: patientsError, refetch } = useQuery({
        queryKey: ['doctorPatients'],
        queryFn: listDoctorPatients,
    })

    const updateAppointmentMutation = useMutation({
        mutationFn: ({ id, payload }) => updateAppointment(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['doctorPatients'] })
        }
    })

    const manageMeetingLink = useCallback(async (entry) => {
        const appt = entry.nextAppointment || entry.latestAppointment
        if (!appt) return toast.error('No appointment found for this patient')
        if (appt.type !== 'online') return toast.error('Meeting link only for online appointments')
        const current = appt.meetingLink || ''
        const link = window.prompt('Enter meeting link URL', current)
        if (!link) return
        const sendEmail = window.confirm('Send meeting link email to patient now?')
        try {
            await updateAppointmentMutation.mutateAsync({ id: appt._id, payload: { meetingLink: link, sendMeetingEmail: !!sendEmail } })
            toast.success(sendEmail ? 'Meeting link saved & emailed' : 'Meeting link saved (email skipped)')
        } catch (e) {
            console.error('Failed to save meeting link', e)
            toast.error(e.message || 'Failed to save meeting link')
        }
    }, [updateAppointmentMutation])

    const manageMeetingLinkForAppointment = useCallback(async (appt) => {
        if (!appt) return toast.error('Appointment not found')
        if (appt.type !== 'online') return toast.error('Meeting link only for online appointments')
        const current = appt.meetingLink || ''
        const link = window.prompt('Enter meeting link URL', current)
        if (!link) return
        const sendEmail = window.confirm('Send meeting link email to patient now?')
        try {
            await updateAppointmentMutation.mutateAsync({ id: appt._id, payload: { meetingLink: link, sendMeetingEmail: !!sendEmail } })
            toast.success(sendEmail ? 'Meeting link saved & emailed' : 'Meeting link saved')
        } catch (e) {
            console.error('Failed to save meeting link', e)
            toast.error(e.message || 'Failed to save meeting link')
        }
    }, [updateAppointmentMutation])

    const toggleExpand = useCallback((patientId) => {
        setExpanded(prev => ({ ...prev, [patientId]: !prev[patientId] }))
    }, [])

    // New: Standardized "Prescribe" handler
    const handlePrescribe = useCallback((entry, appointment) => {
        // Open the prescriptions page with patient pre-filled so doctor can enter medicines/tests/notes
        const params = new URLSearchParams()
        const email = entry.email || appointment?.patientEmail || ''
        const name = entry.name || appointment?.patientName || ''
        const apptId = appointment?._id
        // Prefer explicit patient ID from entry or appointment
        const pId = entry.patientId || entry._id || appointment?.patient

        if (email) params.set('email', email)
        if (name) params.set('name', name)
        if (pId && typeof pId === 'string') params.set('patientId', pId)

        // Include appointment id so prescriptions page can autogenerate draft when configured
        if (apptId) params.set('appointmentId', apptId)
        // request autogeneration by default when arriving from patient row
        params.set('autogen', '1')
        navigate(`/doctor-prescriptions?${params.toString()}`)
    }, [navigate])

    return (
        <PageContainer>
            <PageHeader
                title="My Patients"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Patients' }]}
                actions={
                    <button className="btn btn-secondary flex items-center gap-2" onClick={() => refetch()} disabled={isLoading}>
                        <Loader2 size={16} className={isLoading ? 'animate-spin' : ''} />
                        Refresh List
                    </button>
                }
            />

            {patientsError ? (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
                    <XCircle size={18} />
                    {patientsError.message || 'Failed to load patients'}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm min-w-[1000px]">
                            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 w-10"></th>
                                    <th className="px-6 py-4">Patient</th>
                                    <th className="px-6 py-4">Contact</th>
                                    <th className="px-6 py-4">Next Appointment</th>
                                    <th className="px-6 py-4">Latest Visit</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {isLoading && patients.length === 0 ? (
                                    <tr><td colSpan={6} className="p-10 text-center text-slate-500">Loading patients...</td></tr>
                                ) : patients.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-slate-500">
                                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <User size={24} className="text-slate-400" />
                                            </div>
                                            No patients found.
                                        </td>
                                    </tr>
                                ) : patients.filter(p => p && p._id).map(p => {
                                    const isExpanded = !!expanded[p._id]
                                    return (
                                        <Fragment key={p._id}>
                                            <tr className={`hover:bg-slate-50/50 transition-colors ${isExpanded ? 'bg-slate-50/80' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => toggleExpand(p._id)}
                                                        className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded hover:bg-indigo-50"
                                                    >
                                                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-100">
                                                            {(p.name || '??').slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-slate-800">{p.name}</div>
                                                            <div className="text-xs text-slate-500">ID: {p._id ? p._id.slice(-6) : '—'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1">
                                                        {p.email && (
                                                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                                <Mail size={12} className="text-slate-400" />
                                                                {p.email}
                                                            </div>
                                                        )}
                                                        {p.phone && (
                                                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                                                <Phone size={12} className="text-slate-400" />
                                                                {p.phone}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {p.nextAppointment ? (
                                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">
                                                            <Calendar size={12} />
                                                            {new Date(p.nextAppointment.slotStart).toLocaleString()}
                                                            {p.nextAppointment.type === 'online' && <Video size={12} className="ml-1" />}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs italic">None scheduled</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {p.latestAppointment ? (
                                                        <div className="text-xs text-slate-600">
                                                            <div className="flex items-center gap-1.5">
                                                                <Clock size={12} className="text-slate-400" />
                                                                {new Date(p.latestAppointment.slotStart).toLocaleDateString()}
                                                            </div>
                                                            <div className="mt-0.5 opacity-80 capitalize">{p.latestAppointment.status}</div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {p.nextAppointment && p.nextAppointment.type === 'online' && (
                                                            <button
                                                                className="btn btn-xs btn-outline text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                                                onClick={() => manageMeetingLink(p)}
                                                                title="Manage Meeting Link"
                                                            >
                                                                <Link size={14} /> {p.nextAppointment.meetingLink ? 'Edit Link' : 'Add Link'}
                                                            </button>
                                                        )}
                                                        {p.nextAppointment && p.nextAppointment.type === 'online' && p.nextAppointment.meetingLink && (
                                                            <a
                                                                href={p.nextAppointment.meetingLink}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="btn btn-xs btn-primary bg-indigo-600 hover:bg-indigo-700"
                                                                title="Join Meeting"
                                                            >
                                                                Join
                                                            </a>
                                                        )}
                                                        <button
                                                            className="btn btn-sm btn-primary flex items-center gap-1.5"
                                                            onClick={() => handlePrescribe(p, p.nextAppointment || p.latestAppointment)}
                                                        >
                                                            <Plus size={16} /> Prescribe
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-slate-50">
                                                    <td colSpan={6} className="px-6 py-4 border-b border-slate-200">
                                                        <div className="pl-14">
                                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Appointment History & Actions</h4>
                                                            <div className="grid gap-3 max-w-2xl">
                                                                {[p.nextAppointment, p.latestAppointment].filter(Boolean).map((apt, i) => (
                                                                    <div key={i} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`p-2 rounded-md ${apt.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                                                                <Calendar size={18} />
                                                                            </div>
                                                                            <div>
                                                                                <div className="font-semibold text-sm text-slate-800">{new Date(apt.slotStart).toLocaleString()}</div>
                                                                                <div className="text-xs text-slate-500 flex items-center gap-2">
                                                                                    <span className="capitalize">{apt.type}</span> • <span className={`capitalize ${apt.status === 'completed' ? 'text-green-600 font-medium' : ''}`}>{apt.status}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            {apt.type === 'online' && (
                                                                                <>
                                                                                    <button onClick={() => manageMeetingLinkForAppointment(apt)} className="btn btn-xs btn-outline">{apt.meetingLink ? 'Edit Link' : 'Add Link'}</button>
                                                                                    {apt.meetingLink && (
                                                                                        <a href={apt.meetingLink} target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-primary bg-indigo-600 hover:bg-indigo-700">Join</a>
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                            <button
                                                                                className="btn btn-xs btn-primary"
                                                                                onClick={() => handlePrescribe(p, apt)}
                                                                            >
                                                                                Prescribe
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                                {[p.nextAppointment, p.latestAppointment].filter(Boolean).length === 0 && (
                                                                    <div className="text-sm text-slate-500 italic">No detailed history available locally.</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </PageContainer>
    )
}

