import { useProfileRender } from '../utils/profiler';
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
    listDoctors, 
    getSlotsAndQueue, 
    createAppointment, 
    updateAppointment, 
    cancelAppointment, 
    listPatients, 
    createPaymentLink, 
    createRazorpayOrder, 
    verifyRazorpayPayment, 
    checkPaymentLink 
} from '../services/api'
import { toast } from 'react-toastify'
import { todayStr } from '../utils/time'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'
import {
    Calendar, User, Clock, FileText, Mic, Upload,
    Pill, Phone, Mail, Video, MapPin,
    Loader2, Users, Activity, ChevronRight, Square
} from 'lucide-react'

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

const DoctorSelect = React.memo(({ value, onChange, doctors }) => {
    const selected = doctors.find(d => (d._id || d.id) === value)
    return (
        <div className="space-y-3">
            <div className="relative">
                <select
                    className="input !pl-12 w-full appearance-none"
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                >
                    <option value="">Select doctor...</option>
                    {doctors.map(d => <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>)}
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <User size={18} />
                </div>
            </div>
            {selected && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                        {selected.name.charAt(0)}
                    </div>
                    <div>
                        <div className="font-medium text-slate-800 text-sm">{selected.name}</div>
                        <div className="text-xs text-slate-500 flex flex-wrap gap-x-2 gap-y-1 mt-0.5">
                            <span className="flex items-center gap-1"><Activity size={10} /> {selected.specialization || selected.department}</span>
                            <span>•</span>
                            <span>{selected.experienceYears || 0} yrs exp</span>
                            <span>•</span>
                            <span className="font-semibold text-indigo-700">₹{selected.consultationFee || 0}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
})

const PatientSelect = React.memo(({ value, onChange, patients }) => {
    return (
        <div className="relative">
            <select
                className="input !pl-12 w-full appearance-none"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
            >
                <option value="">Select registered patient...</option>
                {patients.map(p => <option key={p._id} value={p._id}>{p.firstName} {p.lastName} {p.phone ? `(${p.phone})` : ''}</option>)}
            </select>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Users size={18} />
            </div>
        </div>
    )
})

const StatusBadge = React.memo(({ status }) => {
    const s = (status || 'pending').toLowerCase()
    const colors = {
        completed: 'bg-green-50 text-green-700 border-green-200',
        cancelled: 'bg-red-50 text-red-700 border-red-200',
        'no-show': 'bg-slate-100 text-slate-500 border-slate-200',
        'checked-in': 'bg-blue-50 text-blue-700 border-blue-200',
        pending: 'bg-yellow-50 text-yellow-700 border-yellow-200'
    }
    const colorClass = colors[s] || colors.pending
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${colorClass}`}>
            {status.replace('-', ' ')}
        </span>
    )
})

const AppointmentRow = React.memo(({ a, onCheckIn, onComplete, onNoShow, onCancel, onShareMeeting }) => {
    return (
        <tr className="hover:bg-slate-50/55 transition-colors group">
            <td className="px-6 py-4">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold text-xs ring-4 ring-white border border-slate-200">
                    #{a.tokenNumber}
                </span>
            </td>
            <td className="px-6 py-4">
                <div className="font-medium text-slate-800">{a.patientName}</div>
            </td>
            <td className="px-6 py-4 font-mono text-slate-600">
                {new Date(a.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </td>
            <td className="px-6 py-4 capitalize">
                <div className="flex items-center gap-1.5">
                    {a.type === 'online' ? <Video size={14} className="text-blue-500" /> : <MapPin size={14} className="text-emerald-500" />}
                    {a.type || 'online'}
                </div>
                {a.type === 'online' && a.meetingLink && (
                    <a href={a.meetingLink} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 mt-0.5">
                        Join Meeting <ChevronRight size={10} />
                    </a>
                )}
            </td>
            <td className="px-6 py-4">
                <StatusBadge status={a.status} />
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-1">
                    {a.status !== 'completed' && a.status !== 'cancelled' && (
                        <>
                            <button
                                className="btn btn-xs btn-outline hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                                onClick={() => onCheckIn(a._id)}
                                title="Check In"
                                type="button"
                            >
                                Check In
                            </button>
                            <button
                                className="btn btn-xs btn-primary"
                                onClick={() => onComplete(a._id)}
                                type="button"
                            >
                                Complete
                            </button>
                        </>
                    )}
                    {a.status !== 'cancelled' && (
                        <div className="dropdown dropdown-end">
                            <div tabIndex={0} role="button" className="btn btn-xs btn-ghost btn-square"><Users size={16} /></div>
                            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-40 border border-slate-100">
                                <li><a onClick={() => onNoShow(a._id)}>No Show</a></li>
                                <li><a className="text-red-600" onClick={() => onCancel(a._id)}>Cancel</a></li>
                                {a.type === 'online' && (
                                    <li><a onClick={() => onShareMeeting(a)}>Meeting Link</a></li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>
            </td>
        </tr>
    )
})

export default function Appointments() {
    useProfileRender('Appointments', true);
    const [tab, setTab] = useState('New Appointment')
    const queryClient = useQueryClient()
    
    // Cached fetch of static collections via TanStack Query
    const { data: doctors = [] } = useQuery({
        queryKey: ['doctors'],
        queryFn: () => listDoctors(),
    })
    
    const { data: patients = [] } = useQuery({
        queryKey: ['patients'],
        queryFn: () => listPatients(),
    })

    const [doctorId, setDoctorId] = useState('')
    const [date, setDate] = useState(() => todayStr())
    const [patient, setPatient] = useState({ name: '', phone: '', email: '' })
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [appointmentType, setAppointmentType] = useState('online');
    const [diseaseText, setDiseaseText] = useState('')
    const [medicineHistory, setMedicineHistory] = useState('')
    const [docs, setDocs] = useState([])
    const [voiceBlob, setVoiceBlob] = useState(null)
    const [isRecording, setIsRecording] = useState(false)
    const [recorderUrl, setRecorderUrl] = useState('')
    const [selectedSlot, setSelectedSlot] = useState(null)

    // Consolidated slots and queue fetch in 1 single API query
    const { data: slotsAndQueue, isLoading: loadingSlotsAndQueue, isError: slotsAndQueueError, error: slotsFetchError, refetch: refetchSlotsAndQueue } = useQuery({
        queryKey: ['slotsAndQueue', doctorId, date],
        queryFn: () => getSlotsAndQueue(doctorId, date),
        enabled: !!doctorId && !!date,
        retry: false,
    })

    const updateApptMutation = useMutation({
        mutationFn: ({ id, payload }) => updateAppointment(id, payload),
        onMutate: async ({ id, payload }) => {
            await queryClient.cancelQueries({ queryKey: ['slotsAndQueue', doctorId, date] })
            const previousData = queryClient.getQueryData(['slotsAndQueue', doctorId, date])

            queryClient.setQueryData(['slotsAndQueue', doctorId, date], old => {
                if (!old) return old
                return {
                    ...old,
                    appointments: (old.appointments || []).map(appt => {
                        if (appt._id === id || appt.id === id) {
                            return { ...appt, ...payload }
                        }
                        return appt
                    })
                }
            })

            return { previousData }
        },
        onError: (err, variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['slotsAndQueue', doctorId, date], context.previousData)
            }
            toast.error(err.message || 'Action failed')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['slotsAndQueue', doctorId, date] })
        }
    })

    const cancelApptMutation = useMutation({
        mutationFn: (id) => cancelAppointment(id),
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['slotsAndQueue', doctorId, date] })
            const previousData = queryClient.getQueryData(['slotsAndQueue', doctorId, date])

            queryClient.setQueryData(['slotsAndQueue', doctorId, date], old => {
                if (!old) return old
                return {
                    ...old,
                    appointments: (old.appointments || []).map(appt => {
                        if (appt._id === id || appt.id === id) {
                            return { ...appt, status: 'cancelled' }
                        }
                        return appt
                    })
                }
            })

            return { previousData }
        },
        onError: (err, id, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['slotsAndQueue', doctorId, date], context.previousData)
            }
            toast.error(err.message || 'Cancellation failed')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['slotsAndQueue', doctorId, date] })
        }
    })

    const createApptMutation = useMutation({
        mutationFn: (payload) => createAppointment(payload),
        onMutate: async (payload) => {
            await queryClient.cancelQueries({ queryKey: ['slotsAndQueue', doctorId, date] })
            const previousData = queryClient.getQueryData(['slotsAndQueue', doctorId, date])

            let newAppt = {}
            if (payload instanceof FormData) {
                newAppt = {
                    _id: 'temp-id-' + Date.now(),
                    patientName: payload.get('patientName'),
                    slotStart: payload.get('slotStart'),
                    type: payload.get('type') || 'online',
                    status: 'scheduled',
                    tokenNumber: (previousData?.appointments?.length || 0) + 1
                }
            } else {
                newAppt = {
                    _id: 'temp-id-' + Date.now(),
                    patientName: payload.patientName,
                    slotStart: payload.slotStart,
                    type: payload.type || 'online',
                    status: 'scheduled',
                    tokenNumber: (previousData?.appointments?.length || 0) + 1
                }
            }

            queryClient.setQueryData(['slotsAndQueue', doctorId, date], old => {
                if (!old) return old
                return {
                    ...old,
                    appointments: [...(old.appointments || []), newAppt]
                }
            })

            return { previousData }
        },
        onError: (err, payload, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['slotsAndQueue', doctorId, date], context.previousData)
            }
            toast.error(err.message || 'Booking failed')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['slotsAndQueue', doctorId, date] })
        }
    })


    // Compute slots and filtered counts synchronously using useMemo
    const { slots, todayList, hiddenPastCount } = useMemo(() => {
        const remote = slotsAndQueue?.slots || []
        const appointments = slotsAndQueue?.appointments || []
        const todayLocal = todayStr()
        if (date === todayLocal) {
            const now = Date.now()
            const future = remote.filter(s => {
                try { return new Date(s.start).getTime() > now } catch (e) { return false }
            })
            return {
                slots: future,
                todayList: appointments,
                hiddenPastCount: remote.length - future.length
            }
        }
        return {
            slots: remote,
            todayList: appointments,
            hiddenPastCount: 0
        }
    }, [slotsAndQueue, date])

    const handleDoctorChange = useCallback((val) => {
        setDoctorId(val)
        setSelectedSlot(null)
    }, [])

    const handleDateChange = useCallback((val) => {
        setDate(val)
        setSelectedSlot(null)
    }, [])

    const resetForm = useCallback(async () => {
        setPatient({ name: '', phone: '', email: '' })
        setSelectedPatientId('')
        setDiseaseText('')
        setMedicineHistory('')
        setDocs([])
        setVoiceBlob(null)
        setRecorderUrl('')
        setSelectedSlot(null)
        await refetchSlotsAndQueue()
    }, [refetchSlotsAndQueue])

    const book = async () => {
        if (!selectedSlot) return toast.error('Please select a time slot')
        const slot = selectedSlot
        let patientData = { ...patient };
        if (selectedPatientId) {
            const selected = patients.find(p => p._id === selectedPatientId);
            if (selected) {
                patientData = { name: `${selected.firstName} ${selected.lastName}`, phone: selected.phone, email: selected.email };
            }
        }
        if (!patientData.name) return toast.error('Enter patient name')
        if (!doctorId) return toast.error('Please select a doctor')

        try {
            const slotStartDate = new Date(slot.start)
            const now = new Date()
            if (slotStartDate <= now) {
                return toast.error('Cannot book a past slot. Please select a future time.')
            }
        } catch (e) { }

        const MAX_BYTES = 1073741824
        try {
            let useForm = docs.length > 0 || voiceBlob
            let payload
            if (useForm) {
                const fd = new FormData()
                fd.append('doctorId', doctorId)
                fd.append('patientName', patientData.name)
                if (patientData.phone) fd.append('patientPhone', patientData.phone)
                if (patientData.email) fd.append('patientEmail', patientData.email)
                fd.append('type', appointmentType)
                fd.append('date', date)
                fd.append('slotStart', slot.start)
                if (diseaseText) fd.append('diseaseText', diseaseText)
                if (medicineHistory) fd.append('medicineHistory', medicineHistory)
                if (voiceBlob) {
                    if (voiceBlob.size > MAX_BYTES) return toast.error('Voice file exceeds 1GB limit')
                    fd.append('voice', new File([voiceBlob], 'voice-message.webm', { type: voiceBlob.type || 'audio/webm' }))
                }
                for (let i = 0; i < docs.length; i++) {
                    const f = docs[i]
                    if (f.size > MAX_BYTES) return toast.error(`File ${f.name} exceeds 1GB limit`)
                    fd.append('docs', f)
                }
                payload = fd
            } else {
                payload = { doctorId, patientName: patientData.name, patientPhone: patientData.phone, patientEmail: patientData.email, type: appointmentType, date, slotStart: slot.start, diseaseText, medicineHistory }
            }

            const doctor = doctors.find(d => (d._id || d.id) === doctorId)
            const fee = Number(doctor?.consultationFee || 0)
            if (!fee || fee <= 0) {
                await createApptMutation.mutateAsync(payload)
                toast.success('Appointment booked successfully')
                resetForm()
                return
            }

            const items = [{ description: `Consultation with Dr. ${doctor?.name || ''}`, quantity: 1, unitPrice: fee, gstRate: 0 }]
            const res = await createPaymentLink({ patientName: patientData.name, items, email: patientData.email, phone: patientData.phone, doctorId: doctor?._id || doctor?.id, doctorName: doctor?.name })
            if (!res || !res.paymentRequestId) {
                toast.error('Failed to initiate payment')
                return
            }

            try {
                await loadRazorpay()
                const orderResp = await createRazorpayOrder(res.paymentRequestId)
                if (orderResp && orderResp.order && window.Razorpay) {
                    const order = orderResp.order
                    const options = {
                        key: orderResp.keyId || res.keyId,
                        amount: order.amount,
                        currency: order.currency || 'INR',
                        order_id: order.id,
                        name: import.meta.env.VITE_COMPANY_NAME || 'PharmaPlus HMS',
                        description: `Consultation payment for ${patientData.name}`,
                        handler: async function (response) {
                            try {
                                const verify = await verifyRazorpayPayment(response)
                                if (verify && verify.success) {
                                    if (payload instanceof FormData) {
                                        if (verify.invoiceId) payload.append('invoiceId', verify.invoiceId)
                                    } else {
                                        payload = { ...(payload || {}), invoiceId: verify.invoiceId }
                                    }
                                    await createApptMutation.mutateAsync(payload)
                                    toast.success('Payment verified; appointment booked')
                                    resetForm()
                                } else {
                                    toast.error(verify.message || 'Payment verification failed')
                                }
                            } catch (e) {
                                toast.error(e.message || 'Payment verification failed')
                            }
                        },
                        prefill: { name: patientData.name, email: patientData.email || undefined },
                        theme: { color: '#5942ff' }
                    }
                    const rzp = new window.Razorpay(options)
                    rzp.open()
                    return
                }
            } catch (err) {
                console.error('create order failed', err)
            }

            try {
                window.open(res.shortUrl, '_blank')
                const linkId = res.linkId || res.paymentRequestId
                const iv = setInterval(async () => {
                    try {
                        const st = await checkPaymentLink(linkId)
                        if (st && st.paid) {
                            clearInterval(iv)
                            if (payload instanceof FormData) {
                                if (st.invoiceId) payload.append('invoiceId', st.invoiceId)
                            } else {
                                payload = { ...(payload || {}), invoiceId: st.invoiceId }
                            }
                            await createApptMutation.mutateAsync(payload)
                            toast.success('Payment received; appointment booked')
                            resetForm()
                        }
                    } catch (e) { }
                }, 3000)
            } catch (e) {
                toast.error('Failed to open payment link')
            }
        } catch (e) {
            if (e.status === 409) toast.error('That slot was just taken. Pick another.')
            else toast.error(e.message || 'Booking failed')
        }
    }

    const mediaRecorderRef = useRef(null)
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
        } catch (e) { toast.error('Unable to start recording') }
    }
    const stopRecording = () => {
        try {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop()
        } catch (e) { }
        setIsRecording(false)
    }

    const onDocsChange = useCallback((e) => {
        const files = Array.from(e.target.files || [])
        setDocs(files)
    }, [])

    const checkIn = useCallback((id) => { 
        updateApptMutation.mutate({ id, payload: { status: 'checked-in' } })
    }, [updateApptMutation])
    
    const complete = useCallback((id) => { 
        updateApptMutation.mutate({ id, payload: { status: 'completed' } })
    }, [updateApptMutation])
    
    const noShow = useCallback((id) => { 
        updateApptMutation.mutate({ id, payload: { status: 'no-show' } })
    }, [updateApptMutation])
    
    const cancel = useCallback((id) => { 
        cancelApptMutation.mutate(id)
    }, [cancelApptMutation])

    const shareMeeting = useCallback((apt) => {
        const link = window.prompt('Enter meeting link URL', apt.meetingLink || '')
        if (!link) return
        const email = window.prompt('Send to email (optional)', apt.patientEmail || '')
        updateApptMutation.mutate({ id: apt._id, payload: { meetingLink: link, sendMeetingEmail: true, emailOverride: email || undefined } }, {
            onSuccess: () => {
                toast.success('Meeting link saved and emailed')
            }
        })
    }, [updateApptMutation])

    return (
        <PageContainer>
            <PageHeader
                title={tab}
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Appointments' }]}
                actions={
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        {['New Appointment', 'Queue Management'].map(t => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${tab === t
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                }
            />

            {tab === 'New Appointment' && (
                <div className="space-y-6">
                    <div className="grid lg:grid-cols-2 gap-6">
                        {/* Config Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4 h-full">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
                                <Calendar size={18} className="text-indigo-600" />
                                Appointment Details
                            </h3>

                            <div>
                                <label className="label">Select Doctor</label>
                                <DoctorSelect value={doctorId} onChange={handleDoctorChange} doctors={doctors} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Date</label>
                                    <div className="relative">
                                        <input type="date" className="input !pl-12" value={date} onChange={e => handleDateChange(e.target.value)} />
                                        <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="label">Type</label>
                                    <div className="relative">
                                        <select className="input !pl-12 appearance-none" value={appointmentType} onChange={e => setAppointmentType(e.target.value)}>
                                            <option value="online">Online Video</option>
                                            <option value="walk-in">Walk-in Visit</option>
                                        </select>
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                            {appointmentType === 'online' ? <Video size={18} /> : <MapPin size={18} />}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Patient Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4 h-full">
                            <h3 className="font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
                                <Users size={18} className="text-indigo-600" />
                                Patient Details
                            </h3>

                            <div>
                                <label className="label">Select Registered Patient</label>
                                <PatientSelect value={selectedPatientId} onChange={setSelectedPatientId} patients={patients} />
                                <div className="text-xs text-slate-400 mt-1 italic">Selecting a patient auto-fills valid contact info.</div>
                            </div>

                            <div className="pt-2 border-t border-slate-50">
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Or Enter Manually</div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="label">Full Name</label>
                                        <div className="relative">
                                            <input
                                                className="input !pl-12"
                                                placeholder="e.g. John Doe"
                                                value={patient.name}
                                                onChange={e => setPatient({ ...patient, name: e.target.value })}
                                                disabled={!!selectedPatientId}
                                            />
                                            <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="label">Phone</label>
                                            <div className="relative">
                                                <input
                                                    className="input !pl-12"
                                                    placeholder="+91..."
                                                    value={patient.phone}
                                                    onChange={e => setPatient({ ...patient, phone: e.target.value })}
                                                    disabled={!!selectedPatientId}
                                                />
                                                <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="label">Email</label>
                                            <div className="relative">
                                                <input
                                                    className="input !pl-12"
                                                    placeholder="john@example.com"
                                                    value={patient.email}
                                                    onChange={e => setPatient({ ...patient, email: e.target.value })}
                                                    disabled={!!selectedPatientId}
                                                />
                                                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Medical Info Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-6">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-50 pb-3">
                            <FileText size={18} className="text-indigo-600" />
                            Medical Information
                        </h3>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="label">Symptoms / Disease Description</label>
                                    <textarea
                                        className="input h-32 resize-none"
                                        value={diseaseText}
                                        onChange={e => setDiseaseText(e.target.value)}
                                        placeholder="Describe what the patient is experiencing..."
                                    />
                                </div>
                                <div>
                                    <label className="label">Medicine History</label>
                                    <div className="relative">
                                        <textarea
                                            className="input h-24 resize-none !pl-12 py-3"
                                            value={medicineHistory}
                                            onChange={e => setMedicineHistory(e.target.value)}
                                            placeholder="Current or previous medications..."
                                        />
                                        <Pill size={18} className="absolute left-3 top-4 text-slate-400" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="label">Voice Message (Optional)</label>
                                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 flex items-center gap-4">
                                        <button
                                            onClick={isRecording ? stopRecording : startRecording}
                                            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isRecording
                                                ? 'bg-red-100 text-red-600 animate-pulse'
                                                : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                                                }`}
                                        >
                                            {isRecording ? <Square size={20} fill="currentColor" /> : <Mic size={20} />}
                                        </button>
                                        <div className="flex-1">
                                            {isRecording ? (
                                                <div className="text-sm font-medium text-red-600">Recording...</div>
                                            ) : recorderUrl ? (
                                                <audio src={recorderUrl} controls className="h-8 w-full" />
                                            ) : (
                                                <div className="text-sm text-slate-400">Click mic to record notes</div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="label">Supporting Documents</label>
                                    <div className="bg-slate-50 rounded-lg border border-slate-200 border-dashed p-6 text-center hover:bg-slate-100 transition-colors cursor-pointer relative">
                                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" multiple onChange={onDocsChange} />
                                        <Upload size={24} className="mx-auto text-slate-400 mb-2" />
                                        <div className="text-sm font-medium text-slate-700">Click to upload files</div>
                                        <div className="text-xs text-slate-400 mt-1">Images, PDF, Reports (Max 1GB)</div>
                                    </div>
                                    {docs.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {docs.map((f, i) => (
                                                <div key={i} className="flex items-center gap-2 text-xs bg-white border border-slate-200 rounded px-2 py-1">
                                                    <FileText size={12} className="text-slate-400" />
                                                    <span className="truncate flex-1">{f.name}</span>
                                                    <span className="text-slate-400">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Slots Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Clock size={18} className="text-indigo-600" />
                            Available Slots
                        </h3>
                        {loadingSlotsAndQueue ? (
                            <div className="py-10 flex flex-col items-center justify-center text-slate-400 animate-pulse">
                                <Loader2 size={32} className="animate-spin mb-2" />
                                <span>Loading slots...</span>
                            </div>
                        ) : slotsAndQueueError ? (
                            <div className="py-8 text-center text-red-600 bg-red-50 border border-red-100 rounded-lg">
                                {slotsFetchError?.message || 'Failed to fetch available slots'}
                            </div>
                        ) : (
                            <div>
                                {!doctorId ? (
                                    <div className="py-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-100 border-dashed">
                                        Please select a doctor to load available slots.
                                    </div>
                                ) : slots.length === 0 ? (
                                    <div className="py-8 text-center text-slate-500 bg-slate-50 rounded-lg border border-slate-100 border-dashed">
                                        No slots available for this date.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                        {slots.map((s, idx) => {
                                            const start = new Date(s.start)
                                            const now = new Date()
                                            const isPast = start <= now
                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => !isPast && setSelectedSlot(s)}
                                                    disabled={isPast}
                                                    type="button"
                                                    title={isPast ? 'Past slot' : 'Select this slot'}
                                                    className={`
                                                        py-2 px-1 rounded-lg text-sm font-medium transition-all text-center
                                                        ${isPast
                                                            ? 'bg-slate-100 text-slate-400 opacity-60 cursor-not-allowed'
                                                            : selectedSlot?.start === s.start
                                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-105 z-10'
                                                                : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 shadow-sm active:scale-95'
                                                        }
                                                    `}
                                                >
                                                    {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-6 pt-6 border-t border-slate-100">
                            <button
                                onClick={book}
                                disabled={!doctorId || !date || !selectedSlot}
                                className="w-full sm:w-auto px-10 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                                type="button"
                            >
                                {Number(doctors.find(d => (d._id || d.id) === doctorId)?.consultationFee || 0) > 0 ? 'Pay and Submit' : 'Book Appointment'}
                            </button>
                            {selectedSlot && (
                                <p className="text-xs text-slate-400 mt-2">Slot selected: {new Date(selectedSlot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {tab === 'Queue Management' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex gap-4 w-full sm:w-auto">
                            <DoctorSelect value={doctorId} onChange={handleDoctorChange} doctors={doctors} />
                            <div className="space-y-3">
                                <div className="relative">
                                    <input type="date" className="input !pl-12" value={date} onChange={e => handleDateChange(e.target.value)} />
                                    <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Total Appointments</div>
                            <div className="text-2xl font-bold text-slate-800">{todayList.length}</div>
                        </div>
                    </div>

                    <div className="table-responsive overflow-x-auto">
                        <table className="w-full text-sm text-left min-w-[1000px]">
                            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4">Token</th>
                                    <th className="px-6 py-4">Patient</th>
                                    <th className="px-6 py-4">Time</th>
                                    <th className="px-6 py-4">Type</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loadingSlotsAndQueue ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading queue...</td></tr>
                                ) : !doctorId ? (
                                    <tr><td colSpan={6} className="p-12 text-center text-slate-500">Please select a doctor to view queue.</td></tr>
                                ) : todayList.length === 0 ? (
                                    <tr><td colSpan={6} className="p-12 text-center text-slate-500">No appointments found for this filter.</td></tr>
                                ) : todayList.map(a => (
                                    <AppointmentRow
                                        key={a._id}
                                        a={a}
                                        onCheckIn={checkIn}
                                        onComplete={complete}
                                        onNoShow={noShow}
                                        onCancel={cancel}
                                        onShareMeeting={shareMeeting}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </PageContainer>
    )
}
