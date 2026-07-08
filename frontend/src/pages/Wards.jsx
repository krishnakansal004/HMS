import { useProfileRender } from '../utils/profiler';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listWards, createWard, listBeds, createBed, allocateBed, listDoctors, listStaff, getWardHistory } from '../services/api';
import { toast } from 'react-toastify';
import { Plus, BedDouble, History, User, X, Download, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageContainer from '../components/Admin/PageContainer';
import PageHeader from '../components/Admin/PageHeader';
import { CardSkeleton, TableSkeleton } from '../components/common/Skeleton';
import syncQueue from '../utils/syncQueue';

export default function Wards() {
    useProfileRender('Wards', true);
    const queryClient = useQueryClient();
    const [isWardModalOpen, setIsWardModalOpen] = useState(false);
    const [isBedModalOpen, setIsBedModalOpen] = useState(false);
    const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
    const [selectedWard, setSelectedWard] = useState(null);

    // History modal state
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedHistoryWard, setSelectedHistoryWard] = useState(null);

    // Fetch Wards
    const { data: wards = [], isLoading: loadingWards } = useQuery({
        queryKey: ['wards'],
        queryFn: listWards,
    });

    // Fetch Ward History
    const { data: historyRecords = [], isLoading: loadingHistory } = useQuery({
        queryKey: ['wardHistory', selectedHistoryWard?._id],
        queryFn: () => getWardHistory(selectedHistoryWard._id),
        enabled: !!selectedHistoryWard?._id,
    });

    // Modal handlers
    const openWardModal = () => setIsWardModalOpen(true);
    const closeWardModal = () => setIsWardModalOpen(false);

    const openBedModal = (ward) => { setSelectedWard(ward); setIsBedModalOpen(true); };
    const closeBedModal = () => { setSelectedWard(null); setIsBedModalOpen(false); };

    const openAllocateModal = (ward) => {
        if (ward && ward._id && String(ward._id).startsWith('temp-')) {
            toast.error('Please wait for the ward to sync with the server before allocating beds.');
            return;
        }
        setSelectedWard(ward);
        setIsAllocateModalOpen(true);
    };
    const closeAllocateModal = () => { setSelectedWard(null); setIsAllocateModalOpen(false); };

    const openHistoryModal = (ward) => {
        setSelectedHistoryWard(ward);
        setIsHistoryModalOpen(true);
    };
    const closeHistoryModal = () => {
        setSelectedHistoryWard(null);
        setIsHistoryModalOpen(false);
    };

    // Create Ward Handler (Optimistic UI + Background Sync)
    const handleSaveWard = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        // Prepare payload
        const capacity = Number(data.capacity);
        const pricePerDay = Number(data.pricePerDay || 0);
        const newWard = {
            name: data.name,
            type: data.type,
            floor: data.floor,
            capacity,
            pricePerDay,
            notes: data.notes || '',
            isActive: true
        };

        // Cache snapshot for rollback
        const previousWards = queryClient.getQueryData(['wards']);

        // Generate optimistic ward object
        const tempId = `temp-${Date.now()}`;
        const optimisticWard = {
            _id: tempId,
            ...newWard,
            totalBeds: capacity,
            availableBeds: capacity,
            createdAt: new Date().toISOString()
        };

        // Update local query cache immediately (< 50ms)
        queryClient.setQueryData(['wards'], (old = []) => [...old, optimisticWard]);
        
        // Pre-fill empty beds in local cache for this temporary ward
        const tempBeds = Array.from({ length: capacity }).map((_, i) => ({
            _id: `temp-bed-${tempId}-${i}`,
            bedNumber: `${data.name.replace(/\s+/g, '').toUpperCase().slice(0, 3)}-${String(i + 1).padStart(3, '0')}`,
            ward: tempId,
            isOccupied: false,
            allocations: []
        }));
        queryClient.setQueryData(['beds', tempId], tempBeds);

        closeWardModal();
        toast.success('Ward added (syncing in background)');

        // Enqueue to background sync
        syncQueue.enqueue({
            path: '/api/wards',
            method: 'POST',
            body: {
                name: data.name,
                type: data.type,
                floor: data.floor,
                capacity,
                pricePerDay,
                notes: data.notes || '',
                isActive: true
            },
            tempId,
            queryKey: ['wards'],
            rollbackQueryKeys: [['wards'], ['beds', tempId]],
            previousData: [previousWards, []],
        }, queryClient, {
            onSuccess: (serverWard) => {
                // Replace temp ward with real ward
                queryClient.setQueryData(['wards'], (old = []) =>
                    old.map(w => w._id === tempId ? { ...serverWard, _syncStatus: 'synced' } : w)
                );
                // Move temp beds to real ward key
                const tempBedData = queryClient.getQueryData(['beds', tempId]);
                if (tempBedData && serverWard._id) {
                    queryClient.setQueryData(['beds', serverWard._id], tempBedData);
                    queryClient.removeQueries({ queryKey: ['beds', tempId] });
                }
                setTimeout(() => queryClient.setQueryData(['wards'], (old = []) =>
                    old.map(w => w._id === (serverWard._id || tempId) ? { ...w, _syncStatus: undefined } : w)
                ), 2000);
            },
            onError: (err) => {
                queryClient.setQueryData(['wards'], (old = []) =>
                    old.map(w => w._id === tempId ? { ...w, _syncStatus: 'failed', _syncError: err.message } : w)
                );
            },
        });
    };

    // Add Bed Handler (Optimistic UI + Background Sync)
    const handleSaveBed = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        const wardId = selectedWard._id;

        const previousBeds = queryClient.getQueryData(['beds', wardId]) || [];
        const previousWards = queryClient.getQueryData(['wards']) || [];

        // Generate optimistic bed
        const optimisticBed = {
            _id: `temp-bed-${Date.now()}`,
            bedNumber: data.bedNumber,
            ward: wardId,
            isOccupied: false,
            allocations: []
        };

        // Update cache immediately
        queryClient.setQueryData(['beds', wardId], (old = []) => [...old, optimisticBed]);
        queryClient.setQueryData(['wards'], (old = []) => 
            old.map(w => w._id === wardId 
                ? { ...w, totalBeds: (w.totalBeds || 0) + 1, availableBeds: (w.availableBeds || 0) + 1 } 
                : w
            )
        );

        closeBedModal();
        toast.success('Bed added (syncing in background)');

        // Enqueue sync
        const bedTempId = `temp-bed-${Date.now()}`;
        syncQueue.enqueue({
            path: `/api/wards/${wardId}/beds`,
            method: 'POST',
            body: { bedNumber: data.bedNumber },
            rollbackQueryKeys: [['beds', wardId], ['wards']],
            previousData: [previousBeds, previousWards],
        }, queryClient, {
            onSuccess: () => {
                // beds will be consistent after next natural refetch
            },
            onError: () => {
                queryClient.setQueryData(['beds', wardId], previousBeds);
                queryClient.setQueryData(['wards'], previousWards);
                toast.error('Failed to add bed. Reverted.');
            },
        });
    };

    const exportHistoryCSV = () => {
        if (!historyRecords || historyRecords.length === 0) return toast.info('No history to export');
        const headers = ['Bed', 'Patient Name', 'Patient Email', 'Phone', 'Admit From', 'Admit Until', 'Authority Role', 'Authority Name', 'Price', 'InvoiceId', 'Allocated At', 'Released At'];
        const rows = historyRecords.map(h => [
            h.bedNumber || '',
            (h.patient && (h.patient.name || `${h.patient.firstName || ''} ${h.patient.lastName || ''}`)) || '',
            h.patient?.email || '', h.patient?.phone || '',
            h.admitFrom ? new Date(h.admitFrom).toISOString() : '',
            h.admitUntil ? new Date(h.admitUntil).toISOString() : '',
            h.authority?.role || '', h.authority?.name || '',
            h.priceCharged != null ? h.priceCharged : '',
            h.invoice || '',
            h.allocatedAt ? new Date(h.allocatedAt).toISOString() : '',
            h.releasedAt ? new Date(h.releasedAt).toISOString() : ''
        ]);
        const csv = [headers.join(',')].concat(rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(','))).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = (selectedHistoryWard?.name || 'ward-history').replace(/\s+/g, '_');
        a.download = `${safeName}-allocation-history.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <PageContainer>
            <PageHeader
                title="Ward & Bed Management"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Wards' }]}
                actions={
                    <button onClick={openWardModal} className="flex items-center gap-2 btn btn-primary">
                        <Plus size={18} /> Add Ward
                    </button>
                }
            />

            {loadingWards ? (
                <div className="space-y-6">
                    <CardSkeleton count={2} cols={1} />
                </div>
            ) : wards.length === 0 ? (
                <div className="bg-white dark:bg-gray-950 rounded-2xl p-12 text-center border border-slate-100 dark:border-slate-800">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <BedDouble size={32} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">No wards found</h3>
                </div>
            ) : (
                <div className="space-y-6">
                    {wards.map(ward => (
                        <WardCard 
                            key={ward._id}
                            ward={ward}
                            openBedModal={openBedModal}
                            openAllocateModal={openAllocateModal}
                            openHistoryModal={openHistoryModal}
                        />
                    ))}
                </div>
            )}

            {/* Add Ward Modal */}
            <AnimatePresence>
                {isWardModalOpen && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md">
                            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-805">
                                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Add New Ward</h2>
                                <button onClick={closeWardModal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={20} className="text-slate-500" /></button>
                            </div>
                            <form onSubmit={handleSaveWard} className="p-6 space-y-4">
                                <input name="name" placeholder="Ward Name (e.g. ICU)" className="input" required />
                                <div className="grid grid-cols-2 gap-4">
                                    <select name="type" className="input">
                                        <option value="general">General</option>
                                        <option value="icu">ICU</option>
                                        <option value="private">Private</option>
                                        <option value="semi-private">Semi-Private</option>
                                        <option value="maternity">Maternity</option>
                                        <option value="pediatric">Pediatric</option>
                                    </select>
                                    <input name="floor" placeholder="Floor No." className="input" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="number" name="capacity" placeholder="Total Capacity" className="input" required />
                                    <input type="number" name="pricePerDay" placeholder="Price/Day (₹)" className="input" />
                                </div>
                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-805 mt-2">
                                    <button type="button" onClick={closeWardModal} className="btn btn-ghost">Cancel</button>
                                    <button type="submit" className="btn btn-primary">Create Ward</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Add Bed Modal */}
            <AnimatePresence>
                {isBedModalOpen && selectedWard && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm">
                            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-805">
                                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Add Bed to {selectedWard.name}</h2>
                                <button onClick={closeBedModal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={20} className="text-slate-500" /></button>
                            </div>
                            <form onSubmit={handleSaveBed} className="p-6 space-y-4">
                                <input name="bedNumber" placeholder="Bed Number (e.g. ICU-005)" className="input" required />
                                <div className="flex justify-end gap-3 pt-4">
                                    <button type="button" onClick={closeBedModal} className="btn btn-ghost">Cancel</button>
                                    <button type="submit" className="btn btn-primary">Add Bed</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Allocate Bed Modal */}
            <AnimatePresence>
                {isAllocateModalOpen && selectedWard && (
                    <AllocateBedModal 
                        ward={selectedWard} 
                        onClose={closeAllocateModal} 
                    />
                )}
            </AnimatePresence>

            {/* Allocation History Modal */}
            <AnimatePresence>
                {isHistoryModalOpen && selectedHistoryWard && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-805">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Allocation History</h2>
                                    <div className="text-sm text-slate-500">{selectedHistoryWard.name}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={exportHistoryCSV} className="flex items-center gap-2 px-3 py-1.5 text-sm border dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                                        <Download size={14} /> Export CSV
                                    </button>
                                    <button onClick={closeHistoryModal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={20} className="text-slate-500" /></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto p-0">
                                {loadingHistory ? (
                                    <div className="p-6"><TableSkeleton rows={3} cols={5} /></div>
                                ) : historyRecords.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500">No allocation history found for this ward.</div>
                                ) : (
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead className="bg-slate-50 dark:bg-gray-800 sticky top-0 border-b border-slate-100 dark:border-slate-700">
                                            <tr>
                                                <th className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Bed</th>
                                                <th className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Patient</th>
                                                <th className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Duration</th>
                                                <th className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Issued By</th>
                                                <th className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300">Price</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                            {historyRecords.map((h, i) => (
                                                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-gray-850">
                                                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">{h.bedNumber}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-medium text-slate-800 dark:text-slate-200">{h.patient?.name || 'Unknown'}</div>
                                                        <div className="text-xs text-slate-500">{h.patient?.email}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
                                                        <div>From: {h.admitFrom ? new Date(h.admitFrom).toLocaleDateString() : '-'}</div>
                                                        <div>To: {h.admitUntil ? new Date(h.admitUntil).toLocaleDateString() : 'Ongoing'}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
                                                        <span className="capitalize font-medium">{h.authority?.role}</span>
                                                        {h.authority?.name && <span className="text-slate-500"> ({h.authority.name})</span>}
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">₹{h.priceCharged || 0}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </PageContainer>
    );
}

function WardCard({ ward, openBedModal, openAllocateModal, openHistoryModal }) {
    const { data: wardBeds = [], isLoading: loadingBeds } = useQuery({
        queryKey: ['beds', ward._id],
        queryFn: () => listBeds(ward._id),
    });

    const total = typeof ward.totalBeds === 'number' ? ward.totalBeds : wardBeds.length;
    const available = typeof ward.availableBeds === 'number' ? ward.availableBeds : wardBeds.filter(b => !b.isOccupied).length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden"
        >
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 dark:bg-gray-900/50">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        {ward.name} 
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">
                            {ward.type}
                        </span>
                    </h2>
                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex gap-4">
                        <span>Floor: <strong>{ward.floor || 'G'}</strong></span>
                        <span>Capacity: <strong>{ward.capacity || 0}</strong></span>
                        <span className={available > 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-red-500 font-medium'}>
                            Available: {available}/{total}
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => openBedModal(ward)} className="btn btn-sm btn-outline gap-2 bg-white dark:bg-gray-900 dark:border-slate-700">
                        <Plus size={14} /> Add Bed
                    </button>
                    <button onClick={() => openAllocateModal(ward)} className="btn btn-sm btn-outline gap-2 bg-white dark:bg-gray-900 dark:border-slate-700">
                        <User size={14} /> Allocate
                    </button>
                    <button onClick={() => openHistoryModal(ward)} className="btn btn-sm btn-outline gap-2 bg-white dark:bg-gray-900 dark:border-slate-700">
                        <History size={14} /> History
                    </button>
                </div>
            </div>

            <div className="p-5">
                {loadingBeds ? (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="animate-pulse bg-gray-100 dark:bg-slate-850 h-16 rounded-xl border border-dashed dark:border-slate-800" />
                        ))}
                    </div>
                ) : wardBeds.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm italic">No beds added yet. Use 'Add Bed'.</div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                        {wardBeds.map(bed => (
                            <div 
                                key={bed._id} 
                                className={`p-3 rounded-xl text-center border transition-all ${
                                    bed.isOccupied 
                                        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-300' 
                                        : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300 hover:shadow-sm'
                                }`}
                            >
                                <BedDouble size={20} className="mx-auto mb-2 opacity-70" />
                                <div className="font-bold text-sm">{bed.bedNumber}</div>
                                <div className="text-[10px] font-medium uppercase mt-1 opacity-75">{bed.isOccupied ? 'Occupied' : 'Free'}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

function AllocateBedModal({ ward, onClose }) {
    const queryClient = useQueryClient();
    const [submitting, setSubmitting] = useState(false);
    const [authorityRole, setAuthorityRole] = useState('nurse');
    const [authorityName, setAuthorityName] = useState('');
    const [authorityDoctorId, setAuthorityDoctorId] = useState('');
    const [admitFrom, setAdmitFrom] = useState(new Date().toISOString().slice(0, 16));
    const [admitUntil, setAdmitUntil] = useState('');

    const DAILY_COST = ward.pricePerDay || 250;
    const [computedPrice, setComputedPrice] = useState(DAILY_COST);

    // Queries for select lists
    const { data: beds = [] } = useQuery({
        queryKey: ['beds', ward._id],
        queryFn: () => listBeds(ward._id)
    });

    const { data: doctors = [], isLoading: loadingDoctors } = useQuery({
        queryKey: ['doctors'],
        queryFn: listDoctors,
        enabled: authorityRole === 'doctor'
    });

    const { data: nurses = [], isLoading: loadingNurses } = useQuery({
        queryKey: ['staff'],
        queryFn: listStaff,
        enabled: authorityRole === 'nurse'
    });

    const availableBeds = beds.filter(b => !b.isOccupied);
    const [selectedBed, setSelectedBed] = useState(availableBeds[0]?._id || '');

    useEffect(() => {
        if (!selectedBed && availableBeds.length > 0) {
            setSelectedBed(availableBeds[0]._id);
        }
    }, [availableBeds, selectedBed]);

    useEffect(() => {
        if (!admitFrom && !admitUntil) { setComputedPrice(DAILY_COST); return; }
        try {
            const from = admitFrom ? new Date(admitFrom) : new Date();
            const until = admitUntil ? new Date(admitUntil) : null;
            if (!until) { setComputedPrice(DAILY_COST); return; }
            const ms = until - from;
            const days = Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
            setComputedPrice(days * DAILY_COST);
        } catch (e) { setComputedPrice(DAILY_COST); }
    }, [admitFrom, admitUntil, DAILY_COST]);

    async function submit(e) {
        e.preventDefault();
        if (!selectedBed) return;
        setSubmitting(true);

        const form = new FormData(e.target);
        const authority = authorityRole === 'doctor' 
            ? { role: authorityRole, doctorId: authorityDoctorId, name: authorityName } 
            : { role: authorityRole, name: authorityName };

        const payload = {
            mode: 'new', 
            firstName: form.get('firstName'), 
            lastName: form.get('lastName'), 
            email: form.get('email'),
            phone: form.get('phone'), 
            bedId: selectedBed, 
            authority, 
            admitFrom, 
            admitUntil
        };

        const wardId = ward._id;

        // Take snapshot
        const previousBeds = queryClient.getQueryData(['beds', wardId]) || [];
        const previousWards = queryClient.getQueryData(['wards']) || [];

        // Optimistically update beds & wards cache
        const optimisticBeds = previousBeds.map(b => b._id === selectedBed 
            ? { 
                ...b, 
                isOccupied: true, 
                patient: { 
                    firstName: payload.firstName, 
                    lastName: payload.lastName, 
                    email: payload.email, 
                    phone: payload.phone 
                } 
            } 
            : b
        );
        queryClient.setQueryData(['beds', wardId], optimisticBeds);

        const optimisticWards = previousWards.map(w => w._id === wardId 
            ? { ...w, availableBeds: Math.max(0, (w.availableBeds || 0) - 1) } 
            : w
        );
        queryClient.setQueryData(['wards'], optimisticWards);

        onClose();
        toast.success('Bed allocation processing (syncing in background)');

        // Sync background
        syncQueue.enqueue({
            path: `/api/wards/${wardId}/allocate`,
            method: 'POST',
            body: payload,
            rollbackQueryKeys: [['beds', wardId], ['wards']],
            previousData: [previousBeds, previousWards],
        }, queryClient, {
            onSuccess: () => {
                // Optionally invalidate history so next open shows the latest record
                queryClient.invalidateQueries({ queryKey: ['wardHistory', wardId] });
            },
            onError: () => {
                queryClient.setQueryData(['beds', wardId], previousBeds);
                queryClient.setQueryData(['wards'], previousWards);
                toast.error('Bed allocation failed. Reverted.');
            },
        });

        setSubmitting(false);
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-805">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Allocate Bed</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={20} className="text-slate-500" /></button>
                </div>
                <form onSubmit={submit} className="p-6 space-y-4">
                    <div>
                        <label className="label">Select Bed</label>
                        <select value={selectedBed} onChange={e => setSelectedBed(e.target.value)} className="input" required>
                            <option value="">Choose Bed</option>
                            {availableBeds.map(b => <option key={b._id} value={b._id}>{b.bedNumber}</option>)}
                        </select>
                        {availableBeds.length === 0 && <p className="text-xs text-red-500 mt-1">No beds available.</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <input name="firstName" placeholder="Patient First Name" className="input" required />
                        <input name="lastName" placeholder="Last Name" className="input" />
                        <input name="email" placeholder="Email" type="email" className="input col-span-2" required />
                        <input name="phone" placeholder="Phone (optional)" className="input col-span-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="label">Admit From</label>
                            <input name="admitFrom" type="datetime-local" value={admitFrom} onChange={e => setAdmitFrom(e.target.value)} className="input" required />
                        </div>
                        <div>
                            <label className="label">Admit Until</label>
                            <input name="admitUntil" type="datetime-local" value={admitUntil} onChange={e => setAdmitUntil(e.target.value)} className="input" />
                            <p className="text-[10px] text-slate-400 mt-1">Leave empty if indefinite</p>
                        </div>
                    </div>

                    <div>
                        <label className="label">Assigning Authority</label>
                        <div className="grid grid-cols-3 gap-2">
                            <select value={authorityRole} onChange={e => setAuthorityRole(e.target.value)} className="input col-span-1">
                                <option value="nurse">Nurse</option>
                                <option value="doctor">Doctor</option>
                                <option value="admin">Admin</option>
                            </select>
                            {authorityRole === 'doctor' ? (
                                <select value={authorityDoctorId} onChange={e => { setAuthorityDoctorId(e.target.value); const d = doctors.find(x => x._id === e.target.value); setAuthorityName(d ? d.name : ''); }} className="input col-span-2" required>
                                    <option value="">Select Doctor</option>
                                    {loadingDoctors ? <option disabled>Loading...</option> : doctors.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                                </select>
                            ) : authorityRole === 'nurse' ? (
                                <select value={authorityName} onChange={e => setAuthorityName(e.target.value)} className="input col-span-2" required>
                                    <option value="">Select Nurse</option>
                                    {loadingNurses ? <option disabled>Loading...</option> : nurses.map(n => <option key={n._id} value={n.name}>{n.name}</option>)}
                                </select>
                            ) : (
                                <input value={authorityName} onChange={e => setAuthorityName(e.target.value)} placeholder="Name" className="input col-span-2" required />
                            )}
                        </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-sm border border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between mb-1"><span className="dark:text-slate-300">Daily Cost of {ward.name}:</span> <span className="font-semibold dark:text-slate-150">₹{DAILY_COST}</span></div>
                        <div className="flex justify-between text-blue-600 dark:text-blue-400"><span>Estimated Charge:</span> <span className="font-bold">₹{computedPrice}</span></div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
                        <button type="submit" disabled={submitting || availableBeds.length === 0} className="btn btn-primary">{submitting ? 'Allocating...' : 'Allocate Bed'}</button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
