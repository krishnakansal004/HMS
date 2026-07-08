import { useProfileRender } from '../utils/profiler';
import { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
    listQueue, issueQueueToken, updateQueueToken, callNextToken, listDoctors, listPatients,
    listAppointments, updateAppointment, setDoctorPresence, postQueueMessage, getAppointment
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { todayStr } from '../utils/time'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'
import {
    Users, Clock, CheckCircle, Video, Play, SkipForward, MessageSquare,
    Plus, RefreshCw, Loader2, Link, Mic, Calendar, User, Search,
    Monitor, XCircle, Phone, Mail, MoreVertical, LogOut, Activity, ArrowRight
} from 'lucide-react'

const QueueBoard = memo(function QueueBoard() {
    useProfileRender('QueueBoard', true);
    const { user } = useAuth();
    const navigate = useNavigate()
    const location = useLocation()
    const queryClient = useQueryClient()

    // -- State --
    const [doctorId, setDoctorId] = useState(() => {
        try {
            const params = new URLSearchParams(window.location.search)
            const qd = params.get('doctorId')
            if (qd) return qd
        } catch (e) { }
        return (user?.role === 'doctor' ? user.profile?.doctorProfileId || user._id : '')
    });
    const [date, setDate] = useState(todayStr());

    // Issue Token Form
    const [issueForm, setIssueForm] = useState({ patientId: '', notes: '' });

    // UI Controls
    const [poll, setPoll] = useState(true);
    const [filterVirtualOnly, setFilterVirtualOnly] = useState(() => user?.role === 'doctor')
    const [online, setOnline] = useState(() => !!user?.isOnline)
    const [activeTab, setActiveTab] = useState('queue') // queue | messages
    const [selectedToken, setSelectedToken] = useState(null)

    // Modals
    const [linkModalOpen, setLinkModalOpen] = useState(false)
    const [linkValue, setLinkValue] = useState('')
    const [linkTarget, setLinkTarget] = useState(null) // { type: 'next'|'token'|'appointment', ... }
    const [requirePayment, setRequirePayment] = useState(false)

    const canManage = user && (user.role === 'admin' || user.role === 'doctor');

    // -- TanStack Queries --
    const { data: queueData = [], isLoading: queueLoading, isFetching: queueFetching, refetch: refetchQueue } = useQuery({
        queryKey: ['queue', { doctorId, date }],
        queryFn: async () => {
            if (!doctorId) return [];
            let data = await listQueue({ doctorId, date });
            if ((!data || data.length === 0) && user?.role === 'doctor' && user._id) {
                try {
                    const alt = await listQueue({ doctorId: user._id, date });
                    if (alt && alt.length > 0) return alt;
                } catch (e) { }
            }
            return data || [];
        },
        enabled: !!doctorId,
        refetchInterval: poll ? 5000 : false,
    });

    const { data: appointmentsData = [], isLoading: apptsLoading, refetch: refetchAppts } = useQuery({
        queryKey: ['appointments', { doctorId, date }],
        queryFn: () => listAppointments({ doctorId, date }),
        enabled: !!doctorId,
    });

    const { data: doctorsData = [] } = useQuery({
        queryKey: ['doctors'],
        queryFn: () => listDoctors(),
        enabled: user?.role === 'admin',
    });

    const { data: patientsData = [] } = useQuery({
        queryKey: ['patients'],
        queryFn: () => listPatients(),
        enabled: user?.role === 'admin' || user?.role === 'doctor',
    });

    const loading = queueLoading || queueFetching || apptsLoading;

    // Query Param Sync
    useEffect(() => {
        try {
            const params = new URLSearchParams(location.search)
            const qd = params.get('doctorId')
            if (qd && qd !== doctorId) setDoctorId(qd)
        } catch (e) { }
    }, [location.search, doctorId])

    // Sync selected token
    useEffect(() => {
        if (!selectedToken) return
        const updated = queueData.find(t => t._id === selectedToken._id)
        if (updated) {
            setSelectedToken(prev => {
                if (prev && prev._id === updated._id && JSON.stringify(prev) === JSON.stringify(updated)) {
                    return prev;
                }
                return updated;
            });
        }
    }, [queueData, selectedToken])

    // -- Handlers --
    const handleIssue = useCallback(async () => {
        if (!doctorId) return;
        try {
            const payload = { doctorId, date };
            if (issueForm.patientId) {
                payload.patient = issueForm.patientId
                const p = patientsData.find(x => x._id === issueForm.patientId)
                payload.patientName = p ? `${p.firstName || ''}${p.lastName ? ' ' + p.lastName : ''}`.trim() : 'Patient'
            } else {
                payload.patientName = 'Walk-in'
            }
            if (issueForm.notes) payload.notes = issueForm.notes
            await issueQueueToken(payload);
            setIssueForm({ patientId: '', notes: '' });
            queryClient.invalidateQueries({ queryKey: ['queue', { doctorId, date }] });
            toast.success('Token issued successfully');
        } catch (e) {
            toast.error('Failed to issue token');
        }
    }, [doctorId, date, issueForm, patientsData, queryClient]);

    const handleStatusChange = useCallback(async (token, status) => {
        try {
            await updateQueueToken(token._id, { status });

            // If completing the token, also complete any pending appointment for this patient today
            if (status === 'completed' && token.patient) {
                const match = appointmentsData.find(a =>
                    a.patient &&
                    (a.patient._id === token.patient._id || a.patient === token.patient._id) &&
                    a.status !== 'completed' &&
                    a.status !== 'cancelled'
                )
                if (match) {
                    await updateAppointment(match._id, { status: 'completed' })
                }
            }

            queryClient.invalidateQueries({ queryKey: ['queue', { doctorId, date }] });
            queryClient.invalidateQueries({ queryKey: ['appointments', { doctorId, date }] });
            toast.success(`Marked as ${status}`);
        } catch (e) {
            toast.error('Failed to update status');
        }
    }, [doctorId, date, appointmentsData, queryClient]);

    const getMeetingLink = useCallback((item) => {
        if (!item) return null
        if (item.meetingLink) return item.meetingLink
        if (item.source === 'virtual-room' || item.type === 'online' || item.source === 'appointment') {
            return `https://meet.jit.si/HMS-${item._id}`
        }
        return null
    }, [])

    const openLinkModal = useCallback((target) => {
        let defaultLink = ''
        if (target.type === 'token') defaultLink = target.item.meetingLink || getMeetingLink(target.item)
        if (target.type === 'appointment') defaultLink = target.item.meetingLink || getMeetingLink(target.item)

        setLinkValue(defaultLink || '')
        setLinkTarget(target)
        setRequirePayment(false)
        setLinkModalOpen(true)
    }, [getMeetingLink])

    const handleLinkConfirm = useCallback(async () => {
        const finalLink = linkValue || (linkTarget?.type === 'token' ? getMeetingLink(linkTarget.item) : (linkTarget?.type === 'appointment' ? getMeetingLink(linkTarget.item) : undefined))
        try {
            if (linkTarget?.type === 'next') {
                await callNextToken({ doctorId, date, meetingLink: linkValue || undefined, paymentRequired: requirePayment })
                toast.success('Called next patient')
            } else if (linkTarget?.type === 'token') {
                await updateQueueToken(linkTarget.item._id, { status: linkTarget.action || 'called', meetingLink: linkValue || undefined, paymentRequired: requirePayment })
                toast.success('Updated token')
            } else if (linkTarget?.type === 'appointment') {
                await updateAppointment(linkTarget.item._id, { meetingLink: linkValue || getMeetingLink(linkTarget.item), sendMeetingEmail: true })
                toast.success('Meeting link set & emailed')
            }
        } catch (e) {
            toast.error('Operation failed')
        } finally {
            setLinkModalOpen(false)
            setLinkTarget(null)
            queryClient.invalidateQueries({ queryKey: ['queue', { doctorId, date }] });
            queryClient.invalidateQueries({ queryKey: ['appointments', { doctorId, date }] });
        }
    }, [doctorId, date, linkValue, linkTarget, requirePayment, getMeetingLink, queryClient]);

    // -- Derived Data --
    const activeToken = useMemo(() => queueData.find(t => t.status === 'called'), [queueData]);
    const waitingTokens = useMemo(() => queueData.filter(t => t.status === 'waiting' && (!filterVirtualOnly || t.source === 'virtual-room')).sort((a, b) => a.number - b.number), [queueData, filterVirtualOnly]);
    const completedTokens = useMemo(() => queueData.filter(t => t.status === 'completed'), [queueData]);
    const skippedTokens = useMemo(() => queueData.filter(t => t.status === 'skipped'), [queueData]);

    return (
        <PageContainer>
            <PageHeader
                title="Virtual Room & Queue"
                breadcrumbs={[{ label: 'Dashboard', path: '/' }, { label: 'Virtual Room', active: true }]}
                actions={
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <input
                                type="date"
                                className="text-sm border-none p-0 focus:ring-0 text-slate-600 w-32"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                        </div>

                        {user?.role === 'doctor' && (
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                                <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-slate-300'}`} />
                                <label className="text-sm font-medium text-slate-600 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={online}
                                        onChange={async (e) => {
                                            const val = e.target.checked
                                            setOnline(val)
                                            try { await setDoctorPresence(doctorId, { online: val, autoAdmit: val }); queryClient.invalidateQueries({ queryKey: ['queue', { doctorId, date }] }) } catch (err) { }
                                        }}
                                    />
                                    {online ? 'Online' : 'Offline'}
                                </label>
                            </div>
                        )}

                        <button
                            className={`p-2 rounded-lg border shadow-sm transition-all ${poll ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white text-slate-400 hover:text-slate-600'}`}
                            onClick={() => setPoll(!poll)}
                            title="Toggle Polling"
                        >
                            <Activity className="w-4 h-4" />
                        </button>

                        <button
                            className="p-2 bg-white border rounded-lg shadow-sm hover:bg-slate-50 text-slate-600"
                            onClick={() => { refetchQueue(); refetchAppts(); }}
                            title="Refresh"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>

                        {user?.role === 'admin' && (
                            <select className="input text-sm py-1.5 px-3 min-w-[150px]" value={doctorId} onChange={e => setDoctorId(e.target.value)}>
                                <option value="">Select Doctor</option>
                                {doctorsData.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                            </select>
                        )}
                    </div>
                }
            />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-12rem)]">

                {/* Left Column: Waiting List */}
                <div className="lg:col-span-1 flex flex-col gap-4 overflow-hidden">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                <Users className="w-4 h-4 text-slate-500" /> Waiting
                                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">{waitingTokens.length}</span>
                            </h3>
                            {canManage && (
                                <button
                                    className="btn btn-primary btn-xs flex items-center gap-1"
                                    onClick={() => openLinkModal({ type: 'next' })}
                                    disabled={!waitingTokens.length}
                                >
                                    <Play className="w-3 h-3" /> Call Next
                                </button>
                            )}
                        </div>
                        <div className="overflow-auto flex-1 p-2 space-y-2">
                            {waitingTokens.map(t => (
                                <div key={t._id} className="p-3 bg-white border border-slate-100 rounded-lg shadow-sm hover:shadow-md transition-shadow group">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-bold text-slate-800 text-lg">#{t.number}</div>
                                            <div className="text-sm font-medium text-slate-700 truncate max-w-[150px]">
                                                {t.patient ? `${t.patient.firstName} ${t.patient.lastName}` : 'Walk-in'}
                                            </div>
                                            {(t.patient?.phone || t.patient?.email) && (
                                                <div className="text-xs text-slate-500 truncate max-w-[150px]">{t.patient.phone || t.patient.email}</div>
                                            )}
                                            {t.notes && <div className="text-xs text-amber-600 mt-1 italic">{t.notes}</div>}
                                        </div>
                                        {canManage && (
                                            <div className="flex flex-col gap-1 transition-opacity">
                                                <button className="btn btn-xs btn-outline" onClick={() => openLinkModal({ type: 'token', item: t, action: 'called' })}>Call</button>
                                                <button className="btn btn-xs btn-ghost text-red-500 hover:bg-red-50" onClick={() => handleStatusChange(t, 'skipped')}>Skip</button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        {t.source === 'virtual-room' && <span className="bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">Remote</span>}
                                    </div>
                                </div>
                            ))}
                            {!waitingTokens.length && (
                                <div className="text-center py-10 text-slate-400 text-sm">No patients waiting</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Middle Column: Active Token & Action */}
                <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">

                    {/* Active Token Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden relative">
                        {activeToken && <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />}
                        <div className="p-6">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Current Active Token</h3>

                            {activeToken ? (
                                <div className="flex flex-col md:flex-row gap-6 items-start">
                                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center min-w-[140px]">
                                        <div className="text-5xl font-bold text-blue-600 tracking-tight">#{activeToken.number}</div>
                                        <div className="text-blue-500 text-xs font-semibold mt-2 uppercase">In Consultation</div>
                                    </div>

                                    <div className="flex-1 space-y-3">
                                        <div>
                                            <h2 className="text-2xl font-bold text-slate-800">
                                                {activeToken.patient ? `${activeToken.patient.firstName} ${activeToken.patient.lastName}` : 'Walk-in Patient'}
                                            </h2>
                                            <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-600">
                                                {activeToken.patient?.phone && (
                                                    <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {activeToken.patient.phone}</span>
                                                )}
                                                {activeToken.patient?.email && (
                                                    <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {activeToken.patient.email}</span>
                                                )}
                                            </div>
                                            {activeToken.notes && (
                                                <div className="mt-3 bg-amber-50 text-amber-800 px-3 py-2 rounded-lg text-sm border border-amber-100">
                                                    Note: {activeToken.notes}
                                                </div>
                                            )}
                                        </div>

                                        {canManage && (
                                            <div className="flex flex-wrap gap-3 mt-4">
                                                {activeToken.meetingLink || getMeetingLink(activeToken) ? (
                                                    <div className="flex gap-2">
                                                        <a href={getMeetingLink(activeToken)} target="_blank" rel="noreferrer" className="btn btn-primary gap-2">
                                                            <Video className="w-4 h-4" /> Join Meeting
                                                        </a>
                                                        <button className="btn btn-outline px-2" onClick={() => {
                                                            navigator.clipboard.writeText(getMeetingLink(activeToken))
                                                            toast.success('Waitroom link copied')
                                                        }} title="Copy Link"><Link className="w-4 h-4" /></button>
                                                    </div>
                                                ) : (
                                                    <button className="btn btn-outline gap-2" onClick={() => openLinkModal({ type: 'token', item: activeToken })}>
                                                        <Video className="w-4 h-4" /> Create Meeting Link
                                                    </button>
                                                )}

                                                <button className="btn bg-green-600 text-white hover:bg-green-700 gap-2 border-none" onClick={() => handleStatusChange(activeToken, 'completed')}>
                                                    <CheckCircle className="w-4 h-4" /> Complete
                                                </button>

                                                <button className="btn btn-ghost text-slate-500 hover:text-slate-700 gap-2" onClick={() => handleStatusChange(activeToken, 'skipped')}>
                                                    <SkipForward className="w-4 h-4" /> Skip
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
                                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <Users className="w-6 h-6 text-slate-400" />
                                    </div>
                                    <h3 className="text-slate-500 font-medium">No patient currently active</h3>
                                    <p className="text-slate-400 text-sm mt-1">Call the next patient from the waiting list to start consultation.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tabs area: Chat / Issue Token */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0">
                        <div className="border-b flex">
                            <button
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'queue' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                onClick={() => setActiveTab('queue')}
                            >
                                Issue Token
                            </button>
                            <button
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'messages' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                                onClick={() => setActiveTab('messages')}
                            >
                                Patient Chat <span className="ml-1 text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">beta</span>
                            </button>
                        </div>

                        <div className="p-4 overflow-auto flex-1">
                            {/* ... (Same as before) ... */}
                            {activeTab === 'queue' && (
                                <div className="max-w-md mx-auto space-y-4 pt-2">
                                    <div className="text-sm font-medium text-slate-700">Manually issue a token</div>
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <select
                                                className="input w-full pl-10 h-10"
                                                value={issueForm.patientId}
                                                onChange={e => setIssueForm({ ...issueForm, patientId: e.target.value })}
                                            >
                                                <option value="">Walk-in Guest (No Record)</option>
                                                {patientsData.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName}</option>)}
                                            </select>
                                            <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                                        </div>
                                        <div className="relative">
                                            <input
                                                className="input w-full pl-10 h-10"
                                                placeholder="Optional notes or reason..."
                                                value={issueForm.notes}
                                                onChange={e => setIssueForm({ ...issueForm, notes: e.target.value })}
                                            />
                                            <MessageSquare className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                                        </div>
                                        <button className="btn btn-primary w-full" onClick={handleIssue}>
                                            <Plus className="w-4 h-4 mr-2" /> Issue Token
                                        </button>
                                    </div>

                                    {/* Quick Stats */}
                                    <div className="grid grid-cols-2 gap-3 mt-8">
                                        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                                            <div className="text-xs text-green-600 font-medium uppercase">Completed</div>
                                            <div className="text-2xl font-bold text-green-700">{completedTokens.length}</div>
                                        </div>
                                        <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                                            <div className="text-xs text-red-600 font-medium uppercase">Skipped</div>
                                            <div className="text-2xl font-bold text-red-700">{skippedTokens.length}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'messages' && (
                                <div className="h-full flex flex-col md:flex-row gap-4 h-[400px]">
                                    <div className="w-full md:w-1/3 border-r pr-2 overflow-auto">
                                        <div className="text-xs font-semibold text-slate-400 mb-2 uppercase">Select Token</div>
                                        {queueData.map(t => (
                                            <div
                                                key={t._id}
                                                onClick={() => setSelectedToken(t)}
                                                className={`p-2 rounded-lg cursor-pointer text-sm mb-1 ${selectedToken?._id === t._id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-slate-50 text-slate-700'}`}
                                            >
                                                #{t.number} {t.patient ? t.patient.firstName : 'Guest'}
                                                {t.messages?.length > 0 && <span className="ml-2 w-2 h-2 bg-red-500 rounded-full inline-block" />}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        {selectedToken ? (
                                            <>
                                                <div className="flex-1 overflow-auto border rounded-lg bg-slate-50 p-3 space-y-3 mb-3">
                                                    {(selectedToken.messages || []).map((m, i) => (
                                                        <div key={i} className={`flex flex-col ${m.sender === 'doctor' ? 'items-end' : 'items-start'}`}>
                                                            <div className={`px-3 py-2 rounded-lg max-w-[80%] text-sm ${m.sender === 'doctor' ? 'bg-primary text-white rounded-br-none' : 'bg-white border rounded-bl-none shadow-sm'}`}>
                                                                 {m.text}
                                                            </div>
                                                            <span className="text-xxs text-slate-400 mt-1">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    ))}
                                                    {!selectedToken.messages?.length && <div className="text-center text-slate-400 text-sm mt-10">No messages yet</div>}
                                                </div>
                                                <MessageComposer token={selectedToken} onSent={() => queryClient.invalidateQueries({ queryKey: ['queue', { doctorId, date }] })} />
                                            </>
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Select a token to chat</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* Right Column: Appointments */}
                <div className="lg:col-span-1 flex flex-col gap-4 overflow-hidden">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                        <div className="p-4 border-b bg-slate-50/50">
                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-500" /> Appointments
                                <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full">{appointmentsData.length}</span>
                            </h3>
                        </div>
                        <div className="overflow-auto flex-1 p-2 space-y-2">
                            {appointmentsData.map(a => (
                                <div key={a._id} className="p-3 bg-white border border-slate-100 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-medium text-slate-800 text-sm truncate w-32">
                                            {a.patientName || (a.patient && `${a.patient.firstName} ${a.patient.lastName}`) || 'Patient'}
                                        </div>
                                        <div className="text-xs font-semibold text-slate-500">
                                            {new Date(a.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-500 mb-2 capitalize">{a.type || 'Online Consultation'}</div>

                                    {a.status === 'completed' ? (
                                        <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100 w-fit">
                                            <CheckCircle className="w-3 h-3" /> Completed
                                        </div>
                                    ) : (
                                        <div className="flex gap-1.5 flex-wrap">
                                            {a.meetingLink || getMeetingLink(a) ? (
                                                <a href={getMeetingLink(a)} target="_blank" rel="noreferrer" className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded text-xs border border-green-100 hover:bg-green-100">
                                                    <Video className="w-3 h-3" /> Join
                                                </a>
                                            ) : (
                                                <button
                                                    className="flex items-center gap-1 bg-slate-50 text-slate-600 px-2 py-1 rounded text-xs border hover:bg-slate-100"
                                                    onClick={() => openLinkModal({ type: 'appointment', item: a })}
                                                >
                                                    <Link className="w-3 h-3" /> Link
                                                </button>
                                            )}
                                            <button
                                                className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-100 hover:bg-blue-100 ml-auto"
                                                onClick={async () => {
                                                    try {
                                                        const payload = { doctorId, date, patientName: a.patientName || (a.patient && `${a.patient.firstName} ${a.patient.lastName}`) || 'Patient', patient: a.patient?._id }
                                                        const token = await issueQueueToken(payload)
                                                        // Auto-call
                                                        await updateQueueToken(token._id, { status: 'called', meetingLink: a.meetingLink || undefined })
                                                        queryClient.invalidateQueries({ queryKey: ['queue', { doctorId, date }] })
                                                        toast.success('Patient called from appointment')
                                                    } catch (e) { toast.error('Failed to call') }
                                                }}
                                            >
                                                Call <ArrowRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {!appointmentsData.length && (
                                <div className="text-center py-10 text-slate-400 text-sm">No appointments today</div>
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Link Modal */}
            {linkModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b font-semibold bg-slate-50">Meeting Configuration</div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 block mb-1">Meeting Link</label>
                                <div className="relative">
                                    <input
                                        className="input w-full pl-9"
                                        placeholder="https://meet.jit.si/..."
                                        value={linkValue}
                                        onChange={e => setLinkValue(e.target.value)}
                                    />
                                    <Video className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                </div>
                                <div className="text-xs text-slate-500 mt-1.5 ml-1">
                                    Leave empty to auto-generate a secure Jitsi link.
                                </div>
                            </div>

                            <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-3">
                                <div className="mt-0.5"><CheckCircle className="w-4 h-4 text-blue-600" /></div>
                                <div className="text-xs text-blue-800">
                                    Providing a link will automatically enable the "Join" button for the patient in their dashboard.
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t flex justify-end gap-2 bg-slate-50">
                            <button className="btn btn-ghost" onClick={() => setLinkModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleLinkConfirm}>Confirm & Proceed</button>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    );
})

const MessageComposer = memo(function MessageComposer({ token, onSent }) {
    const [text, setText] = useState('')
    const [sending, setSending] = useState(false)
    const send = async () => {
        if (!text.trim() || !token || !token._id) return
        setSending(true)
        try {
            await postQueueMessage(token._id, { text: text.trim() })
            setText('')
            if (onSent) await onSent()
        } catch (e) { }
        setSending(false)
    }
    return (
        <div className="flex gap-2">
            <input
                className="input flex-1 h-9 text-sm"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Type a message..."
                onKeyDown={e => e.key === 'Enter' && send()}
            />
            <button className="btn btn-primary btn-sm h-9 px-3" onClick={send} disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
            </button>
        </div>
    )
})

export default QueueBoard

