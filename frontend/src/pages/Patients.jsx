import { useProfileRender } from '../utils/profiler';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listPatients, createPatient, updatePatient, deletePatient, getPatient, listDoctorPatients, listAppointmentsByPatient, listAppointments, getMyTenant, getPatientProfile } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, User, Mail, Phone, MapPin, Calendar, Clock, FileText, Download, X, Edit, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import VirtualizedTable from '../components/common/VirtualizedTable';

const StatusBadge = React.memo(({ status }) => {
    const s = (status || 'pending').toLowerCase()
    const colors = {
        completed: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        cancelled: 'bg-red-50 text-red-700 border-red-100',
        scheduled: 'bg-blue-50 text-blue-700 border-blue-100',
        rescheduled: 'bg-amber-50 text-amber-700 border-amber-100'
    }
    return <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${colors[s] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>{status}</span>
})

// Memoized Patient Row Component
const PatientRow = React.memo(({ p, handleEdit, openAppts, handleDelete }) => {
    const queryClient = useQueryClient()
    const handlePrefetch = useCallback(() => {
        const id = p.patientId || p._id
        if (id) {
            queryClient.prefetchQuery({
                queryKey: ['patientProfile', id],
                queryFn: () => getPatientProfile(id),
            })
        }
    }, [p.patientId, p._id, queryClient])

    return (
        <tr className="hover:bg-slate-50/80 transition-colors group">
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-sm">
                        {(p.name || 'P')?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="font-semibold text-slate-800">{p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || (p.email ? p.email.split('@')[0] : 'Unnamed')}</div>
                        <div className="text-xs text-slate-500">{p.dob ? `DOB: ${new Date(p.dob).toLocaleDateString()}` : ''} {p.gender ? `• ${p.gender}` : ''}</div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="flex flex-col gap-1 text-sm text-slate-600">
                    <span>{p.email || '—'}</span>
                    <span className="text-xs text-slate-500">{p.phone || '—'}</span>
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="text-sm">
                    <div className="font-medium text-slate-700">{p.totalAppointments || 0} Visits</div>
                    {p.lastAppointmentAt && <div className="text-xs text-slate-500">Last: {new Date(p.lastAppointmentAt).toLocaleDateString()}</div>}
                </div>
            </td>
            <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                {p.address || '—'}
            </td>
            <td className="px-6 py-4 text-center">
                <div className="flex items-center justify-center gap-2">
                    <Link to={`${p.patientId || p._id}`} onMouseEnter={handlePrefetch} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <User size={16} />
                    </Link>
                    <button className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit" onClick={() => handleEdit(p)}>
                        <Edit size={16} />
                    </button>
                    <button className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Appointments" onClick={() => openAppts(p)}>
                        <Calendar size={16} />
                    </button>
                    <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete" onClick={() => handleDelete(p)}>
                        <Trash2 size={16} />
                    </button>
                </div>
            </td>
        </tr>
    )
})

export default function Patients() {
    useProfileRender('Patients', true);
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const limit = 25;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [prefill, setPrefill] = useState(null);
    const [editingPatientId, setEditingPatientId] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Appointment modal
    const [apptModalOpen, setApptModalOpen] = useState(false);
    const [apptPatient, setApptPatient] = useState(null);
    const [openApptId, setOpenApptId] = useState(null);

    const [search, setSearch] = useState('');

    const [selectedEditId, setSelectedEditId] = useState(null)
    const { data: editingPatientDetails } = useQuery({
        queryKey: ['patientDetails', selectedEditId],
        queryFn: () => getPatient(selectedEditId),
        enabled: !!selectedEditId,
    })

    const { data: patientAppts, isLoading: loadingAppointments } = useQuery({
        queryKey: ['patientAppointments', apptPatient?.patientId || apptPatient?._id],
        queryFn: async () => {
            const p = apptPatient
            if (Array.isArray(p.appointments) && p.appointments.length > 0) return p.appointments
            const pid = p.patientId || p._id || p.patient || p.id
            if (pid) return await listAppointmentsByPatient(pid) || []
            if (p.email) return await listAppointments({ q: p.email }) || []
            return []
        },
        enabled: apptModalOpen && !!apptPatient,
    })

    const appointments = useMemo(() => patientAppts || [], [patientAppts])

    // Load Tenant Limit details using TanStack Query
    const { data: tenantData } = useQuery({
        queryKey: ['tenant'],
        queryFn: getMyTenant,
        enabled: !!user,
    });
    const tenant = tenantData?.tenant || null;
    const canCreatePatient = useMemo(() => {
        if (!tenant) return true;
        if (tenant.plan?.limits?.patients == null) return true;
        return (tenant.usage?.patients || 0) < tenant.plan.limits.patients;
    }, [tenant]);

    // TanStack Query caching & pagination
    const { data: rawPatients, isLoading: loading, refetch: fetchPatients } = useQuery({
        queryKey: ['patients', user?.role, page],
        queryFn: async () => {
            if (user?.role === 'doctor') {
                return await listDoctorPatients();
            }
            return await listPatients({ page, limit });
        },
        enabled: !!user?.role,
    });

    const patients = useMemo(() => {
        return Array.isArray(rawPatients) ? rawPatients : [];
    }, [rawPatients])

    const createPatientMutation = useMutation({
        mutationFn: createPatient,
        onMutate: async (newPatient) => {
            await queryClient.cancelQueries({ queryKey: ['patients', user?.role, page] })
            const previousPatients = queryClient.getQueryData(['patients', user?.role, page])

            queryClient.setQueryData(['patients', user?.role, page], old => {
                const arr = Array.isArray(old) ? old : []
                return [...arr, { _id: 'temp-id-' + Date.now(), name: `${newPatient.firstName} ${newPatient.lastName}`, ...newPatient }]
            })

            return { previousPatients }
        },
        onError: (err, newPatient, context) => {
            if (context?.previousPatients) {
                queryClient.setQueryData(['patients', user?.role, page], context.previousPatients)
            }
            toast.error(err.message || 'Failed to create patient')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['patients', user?.role, page] })
        }
    })

    const updatePatientMutation = useMutation({
        mutationFn: ({ id, data }) => updatePatient(id, data),
        onMutate: async ({ id, data }) => {
            await queryClient.cancelQueries({ queryKey: ['patients', user?.role, page] })
            const previousPatients = queryClient.getQueryData(['patients', user?.role, page])

            queryClient.setQueryData(['patients', user?.role, page], old => {
                const arr = Array.isArray(old) ? old : []
                return arr.map(p => {
                    if (p._id === id || p.patientId === id) {
                        return { ...p, ...data, name: `${data.firstName} ${data.lastName}` }
                    }
                    return p
                })
            })

            return { previousPatients }
        },
        onError: (err, variables, context) => {
            if (context?.previousPatients) {
                queryClient.setQueryData(['patients', user?.role, page], context.previousPatients)
            }
            toast.error(err.message || 'Failed to update patient')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['patients', user?.role, page] })
        }
    })

    const deletePatientMutation = useMutation({
        mutationFn: deletePatient,
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['patients', user?.role, page] })
            const previousPatients = queryClient.getQueryData(['patients', user?.role, page])

            queryClient.setQueryData(['patients', user?.role, page], old => {
                const arr = Array.isArray(old) ? old : []
                return arr.filter(p => p._id !== id && p.patientId !== id)
            })

            return { previousPatients }
        },
        onError: (err, id, context) => {
            if (context?.previousPatients) {
                queryClient.setQueryData(['patients', user?.role, page], context.previousPatients)
            }
            toast.error(err.message || 'Failed to delete patient')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['patients', user?.role, page] })
        }
    })

    const handleCloseModal = useCallback(() => {
        setIsModalOpen(false); setEditingPatientId(null); setPrefill(null); setSelectedEditId(null);
    }, []);

    const handleSave = useCallback(async (e) => {
        e.preventDefault();
        if (isSaving) return;
        setIsSaving(true);
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        try {
            if (editingPatientId) {
                await updatePatientMutation.mutateAsync({ id: editingPatientId, data });
            } else {
                await createPatientMutation.mutateAsync(data);
            }
            toast.success(editingPatientId ? 'Patient updated' : 'Patient registered');
            handleCloseModal();
        } catch (error) {
            // Already handled
        } finally {
            setIsSaving(false)
        }
    }, [editingPatientId, isSaving, updatePatientMutation, createPatientMutation, handleCloseModal]);

    const openCreate = useCallback((defaults = null, id = null) => {
        if (!id && !canCreatePatient) {
            if (tenant?.subscriptionEnd && new Date() >= new Date(tenant.subscriptionEnd)) {
                navigate('/director/queryforplan')
                return
            }
            toast.info('Patient limit reached. Upgrade plan.')
            return
        }
        setPrefill(defaults); setEditingPatientId(id); setIsModalOpen(true);
    }, [canCreatePatient, tenant]);

    useEffect(() => {
        if (!editingPatientDetails || !selectedEditId) return
        const d = editingPatientDetails
        setPrefill({
            firstName: d.firstName || d.name || '', lastName: d.lastName || '',
            email: d.email || '', phone: d.phone || '', address: d.address || '',
            bloodGroup: d.bloodGroup || d.blood_group || '', dob: d.dob || d.dateOfBirth || '',
            gender: d.gender || d.sex || ''
        })
        setEditingPatientId(selectedEditId)
        setIsModalOpen(true)
    }, [editingPatientDetails, selectedEditId])

    const handleEdit = useCallback((p) => {
        const id = p.patientId || p._id
        if (id) {
            setSelectedEditId(id)
        } else {
            openCreate({ firstName: p.name || '', email: p.email || '', phone: p.phone || '' })
        }
    }, [openCreate]);

    const handleDelete = useCallback(async (p) => {
        const id = p.patientId || p._id;
        if (!id || !confirm('Permanently delete this patient?')) return
        try {
            await deletePatientMutation.mutateAsync(id);
            toast.success('Patient deleted');
        } catch (e) {
            // Already handled
        }
    }, [deletePatientMutation]);

    const openAppts = useCallback((p) => {
        setApptPatient(p);
        setApptModalOpen(true);
    }, []);

    const exportCSV = useCallback(() => {
        if (!appointments.length) return toast.info('No appointments')
        const headers = ['Date', 'Doctor', 'Status', 'Notes']
        const rows = appointments.map(a => [
            new Date(a.slotStart).toLocaleString(),
            a.doctor?.name || a.doctorName || '-',
            a.status,
            a.notes || ''
        ])
        const csv = [headers.join(',')].concat(rows.map(r => r.map(c => `"${c}"`).join(','))).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'appointments.csv'; a.click()
    }, [appointments]);

    const formattedPatients = useMemo(() => {
        return patients.filter(p => {
            if (!search) return true
            const fullName = (p.name || `${p.firstName || ''} ${p.lastName || ''}`).toLowerCase();
            return fullName.includes(search.toLowerCase()) || 
                   (p.email && p.email.toLowerCase().includes(search.toLowerCase())) || 
                   (p.phone && p.phone.includes(search))
        })
    }, [patients, search])

    const hasMore = patients.length === limit;

    return (
        <PageContainer>
            <PageHeader
                title="Patients"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Patients' }]}
                actions={
                    <button
                        onClick={() => openCreate()}
                        className={`flex items-center gap-2 btn btn-primary ${!canCreatePatient ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        <Plus size={18} /> Register Patient
                    </button>
                }
            />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-12rem)] md:h-auto overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search patients..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                        />
                    </div>
                </div>

                <div className="table-responsive flex-1 overflow-x-auto">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Loading patients...</div>
                    ) : formattedPatients.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No patients found.</div>
                    ) : (
                        <VirtualizedTable
                            items={formattedPatients}
                            rowHeight={72}
                            viewportHeight={400}
                            colSpan={5}
                            className="min-w-[1000px]"
                            headers={
                                <tr>
                                    <th className="px-6 py-4">Patient Details</th>
                                    <th className="px-6 py-4">Contact</th>
                                    <th className="px-6 py-4">Appointments</th>
                                    <th className="px-6 py-4">Address</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            }
                            renderRow={(p) => (
                                <PatientRow 
                                    key={p.patientId || p._id} 
                                    p={p} 
                                    handleEdit={handleEdit} 
                                    openAppts={openAppts} 
                                    handleDelete={handleDelete} 
                                />
                            )}
                        />
                    )}
                </div>

                {/* Pagination Controls */}
                {user?.role !== 'doctor' && (
                    <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm bg-slate-50/50">
                        <div className="text-slate-500">Page {page}</div>
                        <div className="flex gap-2">
                            <button 
                                className="btn btn-sm btn-ghost" 
                                onClick={() => setPage(p => Math.max(1, p - 1))} 
                                disabled={loading || page === 1}
                            >
                                Previous
                            </button>
                            <button 
                                className="btn btn-sm btn-ghost" 
                                onClick={() => setPage(p => p + 1)} 
                                disabled={loading || !hasMore}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                                <h2 className="text-xl font-bold text-slate-800">{editingPatientId ? 'Edit Patient' : 'Register Patient'}</h2>
                                <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} className="text-slate-500" /></button>
                            </div>
                            <form onSubmit={handleSave} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input name="firstName" placeholder="First Name" className="input" required defaultValue={prefill?.firstName} />
                                <input name="lastName" placeholder="Last Name" className="input" defaultValue={prefill?.lastName} />
                                <input type="email" name="email" placeholder="Email" className="input" defaultValue={prefill?.email} />
                                <input name="phone" placeholder="Phone" className="input" defaultValue={prefill?.phone} />
                                <div className="flex items-center gap-3">
                                    <label className="text-xs font-bold text-slate-500 uppercase whitespace-nowrap min-w-[100px]">Date of Birth</label>
                                    <input type="date" name="dob" className="input flex-1" defaultValue={prefill?.dob ? prefill.dob.slice(0, 10) : ''} />
                                </div>
                                <select name="gender" className="input" defaultValue={prefill?.gender}>
                                    <option value="">Gender</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                                <input name="bloodGroup" placeholder="Blood Group" className="input" defaultValue={prefill?.bloodGroup} />
                                <input name="address" placeholder="Address" className="input md:col-span-2" defaultValue={prefill?.address} />

                                <div className="md:col-span-2 flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
                                    <button type="button" onClick={handleCloseModal} className="btn btn-ghost">Cancel</button>
                                    <button type="submit" disabled={isSaving} className="btn btn-primary">{isSaving ? 'Saving...' : 'Save Patient'}</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {apptModalOpen && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col"
                        >
                            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Appointment History</h2>
                                    <div className="text-sm text-slate-500">For {apptPatient?.name}</div>
                                </div>
                                <div className="flex gap-2">
                                    {appointments.length > 0 && (
                                        <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-slate-50">
                                            <Download size={14} /> Export CSV
                                        </button>
                                    )}
                                    <button onClick={() => setApptModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} className="text-slate-500" /></button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-auto p-0">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-3 font-semibold text-slate-600">Date & Time</th>
                                            <th className="px-6 py-3 font-semibold text-slate-600">Doctor</th>
                                            <th className="px-6 py-3 font-semibold text-slate-600">Type</th>
                                            <th className="px-6 py-3 font-semibold text-slate-600">Status</th>
                                            <th className="px-6 py-3 font-semibold text-slate-600">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {loadingAppointments ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading history...</td></tr>
                                        ) : appointments.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">No appointments found.</td></tr>
                                        ) : appointments.map(a => (
                                            <React.Fragment key={a._id}>
                                                <tr className="hover:bg-slate-50 cursor-pointer" onClick={() => setOpenApptId(openApptId === a._id ? null : a._id)}>
                                                    <td className="px-6 py-4 text-slate-700 font-medium">
                                                        {new Date(a.slotStart).toLocaleDateString()}
                                                        <div className="text-xs text-slate-500">{new Date(a.slotStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-medium text-slate-700">{a.doctor?.name || a.doctorName || 'Unknown Doctor'}</div>
                                                    </td>
                                                    <td className="px-6 py-4 capitalize">{a.type}</td>
                                                    <td className="px-6 py-4"><StatusBadge status={a.status} /></td>
                                                    <td className="px-6 py-4">
                                                        <button className="text-blue-600 text-xs font-semibold hover:underline">
                                                            {openApptId === a._id ? 'Hide' : 'View'}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {openApptId === a._id && (
                                                    <tr className="bg-slate-50/50">
                                                        <td colSpan={5} className="px-6 py-4">
                                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                                <div>
                                                                    <div className="text-slate-500 text-xs uppercase font-bold mb-1">Notes</div>
                                                                    <div className="bg-white p-3 rounded border border-slate-100">{a.notes || 'No notes'}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-slate-500 text-xs uppercase font-bold mb-1">Disease / Issue</div>
                                                                    <div className="bg-white p-3 rounded border border-slate-100">{a.diseaseText || 'N/A'}</div>
                                                                </div>
                                                                {a.medicineHistory && (
                                                                    <div className="col-span-2">
                                                                        <div className="text-slate-500 text-xs uppercase font-bold mb-1">Medicine History</div>
                                                                        <div className="bg-white p-3 rounded border border-slate-100">{a.medicineHistory}</div>
                                                                    </div>
                                                                )}
                                                                {a.docs && a.docs.length > 0 && (
                                                                    <div className="col-span-2">
                                                                        <div className="text-slate-500 text-xs uppercase font-bold mb-1">Documents</div>
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {a.docs.map((d, i) => (
                                                                                <a key={i} href={d.path?.startsWith('/') ? d.path : '/' + d.path} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-blue-600 hover:text-blue-800 text-xs font-medium">
                                                                                    <FileText size={14} /> {d.originalname || d.filename || 'Document'}
                                                                                </a>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </PageContainer>
    );
}
