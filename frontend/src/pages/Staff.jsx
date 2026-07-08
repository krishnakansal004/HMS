import { useProfileRender } from '../utils/profiler';
import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listStaff, createStaff, updateStaff, deleteStaff, getMyTenant } from '../services/api'
import { User, Mail, Phone, MapPin, Briefcase, Plus, Edit, Trash2, X, Clock } from 'lucide-react'
import { toast } from 'react-toastify'
import { motion, AnimatePresence } from 'framer-motion'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'
import VirtualizedTable from '../components/common/VirtualizedTable'

const StaffRow = React.memo(({ s, setSelectedStaff, setIsModalOpen, handleDelete }) => {
    return (
        <tr className="hover:bg-slate-50/80 transition-colors group">
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold">
                        {s.name?.charAt(0)}
                    </div>
                    <div>
                        <div className="font-semibold text-slate-800">{s.name}</div>
                        <div className="text-xs text-slate-500 capitalize">{s.role}</div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="flex flex-col gap-1 text-sm text-slate-600">
                    <div className="flex items-center gap-2"><Mail size={14} className="text-slate-400" /> {s.email}</div>
                    <div className="flex items-center gap-2"><Phone size={14} className="text-slate-400" /> {s.phone}</div>
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="text-sm text-slate-700 font-medium">{s.department || '—'}</div>
                <div className="text-xs text-slate-500">{s.designation}</div>
            </td>
            <td className="px-6 py-4 text-center">
                <div className="flex items-center justify-center gap-2">
                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" onClick={() => { setSelectedStaff(s); setIsModalOpen(true) }}>
                        <Edit size={16} />
                    </button>
                    <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg" onClick={() => handleDelete(s._id || s.id)}>
                        <Trash2 size={16} />
                    </button>
                </div>
            </td>
        </tr>
    )
})

