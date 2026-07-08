import { useProfileRender } from '../utils/profiler';

import React, { useEffect, useState, useMemo, useCallback, memo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMyAppointments, cancelAppointment, getAppointment, hideAppointment } from '../services/api'
import { toast } from 'react-toastify'
import { Calendar, Clock, User, FileText, Video, Mic, Paperclip, ChevronRight, X, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'
import BookingModal from '../components/BookingModal'

const StatusBadge = memo(({ status }) => {
    const s = (status || '').toLowerCase()
    const config = {
        scheduled: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
        completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
        cancelled: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' },
        pending: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' }
    }
    const c = config[s] || config.pending
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${c.bg} ${c.text} ${c.border}`}>
            {s}
        </span>
    )
})

const AppointmentRow = memo(({ a, onDetails, onCancel, onHide, cancelling }) => {
    return (
        <tr className="hover:bg-slate-50/80 transition-colors group">
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-indigo-50 text-indigo-600 flex flex-col items-center justify-center border border-indigo-100 shrink-0">
                        <span className="text-[10px] font-bold uppercase">{new Date(a.slotStart).toLocaleString('default', { month: 'short' })}</span>
                        <span className="text-lg font-bold leading-none">{new Date(a.slotStart).getDate()}</span>
                    </div>
                    <div>
                        <div className="font-semibold text-slate-700">{new Date(a.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div className="text-xs text-slate-500">{new Date(a.slotStart).getFullYear()}</div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="font-semibold text-slate-700">
                    {a.doctor?.name || a.doctorName || a.doctor_name || '—'}
                </div>
                <div className="text-xs text-slate-500 capitalize">
                    {a.doctor?.specialty || a.doctor?.role || 'General'}
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <span className="font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">#{a.tokenNumber}</span>
                        <span className="capitalize">{a.type === 'video' ? 'Video Call' : a.type === 'online' ? 'Online' : (a.type || 'In-Person')}</span>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <StatusBadge status={a.status} />
            </td>
            <td className="px-6 py-4">
                <div className="flex items-center justify-end gap-2 flex-wrap">
                    {(a.type === 'video' || a.type === 'online') && a.status === 'scheduled' && (
                        <a
                            href={a.meetingLink || `https://meet.jit.si/HMS-${a._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-colors"
                        >
                            <Video size={14} /> Join Video
                        </a>
                    )}
                    <button onClick={() => onDetails(a._id)} className="btn btn-sm btn-outline">Details</button>
                    {a.status === 'scheduled' ? (
                        <button
                            onClick={() => onCancel(a._id)}
                            disabled={cancelling === a._id}
                            className="btn btn-sm bg-red-50 text-red-600 hover:bg-red-100 border-red-100"
                        >
                            {cancelling === a._id ? '...' : 'Cancel'}
                        </button>
                    ) : (
                        <button onClick={() => onHide(a._id)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full" title="Hide">
                            <X size={16} />
                        </button>
                    )}
                </div>
            </td>
        </tr>
    )
})

