import { useProfileRender } from '../utils/profiler';
import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Calendar, Plus, Clock, User, HeartPulse, FileText, CheckCircle, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardSkeleton, TableSkeleton } from '../components/common/Skeleton';
import syncQueue from '../utils/syncQueue';

export default function OTManagement() {
    useProfileRender('OTManagement', true);
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState(user?.role === 'patient' ? 'my-surgeries' : 'schedule');

    const [showBookModal, setShowBookModal] = useState(false);
    const [selectedSurgery, setSelectedSurgery] = useState(null);
    const [showNotesModal, setShowNotesModal] = useState(false);

    const [newBooking, setNewBooking] = useState({ patientId: '', surgeonId: '', anesthetistId: '', scheduledTime: '', durationMinutes: '', procedure: '', otRoom: 'OT Room 1', price: '' });
    const [notesDraft, setNotesDraft] = useState({ preoperativeDiagnosis: '', postoperativeDiagnosis: '', procedurePerformed: '', surgeryNotes: '', anesthetistNotes: '' });

    // Queries
    const { data: schedulesData = [], isLoading: loadingSchedules } = useQuery({
        queryKey: ['otSchedules'],
        queryFn: async () => {
            const res = await fetch('/api/ot/schedules', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load OT schedules');
            return res.json();
        }
    });

    const { data: doctorsData = [], isLoading: loadingDoctors } = useQuery({
        queryKey: ['doctors'],
        queryFn: async () => {
            const res = await fetch('/api/doctors', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load doctors');
            return res.json();
        },
        enabled: user?.role !== 'patient',
    });

    const { data: patientsData = [], isLoading: loadingPatients } = useQuery({
        queryKey: ['patients'],
        queryFn: async () => {
            const res = await fetch('/api/patients', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load patients');
            return res.json();
        },
        enabled: user?.role !== 'patient',
    });

    const schedules = useMemo(() => Array.isArray(schedulesData) ? schedulesData : [], [schedulesData]);
    const doctors = useMemo(() => Array.isArray(doctorsData) ? doctorsData : [], [doctorsData]);
    const patients = useMemo(() => Array.isArray(patientsData) ? patientsData : [], [patientsData]);

    const handleCreateBooking = (e) => {
        e.preventDefault();
        const patient = patients.find(p => p._id === newBooking.patientId);
        const surgeon = doctors.find(d => d._id === newBooking.surgeonId);
        const anesthetist = doctors.find(d => d._id === newBooking.anesthetistId);
        const previousSchedules = queryClient.getQueryData(['otSchedules']) || [];
        const tempId = `temp-ot-${Date.now()}`;
        const optimisticBooking = {
            _id: tempId,
            patientId: newBooking.patientId,
            patientName: patient ? `${patient.firstName} ${patient.lastName || ''}`.trim() : 'Unknown Patient',
            surgeonId: newBooking.surgeonId,
            surgeonName: surgeon ? surgeon.name : 'Unknown Surgeon',
            anesthetistId: newBooking.anesthetistId,
            anesthetistName: anesthetist ? anesthetist.name : 'Unknown Anesthetist',
            scheduledTime: newBooking.scheduledTime,
            durationMinutes: Number(newBooking.durationMinutes),
            procedure: newBooking.procedure,
            otRoom: newBooking.otRoom,
            price: Number(newBooking.price),
            status: 'scheduled',
            notes: null,
            _syncStatus: 'syncing',
        };
        queryClient.setQueryData(['otSchedules'], (old = []) => [optimisticBooking, ...old]);
        setShowBookModal(false);
        setNewBooking({ patientId: '', surgeonId: '', anesthetistId: '', scheduledTime: '', durationMinutes: '', procedure: '', otRoom: 'OT Room 1', price: '' });
        toast.success('Surgery scheduled successfully (syncing)');
        syncQueue.enqueue({
            path: '/api/ot/schedules',
            method: 'POST',
            body: newBooking,
            tempId,
            queryKey: ['otSchedules'],
            rollbackQueryKeys: [['otSchedules']],
            previousData: [previousSchedules],
        }, queryClient, {
            onSuccess: (data) => {
                queryClient.setQueryData(['otSchedules'], (old = []) =>
                    old.map(s => s._id === tempId ? { ...data, _syncStatus: 'synced' } : s)
                );
                setTimeout(() => queryClient.setQueryData(['otSchedules'], (old = []) =>
                    old.map(s => s._id === (data._id || tempId) ? { ...s, _syncStatus: undefined } : s)
                ), 2000);
            },
            onError: (err) => {
                queryClient.setQueryData(['otSchedules'], (old = []) =>
                    old.map(s => s._id === tempId ? { ...s, _syncStatus: 'failed', _syncError: err.message } : s)
                );
            },
        });
    };

    const handleOpenNotes = (surgery) => {
        setSelectedSurgery(surgery);
        setNotesDraft(surgery.notes || { preoperativeDiagnosis: '', postoperativeDiagnosis: '', procedurePerformed: '', surgeryNotes: '', anesthetistNotes: '' });
        setShowNotesModal(true);
    };

    const handleSaveNotes = (e) => {
        e.preventDefault();
        const previousSchedules = queryClient.getQueryData(['otSchedules']) || [];
        queryClient.setQueryData(['otSchedules'], (old = []) =>
            old.map(s => s._id === selectedSurgery._id ? { ...s, notes: notesDraft, _syncStatus: 'syncing' } : s)
        );
        setShowNotesModal(false);
        setSelectedSurgery(null);
        toast.success('Clinical surgery notes updated (syncing)');
        syncQueue.enqueue({
            path: `/api/ot/schedules/${selectedSurgery._id}/notes`,
            method: 'POST',
            body: notesDraft,
            rollbackQueryKeys: [['otSchedules']],
            previousData: [previousSchedules],
        }, queryClient, {
            onSuccess: () => queryClient.setQueryData(['otSchedules'], (old = []) =>
                old.map(s => s._id === selectedSurgery._id ? { ...s, _syncStatus: undefined } : s)
            ),
            onError: () => { queryClient.setQueryData(['otSchedules'], previousSchedules); },
        });
    };

    const handleCompleteSurgery = (surgeryId) => {
        const previousSchedules = queryClient.getQueryData(['otSchedules']) || [];
        queryClient.setQueryData(['otSchedules'], (old = []) =>
            old.map(s => s._id === surgeryId ? { ...s, status: 'completed', _syncStatus: 'syncing' } : s)
        );
        toast.success('Marking surgery completed & billing patient (syncing)');
        syncQueue.enqueue({
            path: `/api/ot/schedules/${surgeryId}/complete`,
            method: 'POST',
            body: {},
            rollbackQueryKeys: [['otSchedules']],
            previousData: [previousSchedules],
        }, queryClient, {
            onSuccess: () => queryClient.setQueryData(['otSchedules'], (old = []) =>
                old.map(s => s._id === surgeryId ? { ...s, _syncStatus: undefined } : s)
            ),
            onError: () => { queryClient.setQueryData(['otSchedules'], previousSchedules); },
        });
    };

    const filteredSurgeries = useMemo(() => {
        return schedules.filter(s =>
            s.patientName?.toLowerCase().includes(search.toLowerCase()) ||
            s.procedure?.toLowerCase().includes(search.toLowerCase()) ||
            s.surgeonName?.toLowerCase().includes(search.toLowerCase())
        );
    }, [schedules, search]);

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-3">
                        <HeartPulse className="text-indigo-650" size={32} />
                        Operation Theatre (OT) Board
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">Schedule surgical operations, allocate surgeons, anesthetists, and log preoperative/postoperative notes.</p>
                </div>
                {user?.role !== 'patient' && (
                    <button
                        onClick={() => setShowBookModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg hover:scale-[1.02] flex items-center gap-2 cursor-pointer"
                    >
                        <Plus size={18} />
                        Schedule Operation
                    </button>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit">
                {user?.role !== 'patient' && (
                    <button
                        onClick={() => setActiveTab('schedule')}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${activeTab === 'schedule' ? 'bg-white dark:bg-gray-800 text-slate-800 dark:text-white shadow-sm' : 'text-slate-650 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                    >
                        Active OT Schedule
                    </button>
                )}
                {user?.role === 'patient' && (
                    <button
                        onClick={() => setActiveTab('my-surgeries')}
                        className="bg-white dark:bg-gray-800 text-slate-800 dark:text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-sm"
                    >
                        My Surgery Records
                    </button>
                )}
            </div>

            {/* Search Filter */}
            {activeTab === 'schedule' && (
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search surgeries, patient or surgeon..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-10 pr-4 py-2.5 w-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 dark:text-slate-300 shadow-sm"
                    />
                </div>
            )}

            {/* Schedule List Content */}
            {activeTab === 'schedule' && (
                <div>
                    {loadingSchedules ? (
                        <CardSkeleton count={3} cols={3} />
                    ) : filteredSurgeries.length === 0 ? (
                        <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border dark:border-slate-800 text-center text-slate-500">
                            No surgeries scheduled for the selected period.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredSurgeries.map(s => (
                                <div key={s._id} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-100 dark:hover:border-indigo-900 shadow-sm space-y-4 transition-all">
                                    <div className="flex justify-between items-start">
                                        <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-2.5 py-0.5 rounded-md">{s.otRoom}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${s.status === 'completed' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' : s.status === 'ongoing' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400'}`}>
                                            {s.status}
                                        </span>
                                    </div>

                                    <div className="space-y-1">
                                        <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">{s.procedure}</h3>
                                        <p className="text-slate-655 dark:text-slate-300 font-semibold text-sm flex items-center gap-1">
                                            <User size={14} className="text-slate-400" />
                                            Patient: {s.patientName}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Surgeon: Dr. {s.surgeonName}</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Anesthetist: Dr. {s.anesthetistName}</p>
                                    </div>

                                    <div className="border-t dark:border-slate-800 pt-3 flex justify-between items-center text-xs font-semibold text-slate-500">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={14} />
                                            {new Date(s.scheduledTime).toLocaleDateString()}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={14} />
                                            {new Date(s.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({s.durationMinutes}m)
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-2 border-t dark:border-slate-800">
                                        {s.status !== 'completed' && (
                                            <>
                                                <button
                                                    onClick={() => handleOpenNotes(s)}
                                                    className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/35 text-indigo-700 dark:text-indigo-300 text-xs font-bold py-2 px-3 rounded-lg w-full flex items-center justify-center gap-1 cursor-pointer transition-all"
                                                >
                                                    <FileText size={12} /> Notes
                                                </button>
                                                <button
                                                    onClick={() => handleCompleteSurgery(s._id)}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3 rounded-lg w-full flex items-center justify-center gap-1 cursor-pointer transition-all"
                                                >
                                                    <CheckCircle size={12} /> Complete
                                                </button>
                                            </>
                                        )}
                                        {s.status === 'completed' && (
                                            <div className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs text-center font-bold py-2 px-3 rounded-lg w-full">
                                                Surgery Done & Billed
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Patient Surgery Records View */}
            {activeTab === 'my-surgeries' && (
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border dark:border-slate-800 shadow-sm space-y-4">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">My Surgical Records</h2>
                    <div className="space-y-4">
                        {schedules.filter(s => s.status === 'completed').length === 0 ? (
                            <p className="text-slate-500 dark:text-slate-400 text-center py-6">No completed surgeries recorded for your profile.</p>
                        ) : (
                            schedules.filter(s => s.status === 'completed').map(s => (
                                <div key={s._id} className="p-5 border dark:border-slate-805 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-850/50 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-lg">{s.procedure}</h4>
                                            <p className="text-xs text-slate-400 dark:text-slate-500">Date: {new Date(s.scheduledTime).toLocaleDateString()} | Surgeon: Dr. {s.surgeonName}</p>
                                        </div>
                                        <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 text-xs font-bold px-3 py-1 rounded-full uppercase">Completed</span>
                                    </div>
                                    {s.notes && (
                                        <div className="bg-slate-100/50 dark:bg-slate-800/50 p-3 rounded-lg text-xs space-y-2 text-slate-600 dark:text-slate-400">
                                            <p><strong>Procedure Performed:</strong> {s.notes.procedurePerformed || 'Details not summarized'}</p>
                                            <p><strong>Post-op Diagnosis:</strong> {s.notes.postoperativeDiagnosis || 'Summary pending'}</p>
                                            <p><strong>Surgeon Findings:</strong> {s.notes.surgeryNotes || 'Notes logged'}</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Book OT Modal */}
            <AnimatePresence>
                {showBookModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border dark:border-slate-800 max-w-md w-full shadow-2xl space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Schedule OT Surgery Slot</h3>
                                <button onClick={() => setShowBookModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={20} className="text-slate-500" /></button>
                            </div>
                            <form onSubmit={handleCreateBooking} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Patient</label>
                                        <select
                                            required
                                            value={newBooking.patientId}
                                            onChange={e => setNewBooking({ ...newBooking, patientId: e.target.value })}
                                            className="input"
                                        >
                                            <option value="">-- Select Patient --</option>
                                            {patients.map(p => (
                                                <option key={p._id} value={p._id}>{p.firstName} {p.lastName} ({p.phone})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Surgeon</label>
                                        <select
                                            required
                                            value={newBooking.surgeonId}
                                            onChange={e => setNewBooking({ ...newBooking, surgeonId: e.target.value })}
                                            className="input"
                                        >
                                            <option value="">-- Surgeon --</option>
                                            {doctors.map(d => (
                                                <option key={d._id} value={d._id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Anesthetist</label>
                                        <select
                                            required
                                            value={newBooking.anesthetistId}
                                            onChange={e => setNewBooking({ ...newBooking, anesthetistId: e.target.value })}
                                            className="input"
                                        >
                                            <option value="">-- Anesthetist --</option>
                                            {doctors.map(d => (
                                                <option key={d._id} value={d._id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Procedure</label>
                                        <input
                                            type="text"
                                            required
                                            value={newBooking.procedure}
                                            onChange={e => setNewBooking({ ...newBooking, procedure: e.target.value })}
                                            placeholder="e.g. Open Appendectomy"
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Scheduled Time</label>
                                        <input
                                            type="datetime-local"
                                            required
                                            value={newBooking.scheduledTime}
                                            onChange={e => setNewBooking({ ...newBooking, scheduledTime: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Duration (min)</label>
                                        <input
                                            type="number"
                                            required
                                            value={newBooking.durationMinutes}
                                            onChange={e => setNewBooking({ ...newBooking, durationMinutes: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">OT Room</label>
                                        <input
                                            type="text"
                                            value={newBooking.otRoom}
                                            onChange={e => setNewBooking({ ...newBooking, otRoom: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Surgery Price (INR)</label>
                                        <input
                                            type="number"
                                            required
                                            value={newBooking.price}
                                            onChange={e => setNewBooking({ ...newBooking, price: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowBookModal(false)}
                                        className="btn btn-ghost"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                    >
                                        Schedule Surgery
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Notes Entry Modal */}
            <AnimatePresence>
                {showNotesModal && selectedSurgery && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border dark:border-slate-800 max-w-md w-full shadow-2xl space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Add Clinical Operation Notes</h3>
                                <button onClick={() => { setShowNotesModal(false); setSelectedSurgery(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><X size={20} className="text-slate-500" /></button>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{selectedSurgery.patientName} - {selectedSurgery.procedure}</p>
                            
                            <form onSubmit={handleSaveNotes} className="space-y-4">
                                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Preoperative Diagnosis</label>
                                        <input
                                            type="text"
                                            required
                                            value={notesDraft.preoperativeDiagnosis}
                                            onChange={e => setNotesDraft({ ...notesDraft, preoperativeDiagnosis: e.target.value })}
                                            className="input text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Postoperative Diagnosis</label>
                                        <input
                                            type="text"
                                            required
                                            value={notesDraft.postoperativeDiagnosis}
                                            onChange={e => setNotesDraft({ ...notesDraft, postoperativeDiagnosis: e.target.value })}
                                            className="input text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Procedure Performed</label>
                                        <input
                                            type="text"
                                            required
                                            value={notesDraft.procedurePerformed}
                                            onChange={e => setNotesDraft({ ...notesDraft, procedurePerformed: e.target.value })}
                                            className="input text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Detailed Surgical Findings</label>
                                        <textarea
                                            required
                                            rows="3"
                                            value={notesDraft.surgeryNotes}
                                            onChange={e => setNotesDraft({ ...notesDraft, surgeryNotes: e.target.value })}
                                            className="input text-sm"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Anesthetist Record Notes</label>
                                        <textarea
                                            required
                                            rows="2"
                                            value={notesDraft.anesthetistNotes}
                                            onChange={e => setNotesDraft({ ...notesDraft, anesthetistNotes: e.target.value })}
                                            className="input text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => { setShowNotesModal(false); setSelectedSurgery(null); }}
                                        className="btn btn-ghost"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn btn-primary"
                                    >
                                        Update Surgery Notes
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