export default function Staff() {
    useProfileRender('Staff', true);
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const limit = 25;
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState(null);

    // Load Tenant Limit details using TanStack Query
    const { data: tenantData } = useQuery({
        queryKey: ['tenant'],
        queryFn: getMyTenant
    })
    const tenant = tenantData?.tenant || null
    const canCreateStaff = useMemo(() => {
        if (!tenant) return true
        if (tenant.plan?.limits?.staff == null) return true
        return (tenant.usage?.staff || 0) < tenant.plan.limits.staff
    }, [tenant])

    // TanStack Query caching & pagination
    const { data: rawStaff, isLoading: loading, refetch: fetchStaff } = useQuery({
        queryKey: ['staff', page],
        queryFn: () => listStaff({ page, limit }),
    });

    const staff = useMemo(() => {
        return Array.isArray(rawStaff) ? rawStaff : [];
    }, [rawStaff])

    const handleSave = useCallback(async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const entries = Object.fromEntries(formData.entries());

        // Handle nested weeklySchedule
        const weeklySchedule = {};
        Object.keys(entries).forEach(k => {
            if (k.startsWith('weeklySchedule.')) {
                weeklySchedule[k.split('.')[1]] = entries[k];
                delete entries[k];
            }
        });
        if (Object.keys(weeklySchedule).length) entries.weeklySchedule = weeklySchedule;

        try {
            if (!selectedStaff && !canCreateStaff) {
                toast.error('Staff limit reached')
                return
            }
            if (selectedStaff) await updateStaff(selectedStaff._id || selectedStaff.id, entries);
            else await createStaff(entries);
            toast.success(selectedStaff ? 'Staff updated' : 'Staff added');
            fetchStaff();
            setIsModalOpen(false);
        } catch (error) {
            toast.error(error.message || 'Failed to save staff');
        }
    }, [selectedStaff, canCreateStaff, fetchStaff]);

    const handleDelete = useCallback(async (id) => {
        if (!confirm('Delete this staff member?')) return;
        try {
            await deleteStaff(id);
            toast.success('Staff deleted');
            fetchStaff();
        } catch (error) { toast.error('Failed to delete staff'); }
    }, [fetchStaff]);

    const filtered = useMemo(() => {
        return staff.filter(s => {
            if (!search) return true
            return [s.name, s.email, s.phone, s.role].join(' ').toLowerCase().includes(search.toLowerCase())
        })
    }, [staff, search])

    const hasMore = staff.length === limit

    return (
        <PageContainer>
            <PageHeader
                title="Staff Management"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Staff' }]}
                actions={
                    <button
                        onClick={() => {
                            if (!canCreateStaff) {
                                if (tenant?.subscriptionEnd && new Date() >= new Date(tenant.subscriptionEnd)) {
                                    navigate('/director/queryforplan')
                                    return
                                }
                                toast.info('Staff limit reached. Upgrade plan.')
                                return
                            }
                            setSelectedStaff(null); setIsModalOpen(true)
                        }}
                        className={`flex items-center gap-2 btn btn-primary ${!canCreateStaff ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        <Plus size={18} /> Add Staff
                    </button>
                }
            />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-12rem)] md:h-auto overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-slate-50/50">
                    <div className="relative flex-1 max-w-md">
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search staff members..."
                            className="w-full pl-4 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                        />
                    </div>
                </div>

                <div className="table-responsive flex-1 overflow-x-auto">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Loading staff...</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No staff members found.</div>
                    ) : (
                        <VirtualizedTable
                            items={filtered}
                            rowHeight={72}
                            viewportHeight={400}
                            colSpan={4}
                            className="min-w-[800px]"
                            headers={
                                <tr>
                                    <th className="px-6 py-4">Name & Role</th>
                                    <th className="px-6 py-4">Contact Info</th>
                                    <th className="px-6 py-4">Department</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            }
                            renderRow={(s) => (
                                <StaffRow
                                    key={s._id || s.id}
                                    s={s}
                                    setSelectedStaff={setSelectedStaff}
                                    setIsModalOpen={setIsModalOpen}
                                    handleDelete={handleDelete}
                                />
                            )}
                        />
                    )}
                </div>

                {/* Pagination Controls */}
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
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                                <h2 className="text-xl font-bold text-slate-800">{selectedStaff ? 'Edit Staff' : 'Add Staff'}</h2>
                                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} className="text-slate-500" /></button>
                            </div>
                            <form onSubmit={handleSave} className="p-6 space-y-4">
                                <div><label className="label">Name</label><input name="name" defaultValue={selectedStaff?.name} className="input" required /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="label">Role</label><input name="role" defaultValue={selectedStaff?.role} className="input" required /></div>
                                    <div><label className="label">Department</label><input name="department" defaultValue={selectedStaff?.department} className="input" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="label">Email</label><input type="email" name="email" defaultValue={selectedStaff?.email} className="input" required /></div>
                                    <div><label className="label">Phone</label><input name="phone" defaultValue={selectedStaff?.phone} className="input" /></div>
                                </div>
                                <div><label className="label">Designation</label><input name="designation" defaultValue={selectedStaff?.designation} className="input" /></div>
                                <div><label className="label">Address</label><input name="address" defaultValue={selectedStaff?.address} className="input" /></div>

                                <div className="pt-2">
                                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-slate-700"><Clock size={16} /> Weekly Schedule</h4>
                                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                                            const dKey = day.toLowerCase()
                                            return (
                                                <div key={dKey}>
                                                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">{day}</label>
                                                    <input name={`weeklySchedule.${dKey}`} defaultValue={selectedStaff?.weeklySchedule?.[dKey] || ''} placeholder="09:00-17:00" className="w-full text-xs p-1.5 border rounded-md" />
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost">Cancel</button>
                                    <button type="submit" className="btn btn-primary">{selectedStaff ? 'Save Changes' : 'Add Staff'}</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </PageContainer>
    );
}

