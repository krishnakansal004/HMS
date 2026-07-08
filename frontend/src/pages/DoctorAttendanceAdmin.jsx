import { useProfileRender } from '../utils/profiler';
import { useCallback, useEffect, useRef, useState } from 'react'
import { listDoctorAttendance, markDoctorAttendance } from '../services/api'
import { toast } from 'react-toastify'
import { todayStr } from '../utils/time'

const isSunday = (dStr) => new Date(dStr).getDay() === 0

export default function DoctorAttendanceAdmin() {
    useProfileRender('DoctorAttendanceAdmin', true);
    const [date, setDate] = useState(todayStr() || '')
    const [records, setRecords] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [historyDoctor, setHistoryDoctor] = useState(null)
    const [history, setHistory] = useState([])
    const mountedRef = useRef(true)

    const load = useCallback(async (isManualRefresh = false) => {
        // Only show full loading spinner when no data exists yet
        if (records.length === 0 && !isManualRefresh) {
            setLoading(true)
        } else {
            setRefreshing(true)
        }
        try {
            const list = await listDoctorAttendance({ date })
            if (mountedRef.current) setRecords(list)
        } catch (e) {
            console.error('[attendance] load failed', e)
        } finally {
            if (mountedRef.current) {
                setLoading(false)
                setRefreshing(false)
            }
        }
    }, [date]) // only re-create when date changes

    useEffect(() => {
        mountedRef.current = true
        load()
        return () => { mountedRef.current = false }
    }, [load])

    const mark = async (rec, status) => {
        try {
            await markDoctorAttendance({ date, doctorId: rec.doctor._id || rec.doctor, status })
            toast.success(`Marked ${rec.doctor.name || 'doctor'} as ${status}`)
            load(true)
        } catch (e) {
            if (e?.status === 409) toast.info('Already marked for today')
            else toast.error('Failed to mark attendance')
        }
    }

    const openHistory = async (rec) => {
        setHistoryDoctor(rec.doctor)
        try {
            const list = await listDoctorAttendance({ doctorId: rec.doctor._id || rec.doctor })
            list.sort((a, b) => (a.date < b.date ? 1 : -1))
            setHistory(list)
            setHistoryOpen(true)
        } catch { }
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Doctor Attendance Board</h1>
                    <p className="text-sm text-slate-600">Daily overview; mark status for any doctor.</p>
                </div>
                <div className="flex gap-2 items-center">
                    <input
                        type="date"
                        className="input"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        max={todayStr()}
                    />
                    <button
                        className="btn btn-secondary btn-sm flex items-center gap-2"
                        onClick={() => load(true)}
                        disabled={refreshing}
                    >
                        {refreshing ? (
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                        ) : null}
                        Refresh
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-5 table-responsive">
                {loading && records.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">
                        <svg className="animate-spin w-8 h-8 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Loading attendance…
                    </div>
                ) : records.length === 0 ? (
                    <div className="text-sm text-slate-500 py-4">No doctors found.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left border-b">
                                <th className="py-2">Doctor</th>
                                <th className="py-2">Email</th>
                                <th className="py-2">Status</th>
                                <th className="py-2">Action</th>
                                <th className="py-2">History</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map(r => {
                                const doctorObj = r.doctor && typeof r.doctor === 'object' ? r.doctor : { _id: r.doctor, name: 'Unknown', email: '' }
                                const st = r.status
                                const disableActions = isSunday(date) || (st && st !== 'unmarked') || st === 'not-required'
                                return (
                                    <tr key={r._id || doctorObj._id} className="border-b last:border-b-0">
                                        <td className="py-2 font-medium">{doctorObj.name || '—'}</td>
                                        <td className="py-2">{doctorObj.email || '—'}</td>
                                        <td className="py-2 capitalize">
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                                st === 'present' ? 'bg-green-100 text-green-700' :
                                                st === 'absent' ? 'bg-red-100 text-red-700' :
                                                st === 'leave' ? 'bg-blue-100 text-blue-700' :
                                                st === 'half-day' ? 'bg-orange-100 text-orange-700' :
                                                st === 'not-required' ? 'bg-slate-100 text-slate-500' :
                                                'bg-amber-100 text-amber-700'
                                            }`}>
                                                {st === 'not-required' ? 'Not Required' : (st || 'Unmarked')}
                                            </span>
                                        </td>
                                        <td className="py-2">
                                            {disableActions ? <span className="text-slate-400">—</span> : (
                                                <div className="flex gap-1 flex-wrap">
                                                    <button className="btn btn-xs btn-primary" onClick={() => mark(r, 'present')}>Present</button>
                                                    <button className="btn btn-xs" onClick={() => mark(r, 'absent')}>Absent</button>
                                                    <button className="btn btn-xs" onClick={() => mark(r, 'leave')}>Leave</button>
                                                    <button className="btn btn-xs" onClick={() => mark(r, 'half-day')}>Half Day</button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-2">
                                            <button className="btn btn-xs" onClick={() => openHistory(r)}>View</button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {historyOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
                        <div className="p-4 border-b flex items-center justify-between">
                            <div>
                                <div className="font-semibold">Attendance History</div>
                                {historyDoctor && <div className="text-sm text-slate-600">{historyDoctor.name} · {historyDoctor.email}</div>}
                            </div>
                            <button className="btn btn-sm" onClick={() => setHistoryOpen(false)}>Close</button>
                        </div>
                        <div className="p-4 overflow-auto">
                            {history.length ? (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left border-b">
                                            <th className="py-2">Date</th>
                                            <th className="py-2">Status</th>
                                            <th className="py-2">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map(h => (
                                            <tr key={h._id} className="border-b last:border-b-0">
                                                <td className="py-2">{h.date}</td>
                                                <td className="py-2 capitalize">
                                                    {h.status === 'not-required' ? 'Not Required' :
                                                     h.status === 'unmarked' ? 'Unmarked' : h.status}
                                                </td>
                                                <td className="py-2">{h.notes || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="text-sm text-slate-500 py-4 text-center">No records found.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
