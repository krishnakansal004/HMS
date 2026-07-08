import { useProfileRender } from '../utils/profiler';
import { useEffect, useState, useCallback, useRef } from 'react'
import { listDoctors as apiListDoctors, getMyQueue, joinQueue, getMyAppointments, postQueueMessage, payQueueToken } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-toastify'
import { todayStr } from '../utils/time'

export default function WaitingRoom() {
    useProfileRender('WaitingRoom', true);
    const { user } = useAuth()
    const [doctors, setDoctors] = useState([])
    const [doctorId, setDoctorId] = useState('')
    const [doctorDropdownOpen, setDoctorDropdownOpen] = useState(false)
    const [date, setDate] = useState(todayStr())
    const [myTokens, setMyTokens] = useState([])
    const [myAppointments, setMyAppointments] = useState([])
    const [joining, setJoining] = useState(false)
    const [patientName, setPatientName] = useState(() => user?.name || '')
    const [notes, setNotes] = useState('')
    const [slotStart, setSlotStart] = useState('')

    const loadDoctors = async () => {
        try {
            const list = await apiListDoctors()
            setDoctors(list || [])
            // if doctorId not set, try to read from querystring
            if (!doctorId) {
                const params = new URLSearchParams(window.location.search)
                const qd = params.get('doctorId')
                if (qd) setDoctorId(qd)
            }
        } catch (e) { console.error(e); setDoctors([]) }
    }

    const prevTokenRef = useRef(null)

    // Clear any stale data and load doctors only when a user is present
    useEffect(() => {
        // reset state to avoid showing old data from previous sessions
        setDoctors([])
        setMyTokens([])
        setMyAppointments([])
        // Only load when user is available (prevents anonymous requests)
        if (user) loadDoctors()
    }, [user])

    const loadMy = useCallback(async () => {
        try {
            const q = await getMyQueue()
            setMyTokens(q || [])
            const ap = await getMyAppointments()
            setMyAppointments(ap || [])
        } catch (e) { console.error(e) }
    }, [])

    const selectedDoctor = doctors.find(d => String(d._id) === String(doctorId))
    useEffect(() => {
        if (!user) return
        loadMy()
        const iv = setInterval(loadMy, 4000)
        return () => clearInterval(iv)
    }, [loadMy, user])

    const handleJoin = async () => {
        if (!doctorId) return toast.error('Select a doctor')
        setJoining(true)
        try {
            const payload = { doctorId, date }
            console.debug('WaitingRoom: joining payload', payload)
            if (patientName) payload.patientName = patientName
            if (notes) payload.notes = notes
            if (slotStart) payload.slotStart = slotStart
            await joinQueue(payload)
            toast.success('You joined the waiting room')
            await loadMy()
        } catch (e) {
            if (e?.status === 409) {
                toast.info('You are already in the queue')
                await loadMy()
            } else toast.error(e?.message || 'Failed to join')
        } finally { setJoining(false) }
    }

    const handlePay = async () => {
        if (!current || !current._id) return toast.error('No active token to pay for')
        try {
            await payQueueToken(current._id, { paymentInfo: { method: 'manual' } })
            toast.success('Payment completed')
            await loadMy()
        } catch (e) {
            toast.error(e?.message || 'Payment failed')
        }
    }

    // pick current token: prefer same date+doctor and the most recent by creation or number
    // Only consider recent tokens (last 7 days) to avoid showing very old history
    const sevenDaysAgo = (() => { const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); return d })()
    const recentTokens = myTokens.filter(t => {
        try {
            const created = new Date(t.createdAt || t._id)
            return created >= sevenDaysAgo
        } catch (e) { return false }
    })

    const tokensForDoctor = recentTokens.filter(t => (t.date === date || (t.date === undefined && (!t.slotStart || (new Date(t.slotStart).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === date)))) && String(t.doctor) === String(doctorId))
    const current = (tokensForDoctor.length ? tokensForDoctor.sort((a, b) => (new Date(b.createdAt || b._id).getTime() - new Date(a.createdAt || a._id).getTime()))[0] : (recentTokens.length ? recentTokens.sort((a, b) => (new Date(b.createdAt || b._id).getTime() - new Date(a.createdAt || a._id).getTime()))[0] : null))

    // Find an upcoming appointment for this doctor/date for the current user
    const upcomingAppointment = myAppointments.find(a => {
        try {
            const sameDoctor = String(a.doctor) === String(doctorId) || String(a.doctor?._id) === String(doctorId)
            const sameDate = a.date === date || (a.slotStart && new Date(a.slotStart).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === date)
            return sameDoctor && sameDate
        } catch (e) { return false }
    })

    // show notification when token status changes to called
    useEffect(() => {
        const currentToken = current
        const prev = prevTokenRef.current
        if (currentToken && prev && prev._id === currentToken._id && prev.status !== 'called' && currentToken.status === 'called') {
            toast.info('Doctor has joined — check meeting link')
            try { if (window.Notification && Notification.permission === 'granted') new Notification('Doctor has joined', { body: `Token #${currentToken.number}` }) } catch (e) { }
        }
        prevTokenRef.current = currentToken
    }, [myTokens])

    // Helper to get effective meeting link (fallback to Jitsi if none set)
    const getMeetingLink = (item) => {
        if (!item) return null
        if (item.meetingLink) return item.meetingLink
        // Auto-generate Jitsi link for virtual items based on unique ID
        // Use a consistent meeting name format: HMS-<ItemId>
        if (item.source === 'virtual-room' || item.type === 'online' || item.source === 'appointment') {
            return `https://meet.jit.si/HMS-${item._id}`
        }
        return null
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Virtual Waiting Room</h1>
                    <p className="text-sm text-slate-600">Join the doctor's queue and wait until called.</p>
                </div>
                <div className="flex gap-2 items-center">
                    <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} max={todayStr()} />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow p-5">
                <div className="grid md:grid-cols-4 gap-3 items-end">
                    <div>
                        <label className="label">Doctor</label>
                        <div>
                            <select className="input w-full" value={doctorId} onChange={e => setDoctorId(e.target.value)}>
                                {doctors.map(d => <option key={d._id} value={d._id}>{d.name} {d.department ? `· ${d.department}` : ''} {d.isOnline ? '· Online' : '· Offline'}</option>)}
                            </select>
                            {selectedDoctor && (
                                <div className="mt-3 p-3 border rounded bg-slate-50 text-sm space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="font-medium">{selectedDoctor.designation ? `${selectedDoctor.designation} ` : ''}{selectedDoctor.name}</div>
                                        <div>
                                            {selectedDoctor.isOnline ? <span className="text-green-600 font-medium">Online</span> : <span className="text-slate-500">Offline</span>}
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-600">{selectedDoctor.specialization || selectedDoctor.department}{selectedDoctor.specialization && selectedDoctor.department ? ' • ' : ''}{selectedDoctor.department}</div>
                                    <div className="text-xs text-slate-500">Experience: {selectedDoctor.experienceYears || '—'} yrs • Fee: {selectedDoctor.consultationFee ? `₹${Number(selectedDoctor.consultationFee).toFixed(2)}` : '—'}</div>
                                    {selectedDoctor.qualifications && <div className="text-xs">Qualifications: {selectedDoctor.qualifications}</div>}
                                    {selectedDoctor.registrationNumber && <div className="text-xs">Reg#: {selectedDoctor.registrationNumber}</div>}
                                    {(selectedDoctor.email || selectedDoctor.phone) && (
                                        <div className="text-xs text-slate-500">{selectedDoctor.email && <span>Email: {selectedDoctor.email}</span>}{selectedDoctor.email && selectedDoctor.phone ? ' • ' : ''}{selectedDoctor.phone && <span>Phone: {selectedDoctor.phone}</span>}</div>
                                    )}
                                    {selectedDoctor.timings && <div className="text-xs">Timings: {selectedDoctor.timings}</div>}
                                    {selectedDoctor.weeklySchedule && (
                                        <div className="text-xs text-slate-500">Schedule: {Object.entries(selectedDoctor.weeklySchedule).map(([k, v]) => v ? `${k.toUpperCase()}:${v}` : null).filter(Boolean).join(' • ')}</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="label">Your name</label>
                        <input className="input" value={patientName} onChange={e => setPatientName(e.target.value)} />
                    </div>
                    <div>
                        <label className="label">Date & time</label>
                        <input className="input" type="datetime-local" value={slotStart} onChange={e => setSlotStart(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" className="btn btn-primary" onClick={handleJoin} disabled={joining || (current && current.status === 'waiting')}>Join Waiting Room</button>
                        {current && current.paymentRequired && current.paymentStatus !== 'paid' && (
                            <button type="button" className="btn btn-warning" onClick={handlePay}>Pay</button>
                        )}
                        <button type="button" className="btn btn-secondary" onClick={loadMy}>Refresh</button>
                    </div>
                </div>
                <div className="mt-3">
                    <label className="label">Brief note (reason / disease)</label>
                    <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Describe symptoms or reason for consult"></textarea>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow p-5">
                <h2 className="font-semibold mb-3">Details</h2>
                {current ? (
                    <div className="space-y-2">
                        <div className="text-xs text-slate-500">Joined: {current && current.createdAt ? new Date(current.createdAt).toLocaleString() : '-'} {current && current.position ? ` · Position: ${current.position}` : ''}</div>
                        {/* Simple timer since joined */}
                        {current && (
                            <div className="text-xs text-slate-500">Waiting time: <WaitingTimer createdAt={current.createdAt || current._id} /></div>
                        )}
                        <div><strong>Token:</strong> #{current.number}</div>
                        <div><strong>Status:</strong> {current.status}</div>
                        <div><strong>Notes:</strong> {current.notes || '-'}</div>
                        {current.patient && (
                            <div className="mt-2 p-2 border rounded bg-slate-50">
                                <div className="text-sm font-medium">Patient Details</div>
                                <div className="text-xs">Name: {current.patient.firstName} {current.patient.lastName || ''}</div>
                                {current.patient.phone && <div className="text-xs">Phone: {current.patient.phone}</div>}
                                {current.patient.email && <div className="text-xs">Email: {current.patient.email}</div>}
                                {current.patient.inpatient && current.patient.inpatient.isAdmitted && (
                                    <div className="text-xs text-red-600">Patient is currently admitted (inpatient)</div>
                                )}

                                <div className="bg-white rounded-xl shadow p-5">
                                    <h2 className="font-semibold mb-3">Your Recent Tokens</h2>
                                    <div className="space-y-2 max-h-48 overflow-auto">
                                        {myTokens.length === 0 && <div className="text-slate-500">No tokens yet.</div>}
                                        {myTokens.slice().sort((a, b) => new Date(b.createdAt || b._id).getTime() - new Date(a.createdAt || a._id).getTime()).map(t => (
                                            <div key={t._id} className="p-3 border rounded-md">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <div className="font-medium">#{t.number} · {t.doctor ? (t.doctor.name || t.doctor) : 'Doctor'}</div>
                                                        <div className="text-xs text-slate-600">{t.date || (t.slotStart ? new Date(t.slotStart).toLocaleString() : '')} · {t.source || ''}</div>
                                                    </div>
                                                    <div className="text-sm text-slate-500">{t.status}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        {current.status === 'called' && (
                            <div>
                                <div className="text-green-600 font-medium">The doctor is ready for you.</div>
                                <div className="mt-2">
                                    <a href={getMeetingLink(current)} target="_blank" rel="noreferrer" className="btn btn-primary">Join Meeting</a>
                                </div>
                            </div>
                        )}
                        {/* Chat / messages */}
                        {current && (
                            <div className="mt-3">
                                <h3 className="font-medium">Chat while waiting</h3>
                                <MessagePanel token={current} onSend={async (text) => {
                                    if (!current || !current._id) return
                                    try {
                                        await postQueueMessage(current._id, { text })
                                        await loadMy()
                                    } catch (e) { toast.error('Failed to send') }
                                }} />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-slate-500">You haven't joined the queue for the selected doctor.</div>
                )}
                {/* Appointment-based meeting link (if any) */}
                {upcomingAppointment && (
                    <div className="mt-4 border-t pt-3">
                        <div className="text-sm text-slate-600">You have an appointment scheduled:</div>
                        <div className="font-medium">{upcomingAppointment.patientName || user?.name || 'You'}</div>
                        <div className="text-sm">Time: {upcomingAppointment.slotStart ? new Date(upcomingAppointment.slotStart).toLocaleString() : (upcomingAppointment.date || '-')}</div>
                        <div className="text-sm">Status: {upcomingAppointment.status}</div>
                        {(upcomingAppointment.meetingLink || upcomingAppointment.type === 'online') ? (
                            <div className="mt-2">
                                <a href={getMeetingLink(upcomingAppointment)} target="_blank" rel="noreferrer" className="btn btn-primary">Join Appointment</a>
                            </div>
                        ) : (
                            (function () {
                                try {
                                    if (!upcomingAppointment.slotStart) return null
                                    const start = new Date(upcomingAppointment.slotStart).getTime()
                                    const now = Date.now()
                                    const diff = start - now
                                    if (diff <= 10 * 60 * 1000 && diff >= -5 * 60 * 1000) {
                                        return (<div className="mt-2 text-sm text-yellow-700">Your appointment is within 10 minutes — doctor may call you soon.</div>)
                                    }
                                } catch (e) { }
                                return null
                            })()
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}


function WaitingTimer({ createdAt }) {
    const [now, setNow] = useState(Date.now())
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(id)
    }, [])
    const start = (createdAt && new Date(createdAt).getTime()) || 0
    const diff = Math.max(0, Math.floor((now - start) / 1000))
    const mm = String(Math.floor(diff / 60)).padStart(2, '0')
    const ss = String(diff % 60).padStart(2, '0')
    return <span>{mm}:{ss}</span>
}

function MessagePanel({ token, onSend }) {
    const [text, setText] = useState('')
    return (
        <div className="space-y-2">
            <div className="max-h-40 overflow-auto p-2 border rounded bg-white">
                {(token.messages || []).map((m, i) => (
                    <div key={i} className="text-xs py-1">
                        <strong className="text-slate-700">{m.sender}:</strong> {m.text}
                        <div className="text-xxs text-slate-400">{new Date(m.createdAt).toLocaleTimeString()}</div>
                    </div>
                ))}
            </div>
            <div className="flex gap-2">
                <input className="input flex-1" value={text} onChange={e => setText(e.target.value)} placeholder="Send a short message to the doctor" />
                <button className="btn btn-sm btn-primary" onClick={async () => { if (!text.trim()) return; await onSend(text.trim()); setText('') }}>Send</button>
            </div>
        </div>
    )
}

