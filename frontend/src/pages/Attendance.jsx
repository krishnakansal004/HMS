import { useProfileRender } from '../utils/profiler';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listAttendance, markAttendance, listStaff, listShifts } from '../services/api';
import { todayStr } from '../utils/time'
import { Calendar, User, CheckCircle, XCircle, Search, Filter, Download, ArrowRight, History, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'
import { toast } from 'react-toastify'

const AttendanceRow = React.memo(({ s, rec, shift, handleMark, openHistory }) => {
    return (
        <tr className="hover:bg-slate-50/80 transition-colors">
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs">
                        {(s.name || 'S')[0]}
                    </div>
                    <div>
                        <div className="font-semibold text-slate-700">{s.name}</div>
                        <div className="text-xs text-slate-500">{s.role}</div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4">
                {shift ? (
                    <div className="text-sm">
                        <div className="flex items-center gap-1 font-medium text-slate-700">
                            <MapPin size={14} className="text-indigo-500" /> {shift.ward?.name || 'Assigned Ward'}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                            {new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                ) : (
                    <span className="text-slate-400 text-xs italic">No shift assigned</span>
                )}
            </td>
            <td className="px-6 py-4">
                {rec ? (
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${rec.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {rec.status}
                    </span>
                ) : (
                    <span className="text-slate-400 text-xs italic">Not Marked</span>
                )}
            </td>
            <td className="px-6 py-4 text-center">
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => handleMark(s._id || s.id, 'present')}
                        disabled={!!rec && rec.status === 'present'}
                        className={`p-2 rounded-lg transition-colors ${rec?.status === 'present' ? 'bg-green-100 text-green-700 cursor-default' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`}
                        title="Mark Present"
                    >
                        <CheckCircle size={18} />
                    </button>
                    <button
                        onClick={() => handleMark(s._id || s.id, 'absent')}
                        disabled={!!rec && rec.status === 'absent'}
                        className={`p-2 rounded-lg transition-colors ${rec?.status === 'absent' ? 'bg-red-100 text-red-700 cursor-default' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                        title="Mark Absent"
                    >
                        <XCircle size={18} />
                    </button>
                    <div className="w-px h-6 bg-slate-200 mx-1"></div>
                    <button
                        onClick={() => openHistory(s)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View History"
                    >
                        <History size={18} />
                    </button>
                </div>
            </td>
        </tr>
    )
})

export default function Attendance() {
    useProfileRender('Attendance', true);
    const queryClient = useQueryClient();
    const [date, setDate] = useState(todayStr());
    const [page, setPage] = useState(1);
    const limit = 25;
    const [filterDept, setFilterDept] = useState('');
    const [search, setSearch] = useState('')

    // History
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyStaff, setHistoryStaff] = useState(null);
    const [historyStart, setHistoryStart] = useState('');
    const [historyEnd, setHistoryEnd] = useState('');
    const [appliedStart, setAppliedStart] = useState('');
    const [appliedEnd, setAppliedEnd] = useState('');
    const [historyPage, setHistoryPage] = useState(0);
    const [historyPageSize] = useState(20);

    const { data: historyQueryData, isLoading: historyLoading } = useQuery({
        queryKey: ['attendanceHistory', historyStaff?._id || historyStaff?.id, appliedStart, appliedEnd, historyPage, historyPageSize],
        queryFn: () => listAttendance({
            staffId: historyStaff?._id || historyStaff?.id,
            startDate: appliedStart,
            endDate: appliedEnd,
            limit: historyPageSize,
            skip: historyPage * historyPageSize
        }),
        enabled: historyOpen && !!historyStaff && !!appliedStart && !!appliedEnd,
    })

    const historyRecords = useMemo(() => {
        if (!historyQueryData) return []
        return Array.isArray(historyQueryData) ? historyQueryData : (historyQueryData.items || [])
    }, [historyQueryData])

    const historyTotal = useMemo(() => {
        if (!historyQueryData) return 0
        return historyQueryData.total || (Array.isArray(historyQueryData) ? historyQueryData.length : 0)
    }, [historyQueryData])

    // Queries using TanStack Query
    const { data: rawStaff, isLoading: staffLoading } = useQuery({
        queryKey: ['staff', page],
        queryFn: () => listStaff({ page, limit }),
    });

    const staff = useMemo(() => {
        return Array.isArray(rawStaff) ? rawStaff : [];
    }, [rawStaff]);

    const { data: rawShifts } = useQuery({
        queryKey: ['shifts'],
        queryFn: () => listShifts(),
    });

    const shifts = useMemo(() => {
        return Array.isArray(rawShifts) ? rawShifts : [];
    }, [rawShifts]);

    const { data: rawRecords, isLoading: recordsLoading, refetch: fetchRecords } = useQuery({
        queryKey: ['attendance', date],
        queryFn: () => listAttendance({ date }),
    });

    const records = useMemo(() => {
        return Array.isArray(rawRecords) ? rawRecords : (rawRecords?.items || []);
    }, [rawRecords]);

    const loading = staffLoading || recordsLoading;

    const statusForStaff = useCallback((id) => {
        const sid = String(id)
        return records.find(r => {
            const staffId = r.staff?._id || r.staff?.id || r.staff
            return String(staffId) === sid
        })
    }, [records])

    const shiftForStaff = useCallback((id) => {
        return shifts.find(s => String(s.staff?._id || s.staff) === String(id));
    }, [shifts]);

    const handleMark = useCallback(async (staffId, status) => {
        try {
            await markAttendance({ staffId, date, status });
            toast.success(`Marked as ${status}`)
            queryClient.invalidateQueries({ queryKey: ['attendance', date] });
        } catch (err) { toast.error('Failed to mark attendance') }
    }, [date, queryClient]);

    const openHistory = useCallback((staffMember) => {
        setHistoryStaff(staffMember);
        const now = new Date()
        const y = now.getFullYear(), m = now.getMonth()
        const start = new Date(y, m, 1).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
        const end = new Date(y, m + 1, 0).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
        setHistoryStart(start); setHistoryEnd(end);
        setAppliedStart(start); setAppliedEnd(end);
        setHistoryOpen(true);
        setHistoryPage(0);
    }, []);

    const exportHistoryCSV = async () => {
        try {
            const params = { staffId: historyStaff._id || historyStaff.id, startDate: historyStart, endDate: historyEnd };
            const res = await listAttendance(params);
            const items = Array.isArray(res) ? res : (res.items || []);
            if (!items.length) return toast.info('No records to export');
            const rows = [['Date', 'Status', 'Check-In', 'Check-Out', 'Notes']];
            for (const r of items) rows.push([r.date, r.status, r.checkInAt || '', r.checkOutAt || '', (r.notes || '')]);
            const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url;
            a.download = `${historyStaff.name.replace(/\s+/g, '_')}_attendance.csv`;
            a.click(); URL.revokeObjectURL(url);
        } catch (err) { toast.error('Export failed') }
    };

    const departments = useMemo(() => {
        return Array.from(new Set(staff.map(s => s.department).filter(Boolean)));
    }, [staff]);

    const filteredStaff = useMemo(() => {
        return staff.filter(s => {
            if (filterDept && s.department !== filterDept) return false
            if (search) return s.name.toLowerCase().includes(search.toLowerCase())
            return true
        })
    }, [staff, filterDept, search]);

    const hasMore = staff.length === limit;

    return (
        <PageContainer>
            <PageHeader
                title="Staff Attendance"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Attendance' }]}
                actions={
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <input type="date" className="pl-3 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <button className="btn btn-secondary btn-sm h-[38px]" onClick={() => fetchRecords()} disabled={loading}>Refresh</button>
                    </div>
                }
            />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-12rem)] md:h-auto overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search staff..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-2 rounded-lg border border-slate-200">
                            <Filter size={14} />
                            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="bg-transparent outline-none font-medium text-slate-700 w-32">
                                <option value="">All Depts</option>
                                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="table-responsive flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 sticky top-0 z-10 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Staff Member</th>
                                <th className="px-6 py-4">Assignment</th>
                                <th className="px-6 py-4">Attendance</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Loading attendance...</td></tr>
                            ) : filteredStaff.length === 0 ? (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-500">No staff found.</td></tr>
                            ) : filteredStaff.map(s => {
                                const rec = statusForStaff(s._id || s.id)
                                const shift = shiftForStaff(s._id || s.id)
                                return (
                                    <AttendanceRow
                                        key={s._id || s.id}
                                        s={s}
                                        rec={rec}
                                        shift={shift}
                                        handleMark={handleMark}
                                        openHistory={openHistory}
                                    />
                                )
                            })}
                        </tbody>
                    </table>
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
                {historyOpen && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Attendance History</h2>
                                    <div className="text-sm text-slate-500">{historyStaff?.name}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={exportHistoryCSV} className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-slate-50">
                                        <Download size={14} /> Export CSV
                                    </button>
                                    <button onClick={() => setHistoryOpen(false)} className="p-2 hover:bg-slate-100 rounded-full"><XCircle size={20} className="text-slate-500" /></button>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 flex flex-wrap gap-4 items-center text-sm border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <span>From:</span>
                                    <input type="date" className="input py-1" value={historyStart} onChange={e => setHistoryStart(e.target.value)} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span>To:</span>
                                    <input type="date" className="input py-1" value={historyEnd} onChange={e => setHistoryEnd(e.target.value)} />
                                </div>
                                <button className="btn btn-secondary btn-sm" onClick={() => { setHistoryPage(0); setAppliedStart(historyStart); setAppliedEnd(historyEnd); }} disabled={historyLoading}>Load</button>
                            </div>

                            <div className="flex-1 table-responsive">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="bg-slate-50/50 sticky top-0 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-3 font-semibold text-slate-600">Date</th>
                                            <th className="px-6 py-3 font-semibold text-slate-600">Status</th>
                                            <th className="px-6 py-3 font-semibold text-slate-600">Check In</th>
                                            <th className="px-6 py-3 font-semibold text-slate-600">Check Out</th>
                                            <th className="px-6 py-3 font-semibold text-slate-600">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {historyLoading ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading history...</td></tr>
                                        ) : historyRecords.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">No records in range.</td></tr>
                                        ) : historyRecords.map(r => (
                                            <tr key={r._id || r.id} className="hover:bg-slate-50">
                                                <td className="px-6 py-3 text-slate-700">{r.date}</td>
                                                <td className="px-6 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${r.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {r.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-slate-600">{r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : '—'}</td>
                                                <td className="px-6 py-3 text-slate-600">{r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString() : '—'}</td>
                                                <td className="px-6 py-3 text-slate-500 italic">{r.notes || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm">
                                <div className="text-slate-500">Page {historyPage + 1} of {Math.max(1, Math.ceil(historyTotal / historyPageSize))} ({historyTotal} records)</div>
                                <div className="flex gap-2">
                                    <button className="btn btn-sm btn-ghost" onClick={() => {
                                        const prev = Math.max(0, historyPage - 1);
                                        if (prev < historyPage) { setHistoryPage(prev) }
                                    }} disabled={historyLoading || historyPage === 0}>Previous</button>
                                    <button className="btn btn-sm btn-ghost" onClick={() => {
                                        const next = historyPage + 1;
                                        const maxPage = Math.max(0, Math.ceil(historyTotal / historyPageSize) - 1);
                                        if (next <= maxPage) { setHistoryPage(next) }
                                    }} disabled={historyLoading || ((historyPage + 1) * historyPageSize >= historyTotal)}>Next</button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </PageContainer>
    );
}

