import { useProfileRender } from '../utils/profiler';
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { Eye, FileDown, Plus, Search, Upload, Maximize, ZoomIn, ZoomOut, Contrast, Sun, RotateCw, Compass } from 'lucide-react';

export default function Radiology() {
    useProfileRender('Radiology', true);
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [activeTab, setActiveTab] = useState(user?.role === 'patient' ? 'my-studies' : 'active-orders');

    // Modals & Uploads
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newOrder, setNewOrder] = useState({ patientId: '', modality: 'X-RAY', studyType: '', bodyPart: '', urgency: 'routine', price: '' });
    const [uploadingOrderId, setUploadingOrderId] = useState(null);
    const [showPacsRoom, setShowPacsRoom] = useState(false);

    // PACS Simulator Interactive States
    const [zoom, setZoom] = useState(1);
    const [contrast, setContrast] = useState(100);
    const [brightness, setBrightness] = useState(100);
    const [rotation, setRotation] = useState(0);
    const [rulerPoints, setRulerPoints] = useState([]);
    const [rulerDistance, setRulerDistance] = useState(null);

    const { data: ordersData } = useQuery({
        queryKey: ['radiologyOrders'],
        queryFn: async () => {
            const res = await fetch('/api/radiology/orders', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` }
            });
            if (!res.ok) throw new Error('Failed to load radiology orders');
            return res.json();
        }
    });

    const { data: patientsData } = useQuery({
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

    const orders = useMemo(() => Array.isArray(ordersData) ? ordersData : [], [ordersData]);
    const patients = useMemo(() => Array.isArray(patientsData) ? patientsData : [], [patientsData]);

    const handleCreateOrder = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/radiology/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}`
                },
                body: JSON.stringify(newOrder)
            });
            if (res.ok) {
                toast.success('Radiology order created successfully');
                setShowCreateModal(false);
                setNewOrder({ patientId: '', modality: 'X-RAY', studyType: '', bodyPart: '', urgency: 'routine', price: '' });
                queryClient.invalidateQueries({ queryKey: ['radiologyOrders'] });
            }
        } catch (e) { toast.error('Creation failed'); }
    };

    const handleUploadScan = async (orderId, file) => {
        const formData = new FormData();
        formData.append('scan', file);

        try {
            const res = await fetch(`/api/radiology/orders/${orderId}/scans`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}` },
                body: formData
            });
            if (res.ok) {
                toast.success('Imaging scan uploaded successfully');
                queryClient.invalidateQueries({ queryKey: ['radiologyOrders'] });
            }
        } catch (e) { toast.error('Upload failed'); }
    };

    const handleCompleteStudy = async (orderId, findings, impression) => {
        try {
            const res = await fetch(`/api/radiology/orders/${orderId}/complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('hms.auth.token')}`
                },
                body: JSON.stringify({
                    findings,
                    impression,
                    scanMetadata: { sliceCount: 160, windowWidth: 350, windowCenter: 50, doseMsv: 1.2 }
                })
            });
            if (res.ok) {
                toast.success('Study reported and finalized. Charges posted.');
                setShowPacsRoom(false);
                setSelectedOrder(null);
                queryClient.invalidateQueries({ queryKey: ['radiologyOrders'] });
            }
        } catch (e) { toast.error('Finalization failed'); }
    };

    const handleCanvasClick = (e) => {
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (rulerPoints.length < 2) {
            const points = [...rulerPoints, { x, y }];
            setRulerPoints(points);

            if (points.length === 2) {
                const dist = Math.sqrt(Math.pow(points[1].x - points[0].x, 2) + Math.pow(points[1].y - points[0].y, 2));
                setRulerDistance(Math.round(dist * 0.15)); // 1 pixel ~ 0.15mm mock caliper scale
            }
        } else {
            // Reset caliper on third click
            setRulerPoints([{ x, y }]);
            setRulerDistance(null);
        }
    };

    const openPacsSimulator = (order) => {
        setSelectedOrder(order);
        setZoom(1);
        setContrast(100);
        setBrightness(100);
        setRotation(0);
        setRulerPoints([]);
        setRulerDistance(null);
        setShowPacsRoom(true);
    };

    const filteredOrders = orders.filter(o =>
        o.patientName?.toLowerCase().includes(search.toLowerCase()) ||
        o.studyType?.toLowerCase().includes(search.toLowerCase()) ||
        o.modality?.includes(search.toUpperCase())
    );

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/60 backdrop-blur-md p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
                        <Compass className="text-indigo-600 animate-spin" size={32} style={{ animationDuration: '6s' }} />
                        Radiology Information & PACS Workstation
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">Order medical imaging scans, manage DICOM studies, and run interactive PACS markup.</p>
                </div>
                {user?.role !== 'patient' && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg hover:scale-[1.02] flex items-center gap-2 cursor-pointer"
                    >
                        <Plus size={18} />
                        Order Scan Study
                    </button>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
                {user?.role !== 'patient' && (
                    <>
                        <button
                            onClick={() => setActiveTab('active-orders')}
                            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer ${activeTab === 'active-orders' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                        >
                            Active Scan Studies
                        </button>
                    </>
                )}
                {user?.role === 'patient' && (
                    <button
                        onClick={() => setActiveTab('my-studies')}
                        className="bg-white text-slate-800 px-4 py-2 rounded-lg font-semibold text-sm shadow-sm"
                    >
                        My Imaging Studies
                    </button>
                )}
            </div>

            {/* Orders List Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50/50 border-b flex items-center justify-between">
                    <div className="relative max-w-xs w-full">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Filter scans..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-1.5 w-full bg-white border rounded-lg text-sm text-slate-700 focus:outline-none"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b bg-slate-50/30 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                <th className="p-4">Patient Details</th>
                                <th className="p-4">Modality</th>
                                <th className="p-4">Study / body part</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Urgency</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-sm text-slate-700">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-slate-400">No active radiology records found.</td>
                                </tr>
                            ) : (
                                filteredOrders.map(o => (
                                    <tr key={o._id} className="hover:bg-slate-50/30 transition-all">
                                        <td className="p-4 font-bold text-slate-800">{o.patientName}</td>
                                        <td className="p-4">
                                            <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md">{o.modality}</span>
                                        </td>
                                        <td className="p-4 font-semibold">
                                            {o.studyType}
                                            <span className="block text-xs font-medium text-slate-400 mt-0.5">Part: {o.bodyPart}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase ${o.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : o.status === 'scanning' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>
                                                {o.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs font-bold capitalize">{o.urgency}</td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            {o.status === 'pending' && user?.role !== 'patient' && (
                                                <div className="relative">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={e => handleUploadScan(o._id, e.target.files[0])}
                                                        className="hidden"
                                                        id={`upload-scan-${o._id}`}
                                                    />
                                                    <label
                                                        htmlFor={`upload-scan-${o._id}`}
                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                                                    >
                                                        <Upload size={12} /> Upload Scan
                                                    </label>
                                                </div>
                                            )}
                                            {o.scanImages && o.scanImages.length > 0 && (
                                                <button
                                                    onClick={() => openPacsSimulator(o)}
                                                    className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                                                >
                                                    <Eye size={12} /> Diagnostic View
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PACS simulator room overlay */}
            {showPacsRoom && selectedOrder && (
                <div className="fixed inset-0 bg-slate-950/98 z-50 overflow-y-auto flex flex-col">
                    {/* Top PACS toolbar */}
                    <div className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center text-slate-200">
                        <div>
                            <h3 className="font-extrabold text-white flex items-center gap-2 text-lg">
                                <Maximize size={20} className="text-indigo-400" />
                                Diagnostic Workstation (PACS)
                            </h3>
                            <p className="text-slate-400 text-xs mt-0.5">Patient: {selectedOrder.patientName} | Modality: {selectedOrder.modality} | Body Part: {selectedOrder.bodyPart}</p>
                        </div>
                        <button
                            onClick={() => setShowPacsRoom(false)}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all cursor-pointer"
                        >
                            Exit Station
                        </button>
                    </div>

                    {/* Workstation body */}
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 bg-slate-950">
                        {/* Interactive Viewer panel (left 3 columns) */}
                        <div className="lg:col-span-3 p-6 flex flex-col items-center justify-center space-y-4">
                            {/* Toolbar controls */}
                            <div className="flex flex-wrap gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 w-fit text-slate-300">
                                <button onClick={() => setZoom(prev => Math.min(prev + 0.1, 2.5))} className="p-2 hover:bg-slate-800 rounded-lg cursor-pointer" title="Zoom In"><ZoomIn size={16} /></button>
                                <button onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.5))} className="p-2 hover:bg-slate-800 rounded-lg cursor-pointer" title="Zoom Out"><ZoomOut size={16} /></button>
                                <button onClick={() => setRotation(prev => (prev + 90) % 360)} className="p-2 hover:bg-slate-800 rounded-lg cursor-pointer" title="Rotate"><RotateCw size={16} /></button>
                                <div className="h-6 w-px bg-slate-800"></div>
                                <div className="flex items-center gap-2 text-xs">
                                    <Sun size={14} /> Brightness:
                                    <input type="range" min="50" max="150" value={brightness} onChange={e => setBrightness(e.target.value)} className="w-20" />
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <Contrast size={14} /> Contrast:
                                    <input type="range" min="50" max="150" value={contrast} onChange={e => setContrast(e.target.value)} className="w-20" />
                                </div>
                            </div>

                            {/* Viewport Canvas wrapper */}
                            <div className="relative border border-slate-800 rounded-2xl bg-black w-full max-w-xl h-96 flex items-center justify-center overflow-hidden shadow-2xl">
                                <img
                                    src={selectedOrder.scanImages[0]?.url}
                                    alt="DICOM Scan"
                                    onClick={handleCanvasClick}
                                    style={{
                                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                        filter: `brightness(${brightness}%) contrast(${contrast}%)`,
                                        transition: 'transform 0.15s ease-out'
                                    }}
                                    className="max-h-full max-w-full object-contain cursor-crosshair select-none"
                                />

                                {/* Render Caliper line */}
                                {rulerPoints.map((pt, i) => (
                                    <div key={i} className="absolute w-2 h-2 bg-emerald-500 rounded-full border border-white" style={{ left: pt.x, top: pt.y }} />
                                ))}
                                {rulerPoints.length === 2 && (
                                    <svg className="absolute inset-0 pointer-events-none w-full h-full">
                                        <line x1={rulerPoints[0].x} y1={rulerPoints[0].y} x2={rulerPoints[1].x} y2={rulerPoints[1].y} stroke="#10b981" strokeWidth="2" strokeDasharray="4" />
                                        <text x={(rulerPoints[0].x + rulerPoints[1].x)/2} y={(rulerPoints[0].y + rulerPoints[1].y)/2 - 10} fill="#10b981" fontSize="12" fontWeight="bold" textAnchor="middle">
                                            {rulerDistance} mm
                                        </text>
                                    </svg>
                                )}

                                {/* Overlay clinical metadata */}
                                <div className="absolute top-4 left-4 text-emerald-500 font-mono text-xs text-left pointer-events-none space-y-0.5">
                                    <p>SLICE: 84 / 160</p>
                                    <p>WINDOW: W:{contrast * 3} C:{(brightness-50)*2}</p>
                                    <p>ZOOM: {Math.round(zoom * 100)}%</p>
                                </div>
                            </div>
                            <p className="text-slate-500 text-xs italic">Caliper Calibrated: Click once to set point A, click again to set point B to measure features in mm.</p>
                        </div>

                        {/* Diagnostic Form panel (right 1 column) */}
                        <div className="bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between text-slate-200">
                            <div className="space-y-4">
                                <h4 className="font-extrabold text-white text-md uppercase border-b border-slate-800 pb-2">Findings Report</h4>
                                
                                {selectedOrder.status !== 'completed' && user?.role !== 'patient' ? (
                                    <form onSubmit={e => {
                                        e.preventDefault();
                                        handleCompleteStudy(selectedOrder._id, e.target.findings.value, e.target.impression.value);
                                    }} className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-400 font-bold block">Observations / Findings</label>
                                            <textarea
                                                name="findings"
                                                required
                                                rows="4"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                                                placeholder="Write detailed radiology findings..."
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-400 font-bold block">Clinical Impression</label>
                                            <textarea
                                                name="impression"
                                                required
                                                rows="2"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                                                placeholder="Summary diagnosis / Impression..."
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold w-full py-2.5 rounded-xl text-sm transition-all cursor-pointer"
                                        >
                                            Finalize Diagnostic Report
                                        </button>
                                    </form>
                                ) : (
                                    <div className="space-y-4 text-sm">
                                        <div>
                                            <span className="text-xs text-slate-400 font-bold block">Findings:</span>
                                            <p className="mt-1 text-slate-300 font-semibold">{selectedOrder.findings || 'No findings reported yet.'}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-400 font-bold block">Impression:</span>
                                            <p className="mt-1 text-slate-300 font-extrabold text-emerald-400">{selectedOrder.impression || 'Pending pathologist review.'}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="border-t border-slate-800 pt-4 text-xs text-slate-500 font-mono space-y-1">
                                <p>STUDY: DICOM 3.0 HIP</p>
                                <p>DEVICE: SIMULATOR V1.2</p>
                                <p>TPA BILL: CHARGED TO BILLING</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Order Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <form onSubmit={handleCreateOrder} className="bg-white p-6 rounded-2xl border max-w-md w-full shadow-2xl space-y-4">
                        <h3 className="text-xl font-extrabold text-slate-800">New Medical Imaging Order</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2 space-y-1">
                                <label className="text-xs font-bold text-slate-500">Select Patient</label>
                                <select
                                    required
                                    value={newOrder.patientId}
                                    onChange={e => setNewOrder({ ...newOrder, patientId: e.target.value })}
                                    className="px-3 py-2 w-full border rounded-xl bg-white"
                                >
                                    <option value="">-- Choose Patient --</option>
                                    {patients.map(p => (
                                        <option key={p._id} value={p._id}>{p.firstName} {p.lastName} ({p.phone})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">Modality</label>
                                <select
                                    value={newOrder.modality}
                                    onChange={e => setNewOrder({ ...newOrder, modality: e.target.value })}
                                    className="px-3 py-2 w-full border rounded-xl bg-white"
                                >
                                    <option value="X-RAY">X-Ray</option>
                                    <option value="MRI">MRI</option>
                                    <option value="CT">CT Scan</option>
                                    <option value="ULTRASOUND">Ultrasound</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">Urgency</label>
                                <select
                                    value={newOrder.urgency}
                                    onChange={e => setNewOrder({ ...newOrder, urgency: e.target.value })}
                                    className="px-3 py-2 w-full border rounded-xl bg-white"
                                >
                                    <option value="routine">Routine</option>
                                    <option value="urgent">Urgent</option>
                                    <option value="emergency">Emergency</option>
                                </select>
                            </div>
                            <div className="col-span-2 space-y-1">
                                <label className="text-xs font-bold text-slate-500">Study Type / Clinical Indication</label>
                                <input
                                    type="text"
                                    required
                                    value={newOrder.studyType}
                                    onChange={e => setNewOrder({ ...newOrder, studyType: e.target.value })}
                                    placeholder="e.g. Spine MRI with Contrast"
                                    className="px-3 py-2 w-full border rounded-xl bg-white"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">Body Part</label>
                                <input
                                    type="text"
                                    required
                                    value={newOrder.bodyPart}
                                    onChange={e => setNewOrder({ ...newOrder, bodyPart: e.target.value })}
                                    placeholder="e.g. Brain, Lumbar"
                                    className="px-3 py-2 w-full border rounded-xl bg-white"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500">Price (INR)</label>
                                <input
                                    type="number"
                                    required
                                    value={newOrder.price}
                                    onChange={e => setNewOrder({ ...newOrder, price: e.target.value })}
                                    className="px-3 py-2 w-full border rounded-xl bg-white"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-4 py-2 rounded-xl cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl cursor-pointer"
                            >
                                Place Order
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

