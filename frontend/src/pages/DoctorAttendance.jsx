import { useProfileRender } from '../utils/profiler';
import { useEffect, useMemo, useState, useCallback } from 'react'
import { listDoctorAttendance, listLeaves, createLeave, markDoctorAttendance } from '../services/api'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { todayStr } from '../utils/time'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'
import { Calendar, Plus, RefreshCw, CheckCircle, XCircle, AlertCircle, Clock, FileText } from 'lucide-react'

export default function DoctorAttendance() {
    useProfileRender('DoctorAttendance', true);
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [today, setToday] = useState(todayStr())
    const [confirmMark, setConfirmMark] = useState(false)
    const [leaveModal, setLeaveModal] = useState(false)
    const [leaveForm, setLeaveForm] = useState({ type: 'sick', reason: '', startDate: todayStr(), endDate: todayStr() })

    // -- Queries --
    const { data: records = [], isLoading: recordsLoading, refetch: refetchRecords } = useQuery({
        queryKey: ['doctorAttendance', { date: today }],
        queryFn: () => listDoctorAttendance({ date: today }),
    })

    const { data: myLeaves = [], isLoading: leavesLoading, refetch: refetchLeaves } = useQuery({
        queryKey: ['leaves', { doctorId: user?.id || user?._id }],
        queryFn: () => listLeaves({ doctorId: user?.id || user?._id }),
        enabled: !!user,
    })

    const loading = recordsLoading || leavesLoading

    // -- Mutations --
    const markAttendanceMutation = useMutation({
        mutationFn: (payload) => markDoctorAttendance(payload),
        onSuccess: () => {
            toast.success('Attendance marked successfully')
            setConfirmMark(false)
            queryClient.invalidateQueries({ queryKey: ['doctorAttendance', { date: today }] })
            queryClient.invalidateQueries({ queryKey: ['leaves', { doctorId: user?.id || user?._id }] })
        },
        onError: (e) => {
            toast.error(e?.message || 'Failed')
        }
    })

    const submitLeaveMutation = useMutation({
        mutationFn: (payload) => createLeave(payload),
        onSuccess: () => {
            toast.success('Leave request submitted')
            setLeaveModal(false)
            setLeaveForm({ type: 'sick', reason: '', startDate: today, endDate: today })
            queryClient.invalidateQueries({ queryKey: ['leaves', { doctorId: user?.id || user?._id }] })
        },
        onError: (e) => {
            toast.error(e?.message || 'Failed to submit leave')
        }
    })

    const isSunday = useCallback((dStr) => {
        const d = new Date(dStr)
        return d.getDay() === 0
    }, [])

    const leaveForSelectedDate = useMemo(() => {
        if (!myLeaves?.length) return null
        return myLeaves.find(l => today >= l.startDate && today <= l.endDate)
    }, [myLeaves, today])

    const openLeaveModal = useCallback(() => {
        setLeaveForm(f => ({ ...f, startDate: today, endDate: today }))
        setLeaveModal(true)
    }, [today])

    const submitLeave = useCallback(async () => {
        if (!user) return
        if (!leaveForm.startDate || !leaveForm.endDate) {
            toast.error('Please select start and end date')
            return
        }
        if (leaveForm.endDate < leaveForm.startDate) {
            toast.error('End date cannot be before start date')
            return
        }
        submitLeaveMutation.mutate({
            doctorId: user.id || user._id,
            startDate: leaveForm.startDate,
            endDate: leaveForm.endDate,
            type: leaveForm.type,
            reason: leaveForm.reason
        })
    }, [user, leaveForm, submitLeaveMutation])

    const refreshData = useCallback(() => {
        refetchRecords()
        refetchLeaves()
    }, [refetchRecords, refetchLeaves])

    return (
        <PageContainer>
            <PageHeader
                title="Attendance & Leaves"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Attendance' }]}
                actions={
                    <button className="btn btn-secondary flex items-center gap-2" onClick={refreshData} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                }
            />

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Main Attendance Area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-800">Daily Attendance</h2>
                                <p className="text-sm text-slate-500">Select a date to mark your presence.</p>
                            </div>
                            <input type="date" className="input sm:w-auto" value={today} onChange={e => setToday(e.target.value)} max={todayStr()} />
                        </div>

                        {/* Status Display */}
                        <div className="flex flex-col items-center justify-center py-8 px-4 text-center bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                            {loading ? (
                                <div className="text-slate-400">Checking attendance status...</div>
                            ) : records?.length ? (() => {
                                const st = records[0].status
                                if (st === 'present') return (
                                    <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300">
                                        <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                                            <CheckCircle size={32} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800">Present</h3>
                                            <p className="text-slate-500">Marked for {new Date(today).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                )
                                if (st === 'not-required') return (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                                            <Clock size={32} />
                                        </div>
                                        <div className="text-slate-500 font-medium">Attendance not required today</div>
                                    </div>
                                )
                                return <div className="text-slate-500">Status: <span className="capitalize font-semibold">{st}</span></div>
                            })() : (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center">
                                        <AlertCircle size={32} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-medium text-slate-800">Not Marked Yet</h3>
                                        <p className="text-slate-500 text-sm mb-4">You haven't marked your attendance for this date.</p>

                                        {/* Mark Button */}
                                        {(() => {
                                            const st = records && records[0] ? records[0].status : 'unmarked'
                                            const canMark = st === 'unmarked' && !isSunday(today) && (!leaveForSelectedDate || leaveForSelectedDate.status === 'rejected')

                                            if (!canMark) {
                                                if (leaveForSelectedDate) return <span className="text-indigo-600 font-medium bg-indigo-50 px-3 py-1 rounded-full text-sm">On Leave ({leaveForSelectedDate.type})</span>
                                                if (isSunday(today)) return <span className="text-slate-400 font-medium">Sunday (Holiday)</span>
                                                return null
                                            }

                                            return (
                                                <div className="flex items-center justify-center gap-3">
                                                    {!confirmMark ? (
                                                        <button
                                                            className="btn btn-primary px-8"
                                                            onClick={() => setConfirmMark(true)}
                                                            disabled={markAttendanceMutation.isPending}
                                                        >
                                                            Mark Present
                                                        </button>
                                                    ) : (
                                                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                                                            <span className="text-sm font-medium text-slate-700 mr-2">Confirm?</span>
                                                            <button
                                                                className="btn btn-success btn-sm"
                                                                onClick={() => markAttendanceMutation.mutate({ date: today, status: 'present' })}
                                                                disabled={markAttendanceMutation.isPending}
                                                            >
                                                                Yes
                                                            </button>
                                                            <button className="btn btn-outline btn-sm" onClick={() => setConfirmMark(false)} disabled={markAttendanceMutation.isPending}>Cancel</button>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar: Leaves */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full max-h-[600px]">
                        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-800">Leave History</h3>
                            <button className="btn btn-sm btn-outline text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300" onClick={openLeaveModal}>
                                <Plus size={14} className="mr-1" />
                                Request Leave
                            </button>
                        </div>

                        <div className="overflow-y-auto p-0 flex-1">
                            {myLeaves && myLeaves.length ? (
                                <ul className="divide-y divide-slate-50">
                                    {myLeaves
                                        .slice()
                                        .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))
                                        .map(l => (
                                            <li key={l._id} className="p-4 hover:bg-slate-50 transition-colors">
                                                <div className="flex items-start justify-between mb-1">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${l.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                            l.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                                'bg-amber-100 text-amber-700'
                                                        }`}>
                                                        {l.status}
                                                    </span>
                                                    <span className="text-xs text-slate-400">{new Date(l.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <div className="font-medium text-slate-800 flex items-center gap-2 mt-2">
                                                    <FileText size={14} className="text-slate-400" />
                                                    <span className="capitalize">{l.type} Leave</span>
                                                </div>
                                                <div className="text-sm text-slate-500 ml-6 mt-0.5">
                                                    {new Date(l.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                    {l.endDate && l.endDate !== l.startDate && ` - ${new Date(l.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                                                </div>
                                                {l.reviewNote && (
                                                    <div className="mt-2 text-xs bg-slate-50 p-2 rounded text-slate-600 border border-slate-100">
                                                        <span className="font-semibold">Note:</span> {l.reviewNote}
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                </ul>
                            ) : (
                                <div className="p-8 text-center text-slate-400 text-sm">
                                    No leave requests found.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Leave Modal */}
            {leaveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="font-semibold text-slate-800">Request Leave</h3>
                            <button onClick={() => setLeaveModal(false)} className="text-slate-400 hover:text-slate-600"><XCircle size={20} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Start Date</label>
                                    <input type="date" className="input" value={leaveForm.startDate} onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })} />
                                </div>
                                <div>
                                    <label className="label">End Date</label>
                                    <input type="date" className="input" value={leaveForm.endDate} onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="label">Type</label>
                                <select className="input" value={leaveForm.type} onChange={e => setLeaveForm({ ...leaveForm, type: e.target.value })}>
                                    <option value="sick">Sick Leave</option>
                                    <option value="personal">Personal Leave</option>
                                    <option value="emergency">Emergency</option>
                                    <option value="vacation">Vacation</option>
                                </select>
                            </div>
                            <div>
                                <label className="label">Reason</label>
                                <textarea
                                    className="input min-h-[100px]"
                                    value={leaveForm.reason}
                                    onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                                    placeholder="Please provide a brief reason..."
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                            <button className="btn btn-ghost" onClick={() => setLeaveModal(false)} disabled={submitLeaveMutation.isPending}>Cancel</button>
                            <button className="btn btn-primary px-6" onClick={submitLeave} disabled={submitLeaveMutation.isPending || !leaveForm.type || !leaveForm.startDate || !leaveForm.endDate}>
                                {submitLeaveMutation.isPending ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageContainer>
    )
}