export default function MyAppointments() {
    useProfileRender('MyAppointments', true);
    const queryClient = useQueryClient()
    const [cancelling, setCancelling] = useState(null)
    const [isBooking, setIsBooking] = useState(false);
    const [selectedAppt, setSelectedAppt] = useState(null)

    const { data, isLoading } = useQuery({
        queryKey: ['myAppointments'],
        queryFn: getMyAppointments,
    })

    const list = useMemo(() => Array.isArray(data) ? data : [], [data])
    const loading = isLoading

    const cancel = useCallback(async (id) => {
        if (!window.confirm('Are you sure you want to cancel this appointment?')) return
        setCancelling(id)
        try {
            await cancelAppointment(id)
            toast.info('Appointment cancelled')
            queryClient.invalidateQueries({ queryKey: ['myAppointments'] })
        } catch (e) { toast.error('Failed to cancel') }
        finally { setCancelling(null) }
    }, [queryClient])

    const openDetails = useCallback(async (id) => {
        try {
            const data = await getAppointment(id)
            setSelectedAppt(data)
        } catch (e) { toast.error('Failed to load details') }
    }, [])

    const handleHide = useCallback(async (id) => {
        if (!window.confirm('Hide this appointment from your dashboard history?')) return
        try {
            await hideAppointment(id)
            queryClient.setQueryData(['myAppointments'], (prev) => 
                Array.isArray(prev) ? prev.filter(x => x._id !== id) : prev
            )
            toast.success('Appointment hidden')
        } catch (e) { toast.error('Failed to hide appointment') }
    }, [queryClient])

    return (
        <PageContainer>
            <PageHeader
                title="My Appointments"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Appointments' }]}
                actions={
                    <button onClick={() => setIsBooking(true)} className="flex items-center gap-2 btn btn-primary shadow-lg shadow-blue-200">
                        <Calendar size={18} /> Book New Appointment
                    </button>
                }
            />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col min-h-[500px]">
                <div className="p-0 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Date & Time</th>
                                <th className="px-6 py-4">Doctor</th>
                                <th className="px-6 py-4">Details</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={5} className="p-12 text-center text-slate-500">Loading appointments...</td></tr>
                            ) : list.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="flex flex-col items-center">
                                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
                                                <Calendar size={32} />
                                            </div>
                                            <p className="text-slate-900 font-medium">No appointments found</p>
                                            <p className="text-slate-500 text-sm mt-1">Book your first consultation today.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : list.map(a => (
                                <AppointmentRow
                                    key={a._id}
                                    a={a}
                                    onDetails={openDetails}
                                    onCancel={cancel}
                                    onHide={handleHide}
                                    cancelling={cancelling}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isBooking && <BookingModal onClose={() => setIsBooking(false)} onBooked={() => { setIsBooking(false); queryClient.invalidateQueries({ queryKey: ['myAppointments'] }); }} />}

            <AnimatePresence>
                {selectedAppt && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Appointment Details</h2>
                                    <div className="text-sm text-slate-500">#{selectedAppt.tokenNumber} • {new Date(selectedAppt.slotStart).toLocaleDateString()}</div>
                                </div>
                                <button onClick={() => setSelectedAppt(null)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} className="text-slate-500" /></button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                        <User size={24} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-800">Dr. {selectedAppt.doctor?.name || 'Unknown'}</div>
                                        <div className="text-sm text-slate-500">{selectedAppt.doctor?.specialty}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Time</label>
                                        <div className="font-medium text-slate-800 flex items-center gap-2 mt-1">
                                            <Clock size={16} className="text-slate-400" />
                                            {new Date(selectedAppt.slotStart).toLocaleTimeString()}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Status</label>
                                        <div className="mt-1"><StatusBadge status={selectedAppt.status} /></div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Problem / Symptoms</label>
                                    <div className="mt-1 p-3 bg-slate-50 rounded-lg text-slate-700 text-sm border border-slate-100">
                                        {selectedAppt.diseaseText || 'No description provided.'}
                                    </div>
                                </div>

                                {(selectedAppt.meetingLink || selectedAppt.type === 'online') && (
                                    <div className="pt-2">
                                        <a href={selectedAppt.meetingLink || `https://meet.jit.si/HMS-${selectedAppt._id}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full justify-center gap-2 py-3 text-base">
                                            <Video size={18} /> Join Video Consultation
                                        </a>
                                    </div>
                                )}

                                {selectedAppt.voiceMessage && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-2">
                                            <Mic size={12} /> Voice Message
                                        </label>
                                        <audio controls src={(selectedAppt.voiceMessage.path || '').replace(/\\/g, '/')} className="w-full h-10" />
                                    </div>
                                )}

                                {selectedAppt.docs && selectedAppt.docs.length > 0 && (
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-2">
                                            <Paperclip size={12} /> {selectedAppt.docs.length} Attachments
                                        </label>
                                        <div className="space-y-2">
                                            {selectedAppt.docs.map((d, i) => (
                                                <a key={i} href={(d.path || '').replace(/\\/g, '/')} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors group">
                                                    <div className="p-2 bg-slate-100 rounded text-slate-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-colors"><FileText size={16} /></div>
                                                    <div className="flex-1 truncate text-sm font-medium text-slate-700">{d.originalname || d.filename}</div>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </PageContainer>
    )
}

