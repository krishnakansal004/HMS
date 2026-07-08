import { useEffect, useState, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listDoctors, getSlots, createAppointment, createPaymentLink, createRazorpayOrder, verifyRazorpayPayment, checkPaymentLink } from '../services/api'

// Helper to load Razorpay script dynamically if missing
function loadRazorpay() {
    return new Promise((resolve) => {
        if (window.Razorpay) return resolve(true)
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.onload = () => resolve(true)
        script.onerror = () => resolve(false)
        document.body.appendChild(script)
    })
}
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { todayStr } from '../utils/time'

import { Loader2 } from 'lucide-react'

export default function BookingModal({ onClose, onBooked, initialDoctorId }) {
    const { user } = useAuth();
    const { t } = useTranslation()
    const [doctorId, setDoctorId] = useState(initialDoctorId || '');
    const [doctorDropdownOpen, setDoctorDropdownOpen] = useState(false);
    const [date, setDate] = useState(() => todayStr());
    const [type, setType] = useState('online');
    const [diseaseText, setDiseaseText] = useState('')
    const [medicineHistory, setMedicineHistory] = useState('')
    const [docs, setDocs] = useState([])
    const [voiceBlob, setVoiceBlob] = useState(null)
    const [isRecording, setIsRecording] = useState(false)
    const [recorderUrl, setRecorderUrl] = useState('')
    const [selectedSlot, setSelectedSlot] = useState(null)
    const mediaRecorderRef = useRef(null)

    // TanStack Query for Doctors list
    const { data: doctors = [] } = useQuery({
        queryKey: ['doctors'],
        queryFn: () => listDoctors(),
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
    })

    // TanStack Query for Doctor slots
    const { data: remoteSlots = [], isLoading: loadingSlots, isError: slotsError, error: slotsFetchError } = useQuery({
        queryKey: ['slots', doctorId, date],
        queryFn: () => getSlots(doctorId, date),
        enabled: !!doctorId && !!date,
        staleTime: 1 * 60 * 1000, // slots expire faster than general data
        gcTime: 5 * 60 * 1000,
        retry: false, // Do not retry failed slots lookups
    })

    // Filter past slots and compute hidden count using useMemo
    const { slots, hiddenPastCount } = useMemo(() => {
        if (!remoteSlots || !Array.isArray(remoteSlots)) return { slots: [], hiddenPastCount: 0 }
        const todayLocal = todayStr()
        if (date === todayLocal) {
            const now = Date.now()
            const future = remoteSlots.filter(s => {
                try { return new Date(s.start).getTime() > now } catch (e) { return false }
            })
            return { slots: future, hiddenPastCount: remoteSlots.length - future.length }
        } else {
            return { slots: remoteSlots, hiddenPastCount: 0 }
        }
    }, [remoteSlots, date])

    // If initialDoctorId is provided, ensure it's set
    useEffect(() => {
        if (initialDoctorId) setDoctorId(initialDoctorId)
    }, [initialDoctorId])

    const onDocsChange = (e) => {
        setDocs(Array.from(e.target.files || []))
    }

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mr = new MediaRecorder(stream)
            const chunks = []
            mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data) }
            mr.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' })
                setVoiceBlob(blob)
                setRecorderUrl(URL.createObjectURL(blob))
            }
            mediaRecorderRef.current = mr
            mr.start()
            setIsRecording(true)
        } catch (e) { toast.error(t('unableStartRecording') || 'Unable to start recording') }
    }
    const stopRecording = () => {
        try { if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop() } catch (e) { }
        setIsRecording(false)
    }

    const book = async () => {
        if (!selectedSlot) return toast.error('Please select a time slot')
        const slot = selectedSlot
        const MAX_BYTES = 1073741824
        try {
            // Prevent booking a slot that is already in the past
            try {
                const slotStartDate = new Date(slot.start)
                const now = new Date()
                if (slotStartDate <= now) {
                    return toast.error('Cannot book a past slot. Please select a future time.')
                }
            } catch (e) { }
            // Additional details are optional; no minimum requirement.
            if (!doctorId) return toast.error(t('pleaseSelectDoctor') || 'Please select a doctor')
            let useForm = docs.length > 0 || voiceBlob
            let payload
            if (useForm) {
                const fd = new FormData()
                fd.append('doctorId', doctorId)
                fd.append('patientName', user.name)
                if (user.phone) fd.append('patientPhone', user.phone)
                if (user.email) fd.append('patientEmail', user.email)
                fd.append('type', type)
                fd.append('date', date)
                fd.append('slotStart', slot.start)
                if (diseaseText) fd.append('diseaseText', diseaseText)
                if (medicineHistory) fd.append('medicineHistory', medicineHistory)
                if (voiceBlob) {
                    if (voiceBlob.size > MAX_BYTES) return toast.error(t('fileExceedsLimit') || 'Voice file exceeds 1GB limit')
                    fd.append('voice', new File([voiceBlob], 'voice-message.webm', { type: voiceBlob.type || 'audio/webm' }))
                }
                for (let i = 0; i < docs.length; i++) {
                    const f = docs[i]
                    if (f.size > MAX_BYTES) return toast.error(t('fileExceedsLimitName', { name: f.name }) || `File ${f.name} exceeds 1GB limit`)
                    fd.append('docs', f)
                }
                payload = fd
            } else {
                payload = { doctorId, patientName: user.name, patientPhone: user.phone, patientEmail: user.email, type, date, slotStart: slot.start, diseaseText, medicineHistory }
            }
            // If consultation fee is zero or not available, create appointment immediately
            const doctor = doctors.find(d => d._id === doctorId)
            const fee = Number(doctor?.consultationFee || 0)
            if (!fee || fee <= 0) {
                await createAppointment(payload)
                toast.success(t('appointmentBooked') || 'Appointment booked successfully')
                setDiseaseText('')
                setMedicineHistory('')
                setDocs([])
                setVoiceBlob(null)
                setRecorderUrl('')
                setSelectedSlot(null)
                onBooked();
                return
            }

            // Build a payment request for consultation fee and open Razorpay checkout
            const patientName = user?.name || payload.patientName || 'Patient'
            const email = user?.email || payload.patientEmail
            const phone = user?.phone || payload.patientPhone
            const items = [{ description: `Consultation with Dr. ${doctor?.name || ''}`, quantity: 1, unitPrice: fee, gstRate: 0 }]
            const res = await createPaymentLink({ patientName, items, email, phone, doctorId: doctor?._id, doctorName: doctor?.name })
            if (!res || !res.paymentRequestId) {
                toast.error('Failed to initiate payment')
                return
            }

            // Try to open Checkout (preferred)
            try {
                // Ensure Razorpay SDK is loaded
                await loadRazorpay()

                const orderResp = await createRazorpayOrder(res.paymentRequestId)
                if (orderResp && orderResp.order && window.Razorpay) {
                    const order = orderResp.order
                    const keyId = orderResp.keyId || res.keyId
                    const options = {
                        key: keyId,
                        amount: order.amount,
                        currency: order.currency || 'INR',
                        order_id: order.id,
                        name: import.meta.env.VITE_COMPANY_NAME || 'PharmaPlus HMS',
                        description: `Consultation payment for ${patientName}`,
                        handler: async function (response) {
                            try {
                                const verify = await verifyRazorpayPayment(response)
                                if (verify && verify.success) {
                                    // Now create appointment on successful payment; include invoiceId so backend links them
                                    if (payload instanceof FormData) {
                                        if (verify.invoiceId) payload.append('invoiceId', verify.invoiceId)
                                    } else {
                                        payload = { ...(payload || {}), invoiceId: verify.invoiceId }
                                    }
                                    await createAppointment(payload)
                                    toast.success('Payment verified; appointment booked')
                                    setDiseaseText('')
                                    setMedicineHistory('')
                                    setDocs([])
                                    setVoiceBlob(null)
                                    setRecorderUrl('')
                                    onBooked();
                                } else {
                                    toast.error(verify.message || 'Payment verification failed')
                                }
                            } catch (e) {
                                toast.error(e.message || 'Payment verification failed')
                            }
                        },
                        prefill: { name: patientName || 'Patient', email: email || undefined },
                        theme: { color: '#5942ff' }
                    }
                    try {
                        const rzp = new window.Razorpay(options)
                        rzp.open()
                    } catch (err) {
                        console.error('Razorpay checkout open error', err)
                        try { window.open(res.shortUrl, '_blank') } catch (_) { }
                    }
                    return
                }
            } catch (err) {
                console.error('create order or checkout failed', err)
            }

            // Fallback: open hosted payment link and poll for payment status
            try {
                try { window.open(res.shortUrl, '_blank') } catch (_) { }
                const linkId = res.linkId || res.paymentRequestId
                // Poll for payment status
                const iv = setInterval(async () => {
                    try {
                        const st = await checkPaymentLink(linkId)
                        if (st && st.paid) {
                            clearInterval(iv)
                            // attach invoiceId (if provided by payments endpoint) so appointment links to invoice
                            if (payload instanceof FormData) {
                                if (st.invoiceId) payload.append('invoiceId', st.invoiceId)
                            } else {
                                payload = { ...(payload || {}), invoiceId: st.invoiceId }
                            }
                            // create appointment now
                            await createAppointment(payload)
                            toast.success('Payment received; appointment booked')
                            setDiseaseText('')
                            setMedicineHistory('')
                            setDocs([])
                            setVoiceBlob(null)
                            setRecorderUrl('')
                            onBooked();
                        }
                    } catch (e) { /* ignore */ }
                }, 3000)
            } catch (e) {
                console.error('fallback payment link open failed', e)
                toast.error('Failed to open payment link')
            }
        } catch (e) {
            if (e.status === 409) {
                toast.error('That slot was just taken. Pick another.');
            } else {
                toast.error(e.message || 'Booking failed. Please try again.');
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900">{t('bookNewAppointment')}</h2>
                    <button className="p-2 hover:bg-slate-100 rounded-full transition-colors" onClick={onClose}>✕</button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                        {/* Custom doctor dropdown to show details inline */}
                        <div className="input-group">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Doctor</label>
                            <button type="button" className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-left flex items-center justify-between hover:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all" onClick={() => setDoctorDropdownOpen(!doctorDropdownOpen)}>
                                <span className="truncate block font-medium text-slate-700">{doctors.find(d => d._id === doctorId)?.name || t('selectDoctor')}</span>
                                <span className="text-slate-400">▾</span>
                            </button>
                        </div>

                        {doctorDropdownOpen && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl max-h-64 overflow-auto z-50">
                                {doctors.map(d => (
                                    <button key={d._id} type="button" className={`w-full text-left p-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 ${d._id === doctorId ? 'bg-indigo-50/50' : ''}`} onClick={() => { setDoctorId(d._id); setDoctorDropdownOpen(false); }}>
                                        <div className="font-bold text-slate-800">{d.designation ? `${d.designation} ` : ''}{d.name}</div>
                                        <div className="text-xs text-slate-500 font-medium">{d.specialization || d.department}{d.specialization && d.department ? ' • ' : ''}{d.department}</div>
                                        <div className="text-xs text-slate-400 mt-1">Exp: {d.experienceYears || '—'} yrs • Fee: {d.consultationFee ? `₹${Number(d.consultationFee).toFixed(0)}` : '—'}</div>
                                    </button>
                                ))}
                                {doctors.length === 0 && <div className="p-3 text-sm text-slate-500">No doctors available</div>}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Date</label>
                        <input type="date" className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                </div>

                {/* Show selected doctor details for patients when choosing a doctor */}
                {(() => {
                    const selected = doctors.find(d => d._id === doctorId)
                    return selected ? (
                        <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-bold text-slate-800">{selected.designation ? `${selected.designation} ` : ''}{selected.name}</div>
                                    <div className="text-xs font-medium text-indigo-600 mt-0.5">{selected.specialization || selected.department}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-bold text-slate-900">{selected.consultationFee ? `₹${Number(selected.consultationFee).toFixed(0)}` : 'Free'}</div>
                                    <div className="text-xs text-slate-500">Consultation Fee</div>
                                </div>
                            </div>
                        </div>
                    ) : null
                })()}

                <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">{t('consultationMode')}</label>
                    <select className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" value={type} onChange={e => setType(e.target.value)}>
                        <option value="online">{t('online')}</option>
                        <option value="walk-in">{t('walkIn')}</option>
                    </select>
                </div>

                <div>
                    <div className="font-semibold mb-3 text-slate-900 flex items-center justify-between">
                        <span>{t('availableSlots') || 'Available Slots'}</span>
                    </div>

                    {loadingSlots ? (
                        <div className="py-10 flex flex-col items-center justify-center text-slate-400">
                            <Loader2 size={32} className="animate-spin text-indigo-600 mb-2" />
                            <span className="text-sm font-medium animate-pulse">Checking availability...</span>
                        </div>
                    ) : slotsError ? (
                        <div className="py-8 text-center text-red-600 bg-red-50 border border-red-100 rounded-xl p-4 my-2">
                            {slotsFetchError?.message || 'Failed to fetch available slots'}
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1">
                            {slots.length === 0 && <div className="col-span-full text-sm text-slate-500 italic text-center py-4 bg-slate-50 rounded-lg">{t('noSlotsAvailable') || 'No slots available'}</div>}

                            {slots.map((s, idx) => {
                                const start = new Date(s.start)
                                const now = new Date()
                                const isPast = start.getTime() <= now.getTime()
                                return (
                                    <button
                                        key={idx}
                                        className={`px-2 py-2 text-sm font-medium rounded-lg border transition-all ${isPast
                                            ? 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'
                                            : selectedSlot?.start === s.start
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105'
                                                : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 shadow-sm'
                                            }`}
                                        onClick={() => !isPast && setSelectedSlot(s)}
                                        disabled={isPast}
                                    >
                                        {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                    {hiddenPastCount > 0 && <div className="text-xs text-slate-400 mt-2 text-center">{t('pastSlotsHidden', { count: hiddenPastCount })}</div>}
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-4">
                    <p className="text-sm font-semibold text-slate-900">Additional Details (Optional)</p>

                    <div>
                        <textarea className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none" rows={2} value={diseaseText} onChange={e => setDiseaseText(e.target.value)} placeholder="Describe your symptoms..." />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <button
                                className={`w-full py-2 rounded-xl text-sm font-medium border border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center gap-2 ${isRecording ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' : ''}`}
                                onClick={isRecording ? stopRecording : startRecording}
                            >
                                {isRecording ? 'Stop Recording' : 'Record Voice Msg'}
                            </button>
                            {recorderUrl && <audio src={recorderUrl} controls className="mt-2 w-full h-8" />}
                        </div>
                        <div className="relative">
                            <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" multiple onChange={onDocsChange} />
                            <div className="w-full py-2 rounded-xl text-sm font-medium border border-dashed border-slate-300 bg-slate-50 text-slate-500 flex items-center justify-center gap-2">
                                <span>Upload Docs</span>
                            </div>
                        </div>
                    </div>
                    {docs && docs.length > 0 && (
                        <div className="text-xs text-slate-500">{docs.map(f => f.name).join(', ')}</div>
                    )}
                </div>

                <div className="pt-2 border-t border-slate-100">
                    <button
                        onClick={book}
                        disabled={!doctorId || !date || !selectedSlot}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                        {Number(doctors.find(d => d._id === doctorId)?.consultationFee || 0) > 0 ? 'Pay and Book Appointment' : 'Book Appointment'}
                    </button>
                </div>
            </div>
        </div>
    );
}
