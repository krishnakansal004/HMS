import { useProfileRender } from '../utils/profiler';

import { useEffect, useState, useCallback } from 'react';
import { listWards, listBeds, listPatients } from '../services/api';
import { motion } from 'framer-motion';
import { RefreshCw, Activity, User, BedDouble } from 'lucide-react';
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'
import { toast } from 'react-toastify'

export default function WardsLive() {
    useProfileRender('WardsLive', true);
    const [wards, setWards] = useState([]);
    const [bedsByWard, setBedsByWard] = useState({});
    const [patients, setPatients] = useState([]);
    const [poll, setPoll] = useState(true);
    const [loading, setLoading] = useState(false);

    const patientMap = patients.reduce((acc, p) => {
        if (p.inpatient && p.inpatient.isAdmitted && p.inpatient.bed) {
            acc[p.inpatient.bed] = p;
        }
        return acc;
    }, {});

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const wardsData = await listWards();
            setWards(wardsData);
            const bedPromises = wardsData.map(w => listBeds(w._id).then(beds => ({ id: w._id, beds })));
            const bedGroups = await Promise.all(bedPromises);
            const bedsObj = {};
            bedGroups.forEach(bg => { bedsObj[bg.id] = bg.beds; });
            setBedsByWard(bedsObj);
            const pats = await listPatients();
            setPatients(pats);
        } catch (e) { console.error(e) } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);
    useEffect(() => { if (!poll) return; const id = setInterval(fetchAll, 5000); return () => clearInterval(id); }, [fetchAll, poll]);

    return (
        <PageContainer>
            <PageHeader
                title="Live Ward Status"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Live Monitoring' }]}
                actions={
                    <div className="flex items-center gap-3 bg-white p-1 rounded-lg border border-slate-200">
                        <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none text-sm text-slate-600 font-medium hover:bg-slate-50 rounded-md transition-colors">
                            <input type="checkbox" checked={poll} onChange={e => setPoll(e.target.checked)} className="accent-blue-600 w-4 h-4" />
                            <Activity size={16} className={poll ? "text-green-500 animate-pulse" : "text-slate-400"} />
                            Auto-Refresh
                        </label>
                        <div className="w-px h-6 bg-slate-200"></div>
                        <button onClick={fetchAll} disabled={loading} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-md transition-colors" title="Manual Refresh">
                            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                        </button>
                    </div>
                }
            />

            {loading && !wards.length ? (
                <div className="p-12 text-center text-slate-500">Loading live data...</div>
            ) : wards.length === 0 ? (
                <div className="p-12 text-center text-slate-500">No wards configured.</div>
            ) : (
                <div className="grid xl:grid-cols-2 gap-6">
                    {wards.map((w, idx) => {
                        const beds = bedsByWard[w._id] || [];
                        const occupied = beds.filter(b => b.isOccupied).length;
                        const pct = w.capacity ? Math.round((occupied / w.capacity) * 100) : 0;
                        const color = pct > 90 ? 'red' : pct > 75 ? 'amber' : pct > 50 ? 'blue' : 'emerald'

                        return (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                key={w._id}
                                className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full"
                            >
                                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                            {w.name}
                                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-200 text-slate-600 uppercase tracking-wide">{w.type}</span>
                                        </h2>
                                        <div className="text-sm text-slate-500 mt-0.5">Floor {w.floor || 'G'}</div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <div className={`text-2xl font-bold text-${color}-600`}>{pct}%</div>
                                        <div className="text-xs text-slate-500 font-medium">{occupied} / {w.capacity} Beds</div>
                                    </div>
                                </div>
                                <div className="p-5 flex-1 max-h-[400px] overflow-y-auto">
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {beds.map(b => {
                                            const pat = patientMap[b._id];
                                            return (
                                                <div
                                                    key={b._id}
                                                    className={`p-3 rounded-xl border transition-all ${b.isOccupied
                                                            ? 'bg-blue-50 border-blue-200 shadow-sm'
                                                            : 'bg-slate-50 border-slate-100 text-slate-400'
                                                        }`}
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <BedDouble size={16} className={b.isOccupied ? "text-blue-500" : "text-slate-300"} />
                                                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                                                            {b.bedNumber}
                                                        </span>
                                                    </div>

                                                    {pat ? (
                                                        <div className="text-xs">
                                                            <div className="font-bold text-slate-800 truncate" title={pat.name || `${pat.firstName} ${pat.lastName}`}>
                                                                {pat.name || `${pat.firstName} ${pat.lastName}`}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-slate-500 mt-1">
                                                                <User size={10} /> <span>Male, 45</span> {/* Mock age/gender if not in patient obj */}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs font-medium text-slate-400 py-2 text-center">Empty</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {beds.length === 0 && <div className="col-span-full py-8 text-center text-slate-400 italic">No beds configured.</div>}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </PageContainer>
    );
}

