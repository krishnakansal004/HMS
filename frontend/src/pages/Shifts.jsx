import { useProfileRender } from '../utils/profiler';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listShifts, createShift, updateShift, deleteShift, listWards, listStaff, listPatients } from '../services/api';
import { Plus, Calendar, Clock, Filter, CheckCircle, AlertCircle, X, ArrowRight, Edit2, Trash2, Eye, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageContainer from '../components/Admin/PageContainer';
import PageHeader from '../components/Admin/PageHeader';
import { TableSkeleton } from '../components/common/Skeleton';
import { toast } from 'react-toastify';
import syncQueue from '../utils/syncQueue';

const StatusBadge = ({ status }) => {
    const s = (status || '').toLowerCase();
    const config = {
        active:    { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', icon: CheckCircle },
        completed: { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-100',   icon: CheckCircle },
        scheduled: { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100',    icon: Clock },
        pending:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-100',   icon: AlertCircle }
    };
    const c = config[s] || config.pending;
    return (
        <span className={`px-2 py-1 rounded text-xs font-semibold flex items-center w-fit gap-1 border ${c.bg} ${c.text} ${c.border}`}>
            <c.icon size={12} /> {status}
        </span>
    );
};

function getShiftStatus(shift) {
    const start = shift.startTime ? new Date(shift.startTime) : null;
    const end   = shift.endTime   ? new Date(shift.endTime)   : null;
    if (!start || !end) return 'Pending';
    const now = Date.now();
    if (now >= start.getTime() && now <= end.getTime()) return 'Active';
    if (now > end.getTime()) return 'Completed';
    return 'Scheduled';
}

export default function Shifts() {
    useProfileRender('Shifts', true);
    const queryClient = useQueryClient();

    const [isModalOpen, setIsModalOpen]     = useState(false);
    const [editingShift, setEditingShift]   = useState(null);
    const [profileNurse, setProfileNurse]   = useState(null);
    const [filter, setFilter]               = useState('all');
    const [selectedStaff, setSelectedStaff] = useState('');
    const [staffNameInput, setStaffNameInput] = useState('');

    // ─── Queries ────────────────────────────────────────────────────────────
    const { data: shifts = [], isLoading: loadingShifts } = useQuery({
        queryKey: ['shifts'],
        queryFn: listShifts,
    });
    const { data: wards = [] } = useQuery({
        queryKey: ['wards'],
        queryFn: listWards,
    });
    const { data: staff = [] } = useQuery({
        queryKey: ['staff'],
        queryFn: listStaff,
    });
    const { data: patients = [] } = useQuery({
        queryKey: ['patients'],
        queryFn: listPatients,
    });

    // ─── Modal helpers ───────────────────────────────────────────────────────
    const handleOpenModal = (shift = null) => {
        setEditingShift(shift);
        setSelectedStaff(shift?.staff?._id || shift?.staff || '');
        setStaffNameInput(shift?.staffName || '');
        setIsModalOpen(true);
    };
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingShift(null);
        setSelectedStaff('');
        setStaffNameInput('');
    };

    // ─── Create / Update (Optimistic) ────────────────────────────────────────
    const handleSave = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        data.staff     = selectedStaff    || '';
        data.staffName = staffNameInput   || '';

        const previousShifts = queryClient.getQueryData(['shifts']) || [];

        if (editingShift) {
            // ─── Optimistic update ───────────────────────────────────────────
            const optimisticShifts = previousShifts.map(s =>
                s._id === editingShift._id ? { ...s, ...data, ward: wards.find(w => w._id === data.ward) || s.ward } : s
            );
            queryClient.setQueryData(['shifts'], optimisticShifts);
            handleCloseModal();
            toast.success('Shift updated (syncing in background)');

            syncQueue.enqueue({
                path: `/api/shifts/${editingShift._id}`,
                method: 'PUT',
                body: data,
                rollbackQueryKeys: [['shifts']],
                previousData: [previousShifts],
            }, queryClient, {
                onSuccess: () => queryClient.setQueryData(['shifts'], (old = []) =>
                    old.map(s => s._id === editingShift._id ? { ...s, _syncStatus: undefined } : s)
                ),
                onError: () => queryClient.setQueryData(['shifts'], previousShifts),
            });
        } else {
            // ─── Optimistic create ───────────────────────────────────────────
            const tempId = `temp-shift-${Date.now()}`;
            const staffObj = staff.find(s => s._id === selectedStaff);
            const wardObj  = wards.find(w => w._id === data.ward);
            const optimisticShift = {
                _id: tempId,
                ...data,
                staff: staffObj || selectedStaff,
                ward:  wardObj  || data.ward,
                createdAt: new Date().toISOString(),
                _syncStatus: 'syncing',
            };
            queryClient.setQueryData(['shifts'], (old = []) => [optimisticShift, ...old]);
            handleCloseModal();
            toast.success('Shift created (syncing in background)');

            syncQueue.enqueue({
                path: '/api/shifts',
                method: 'POST',
                body: data,
                tempId,
                queryKey: ['shifts'],
                rollbackQueryKeys: [['shifts']],
                previousData: [previousShifts],
            }, queryClient, {
                onSuccess: (serverShift) => {
                    queryClient.setQueryData(['shifts'], (old = []) =>
                        old.map(s => s._id === tempId ? { ...serverShift, _syncStatus: 'synced' } : s)
                    );
                    setTimeout(() => queryClient.setQueryData(['shifts'], (old = []) =>
                        old.map(s => s._id === (serverShift._id || tempId) ? { ...s, _syncStatus: undefined } : s)
                    ), 2000);
                },
                onError: (err) => {
                    queryClient.setQueryData(['shifts'], (old = []) =>
                        old.map(s => s._id === tempId ? { ...s, _syncStatus: 'failed', _syncError: err.message } : s)
                    );
                },
            });
        }
    };

    // ─── Delete (Optimistic) ─────────────────────────────────────────────────
    const handleDelete = (id) => {
        if (!confirm('Are you sure you want to delete this shift?')) return;
        const previousShifts = queryClient.getQueryData(['shifts']) || [];

        // Remove from cache immediately
        queryClient.setQueryData(['shifts'], (old = []) => old.filter(s => s._id !== id));
        toast.success('Shift deleted (syncing in background)');

        syncQueue.enqueue({
            path: `/api/shifts/${id}`,
            method: 'DELETE',
            rollbackQueryKeys: [['shifts']],
            previousData: [previousShifts],
        }, queryClient, {
            onSuccess: () => {},
            onError: () => {
                queryClient.setQueryData(['shifts'], previousShifts);
                toast.error('Delete failed. Shift restored.');
            },
        });
    };

    // ─── Filtered view ────────────────────────────────────────────────────────
    const filtered = shifts.filter(s => {
        if (filter === 'all') return true;
        return getShiftStatus(s).toLowerCase() === filter.toLowerCase();
    });

    return (
        <PageContainer>
            <PageHeader
                title="Nurse Shift Management"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Shifts' }]}
                actions={
                    <button onClick={() => handleOpenModal()} className="flex items-center gap-2 btn btn-primary">
                        <Plus size={18} /> Create Shift
                    </button>
                }
            />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
                {/* Filter bar */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                        <Filter size={14} />
                        <select value={filter} onChange={e => setFilter(e.target.value)} className="bg-transparent outline-none font-medium text-slate-700">
                            <option value="all">All Shifts</option>
                            <option value="active">Active Now</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                    <span className="text-xs text-slate-400 ml-auto">{filtered.length} shift(s)</span>
                </div>

                {/* Table */}
                <div className="overflow-auto">
                    {loadingShifts ? (
                        <div className="p-6"><TableSkeleton rows={5} cols={5} /></div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Nurse</th>
                                    <th className="px-6 py-4">Ward</th>
                                    <th className="px-6 py-4">Schedule</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-500">No shifts found.</td>
                                    </tr>
                                ) : filtered.map(shift => {
                                    const status = getShiftStatus(shift);
                                    let nurseObj = null;
                                    let nurseName = '—';
                                    if (shift.staff) {
                                        if (typeof shift.staff === 'object') {
                                            nurseObj  = shift.staff;
                                            nurseName = shift.staff.name || '—';
                                        } else {
                                            const f = staff.find(s => String(s._id) === String(shift.staff));
                                            nurseObj  = f;
                                            nurseName = f ? f.name : String(shift.staff);
                                        }
                                    } else if (shift.staffName) {
                                        nurseName = shift.staffName;
                                    }

                                    return (
                                        <motion.tr
                                            key={shift._id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="hover:bg-slate-50/80 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs cursor-pointer hover:bg-indigo-100 transition-colors"
                                                        onClick={() => setProfileNurse(nurseObj || { name: nurseName, _id: shift.staff })}
                                                    >
                                                        {(nurseName || 'N')[0]}
                                                    </div>
                                                    <div
                                                        className="font-medium text-slate-700 cursor-pointer hover:text-indigo-600"
                                                        onClick={() => setProfileNurse(nurseObj || { name: nurseName, _id: shift.staff })}
                                                    >
                                                        {nurseName}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{shift.ward?.name || '—'}</td>
                                            <td className="px-6 py-4 text-xs text-slate-600">
                                                <div className="flex items-center gap-1"><ArrowRight size={12} className="text-emerald-500" /> {shift.startTime ? new Date(shift.startTime).toLocaleString() : '—'}</div>
                                                <div className="flex items-center gap-1 mt-1"><ArrowRight size={12} className="text-red-400" /> {shift.endTime ? new Date(shift.endTime).toLocaleString() : '—'}</div>
                                            </td>
                                            <td className="px-6 py-4"><StatusBadge status={status} /></td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => handleOpenModal(shift)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors" title="Edit">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button onClick={() => handleDelete(shift._id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors" title="Delete">
                                                        <Trash2 size={16} />
                                                    </button>
                                                    <button onClick={() => setProfileNurse(nurseObj || { name: nurseName, _id: shift.staff })} className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors" title="View Profile">
                                                        <Eye size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Create / Edit Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
                            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                                <h2 className="text-xl font-bold text-slate-800">{editingShift ? 'Edit Shift' : 'Assign Operations Shift'}</h2>
                                <button onClick={handleCloseModal} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} className="text-slate-500" /></button>
                            </div>
                            <form onSubmit={handleSave} className="p-6 space-y-4">
                                <div>
                                    <label className="label">Nurse</label>
                                    <select name="staff" className="input" value={selectedStaff} onChange={e => {
                                        const val = e.target.value;
                                        setSelectedStaff(val);
                                        const found = staff.find(s => String(s._id) === String(val));
                                        setStaffNameInput(found ? found.name : '');
                                    }}>
                                        <option value="">Select Nurse</option>
                                        {staff.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="label">Staff Name (Manual Override)</label>
                                    <input name="staffName" className="input" placeholder="Enter name if not in list" value={staffNameInput} onChange={e => setStaffNameInput(e.target.value)} />
                                </div>

                                <div>
                                    <label className="label">Ward Assignment</label>
                                    <select name="ward" className="input" defaultValue={editingShift?.ward?._id || editingShift?.ward || ''} required>
                                        <option value="">Select Ward</option>
                                        {wards.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label">Start Time</label>
                                        <input
                                            type="datetime-local"
                                            name="startTime"
                                            className="input"
                                            defaultValue={editingShift?.startTime ? new Date(new Date(editingShift.startTime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="label">End Time</label>
                                        <input
                                            type="datetime-local"
                                            name="endTime"
                                            className="input"
                                            defaultValue={editingShift?.endTime ? new Date(new Date(editingShift.endTime).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="label">Handover Note</label>
                                    <textarea name="handoverNote" className="input" rows="3" defaultValue={editingShift?.handoverNote || ''} />
                                </div>

                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
                                    <button type="button" onClick={handleCloseModal} className="btn btn-ghost">Cancel</button>
                                    <button type="submit" className="btn btn-primary">{editingShift ? 'Update Shift' : 'Create Shift'}</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}

                {/* Nurse Profile Drawer */}
                {profileNurse && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center font-bold text-2xl">
                                        {(profileNurse.name || 'N')[0]}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold">{profileNurse.name}</h2>
                                        <p className="opacity-80">{profileNurse.role || 'Nursing Staff'}</p>
                                    </div>
                                </div>
                                <button onClick={() => setProfileNurse(null)} className="p-2 hover:bg-white/10 rounded-full"><X size={24} /></button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="text-slate-500 mb-1">Emp ID</div>
                                        <div className="font-bold text-slate-800">{profileNurse._id}</div>
                                    </div>
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="text-slate-500 mb-1">Department</div>
                                        <div className="font-bold text-slate-800">{profileNurse.department || 'Inpatient Care'}</div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 underline decoration-indigo-500 underline-offset-4">
                                        <Clock size={16} className="text-indigo-600" /> Current/Upcoming Shifts
                                    </h3>
                                    <div className="space-y-2">
                                        {shifts.filter(s => String(s.staff?._id || s.staff) === String(profileNurse._id)).slice(0, 5).map(s => (
                                            <div key={s._id} className="p-3 border border-slate-100 rounded-lg flex items-center justify-between hover:border-indigo-200 transition-colors">
                                                <div>
                                                    <div className="font-semibold text-slate-700 flex items-center gap-2">
                                                        <MapPin size={12} className="text-slate-400" /> {s.ward?.name || 'Ward'}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        {new Date(s.startTime).toLocaleString()} - {new Date(s.endTime).toLocaleString()}
                                                    </div>
                                                </div>
                                                <StatusBadge status={getShiftStatus(s)} />
                                            </div>
                                        ))}
                                        {shifts.filter(s => String(s.staff?._id || s.staff) === String(profileNurse._id)).length === 0 && (
                                            <div className="text-sm text-slate-400 italic">No assigned shifts.</div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 underline decoration-indigo-500 underline-offset-4">
                                        <MapPin size={16} className="text-indigo-600" /> Patients Under Care
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {(() => {
                                            const myWards = new Set(shifts.filter(s => String(s.staff?._id || s.staff) === String(profileNurse._id) && getShiftStatus(s) === 'Active').map(s => String(s.ward?._id || s.ward)));
                                            const myPatients = patients.filter(p => p.inpatient?.isAdmitted && myWards.has(String(p.inpatient.ward)));
                                            if (myPatients.length === 0) return <div className="col-span-full text-sm text-slate-400 italic">No active patient monitoring.</div>;
                                            return myPatients.map(p => (
                                                <div key={p._id} className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                                                    <div className="font-bold text-indigo-900 truncate">{p.firstName} {p.lastName}</div>
                                                    <div className="text-[10px] text-indigo-600 font-medium">Bed: {p.inpatient.bed?.bedNumber || 'Assigned'}</div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-slate-100 text-center">
                                <button onClick={() => setProfileNurse(null)} className="btn btn-ghost w-full">Close Profile</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </PageContainer>
    );
}
