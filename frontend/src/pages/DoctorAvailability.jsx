import { useProfileRender } from '../utils/profiler';
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { listDoctors, getAvailability, setAvailability } from '../services/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'
import { Clock, Save, Calendar, User, Check, X } from 'lucide-react'
import { toast } from 'react-toastify'

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function DayRow({ cfg, onChange }) {
    return (
        <tr className={`group transition-colors ${cfg.enabled ? 'hover:bg-slate-50' : 'bg-slate-50/50'}`}>
            <td className="px-6 py-4 font-medium text-slate-700">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${cfg.enabled ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                    {days[cfg.dayOfWeek]}
                </div>
            </td>
            <td className="px-6 py-4">
                <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={cfg.enabled} onChange={e => onChange({ ...cfg, enabled: e.target.checked })} />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
            </td>
            <td className="px-6 py-4">
                <div className="relative">
                    <input
                        type="time"
                        disabled={!cfg.enabled}
                        className="input disabled:bg-slate-100 disabled:text-slate-400"
                        value={cfg.startTime}
                        onChange={e => onChange({ ...cfg, startTime: e.target.value })}
                    />
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="relative">
                    <input
                        type="time"
                        disabled={!cfg.enabled}
                        className="input disabled:bg-slate-100 disabled:text-slate-400"
                        value={cfg.endTime}
                        onChange={e => onChange({ ...cfg, endTime: e.target.value })}
                    />
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="relative max-w-[120px]">
                    <input
                        type="number"
                        min={5}
                        step={5}
                        disabled={!cfg.enabled}
                        className="input disabled:bg-slate-100 disabled:text-slate-400"
                        value={cfg.slotDurationMin}
                        onChange={e => onChange({ ...cfg, slotDurationMin: Number(e.target.value) })}
                    />
                </div>
            </td>
        </tr>
    )
}

export default function DoctorAvailability() {
    useProfileRender('DoctorAvailability', true);
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const [doctorId, setDoctorId] = useState('')
    const [doc, setDoc] = useState(null)

    useEffect(() => {
        if (user?.role === 'doctor') {
            setDoctorId(user.id)
        }
    }, [user])

    const { data: doctorsData = [] } = useQuery({
        queryKey: ['doctors', 'list'],
        queryFn: () => listDoctors(),
        enabled: user?.role !== 'doctor'
    })

    const doctors = doctorsData

    const { data: availabilityData } = useQuery({
        queryKey: ['availability', doctorId],
        queryFn: () => getAvailability(doctorId),
        enabled: !!doctorId
    })

    useEffect(() => {
        if (availabilityData) {
            const docData = { ...availabilityData }
            if (!docData.days || !Array.isArray(docData.days) || docData.days.length === 0) {
                docData.days = [0, 1, 2, 3, 4, 5, 6].map(dow => ({ dayOfWeek: dow, enabled: false, startTime: '09:00', endTime: '17:00', slotDurationMin: 15 }))
            }
            setDoc(docData)
        }
    }, [availabilityData])

    const updateDay = (dow, val) => setDoc(prev => ({ ...prev, days: prev.days.map((d) => d.dayOfWeek === dow ? val : d) }))

    const saveMutation = useMutation({
        mutationFn: (payload) => setAvailability(doctorId, payload),
        onMutate: async (payload) => {
            await queryClient.cancelQueries({ queryKey: ['availability', doctorId] })
            const previousAvailability = queryClient.getQueryData(['availability', doctorId])
            queryClient.setQueryData(['availability', doctorId], payload)
            return { previousAvailability }
        },
        onError: (err, payload, context) => {
            if (context?.previousAvailability) {
                queryClient.setQueryData(['availability', doctorId], context.previousAvailability)
            }
            toast.error(err.message || 'Failed to save')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['availability', doctorId] })
        },
        onSuccess: () => {
            toast.success('Availability updated successfully')
        }
    })

    const save = () => {
        if (!doc) return
        saveMutation.mutate({ days: doc.days, exceptions: doc.exceptions || [] })
    }

    const saving = saveMutation.isPending

    return (
        <PageContainer>
            <PageHeader
                title="Availability Configuration"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Availability' }]}
            />

            <div className="max-w-5xl mx-auto space-y-6">
                {/* Doctor Selection (Admin only) */}
                {user?.role !== 'doctor' && (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <User size={20} />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider mb-1 block">Select Doctor</label>
                            <select className="input w-full max-w-md" value={doctorId || ''} onChange={e => setDoctorId(e.target.value)}>
                                <option value="">Select doctor...</option>
                                {doctors.map(d => <option key={d._id || d.id} value={d._id || d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div>
                            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                <Calendar size={18} className="text-indigo-600" />
                                Weekly Schedule
                            </h2>
                            <p className="text-xs text-slate-500 mt-1">Configure your working hours for each day of the week.</p>
                        </div>
                        <button
                            className="btn btn-primary flex items-center gap-2"
                            disabled={saving || !doc}
                            onClick={save}
                        >
                            <Save size={16} />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>

                    {doc ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[800px]">
                                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100 text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-3 text-left w-32">Day</th>
                                        <th className="px-6 py-3 text-left w-24">Status</th>
                                        <th className="px-6 py-3 text-left">Start Time</th>
                                        <th className="px-6 py-3 text-left">End Time</th>
                                        <th className="px-6 py-3 text-left">Slot Duration (Min)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {doc.days.sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((d) => (
                                        <DayRow key={d.dayOfWeek} cfg={d} onChange={val => updateDay(d.dayOfWeek, val)} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                            <Calendar size={48} className="mb-4 opacity-20" />
                            <p>{user?.role !== 'doctor' && !doctorId ? 'Please select a doctor to load schedule.' : 'Loading availability...'}</p>
                        </div>
                    )}
                </div>
            </div>
        </PageContainer>
    )
}

