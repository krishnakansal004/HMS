import { useState, useEffect } from 'react';
import { submitDoctorApplication, getPublicTenant } from '../services/api';
import { X, ArrowRight, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DEPARTMENTS = [
    "General Medicine", "Cardiology", "Oncology", "Orthopedics", "Neurology", "Neurosurgery",
    "Pulmonology", "Gastroenterology", "Urology", "Nephrology", "Gynecology & Obstetrics",
    "Pediatrics", "General Surgery", "Anesthesiology", "Radiology", "Pathology",
    "Dermatology", "Endocrinology", "Psychiatry", "Ophthalmology", "ENT (Ear, Nose, Throat)",
    "Dental / Oral Surgery", "Emergency Medicine", "Physical Medicine & Rehabilitation", "Nutrition & Dietetics"
];

const SPECIALIZATIONS = [
    "General Physician", "Cardiologist", "Oncologist", "Orthopedic Surgeon", "Neurologist",
    "Neurosurgeon", "Pulmonologist", "Gastroenterologist", "Urologist", "Nephrologist",
    "Gynecologist", "Pediatrician", "General Surgeon", "Anesthesiologist", "Radiologist",
    "Pathologist", "Dermatologist", "Endocrinologist", "Psychiatrist", "Ophthalmologist",
    "ENT Specialist", "Dentist", "Physiotherapist", "Dietitian", "Plastic Surgeon"
];

const QUALIFICATIONS = [
    "MBBS", "MD", "MS", "DM", "MCh", "DNB", "BAMS", "BHMS", "BDS", "MDS", "BPT", "MPT", "Diploma", "PhD"
];

const SelectWithOther = ({ label, options, value, field, setForm }) => {
    const isCustom = value && !options.includes(value);
    const [showOther, setShowOther] = useState(isCustom);

    useEffect(() => {
        if (value && !options.includes(value) && !showOther) setShowOther(true);
        if (options.includes(value) && showOther) setShowOther(false);
    }, [value, options, showOther]);

    return (
        <div className="mb-3">
            <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
            <select
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 transition-colors bg-white text-sm"
                value={options.includes(value) ? value : (showOther ? 'Other' : '')}
                onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'Other') {
                        setShowOther(true);
                        setForm(f => ({ ...f, [field]: '' }));
                    } else {
                        setShowOther(false);
                        setForm(f => ({ ...f, [field]: val }));
                    }
                }}
                required
            >
                <option value="" disabled>Select {label}</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
                <option value="Other">Other (Specify)</option>
            </select>
            {showOther && (
                <input
                    className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 transition-colors text-sm"
                    placeholder={`Enter ${label}`}
                    value={value}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    autoFocus
                    required
                />
            )}
        </div>
    );
};

export default function DoctorApplyModal({ open, onClose, hospitalSlug, themeColor = '#2563eb' }) {
    const [form, setForm] = useState({ name: '', email: '', phone: '', specialization: '', department: '', education: '', yearsExperience: '', address: '', message: '' });
    const [tenantId, setTenantId] = useState(null);
    const [resolvingTenant, setResolvingTenant] = useState(false);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (open && hospitalSlug) {
            setResolvingTenant(true);
            setError(null);
            getPublicTenant(hospitalSlug)
                .then(t => setTenantId(t.id))
                .catch(() => setError('Failed to load hospital details'))
                .finally(() => setResolvingTenant(false));
        }
    }, [open, hospitalSlug]);

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!tenantId) {
            setError('Missing hospital information. Please refresh.');
            return;
        }
        setLoading(true);
        try {
            await submitDoctorApplication({ ...form, tenantId });
            setDone(true);
        } catch (e) {
            console.error(e);
            // Parse error message from response if available
            const msg = e.response?.data?.error || e.message || 'Failed to submit application. Please try again.';
            if (msg.includes('already pending')) {
                setError('You have already applied! Please wait for admin approval.');
            } else {
                setError(msg);
            }
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                    >
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">Apply as Doctor</h2>
                                <p className="text-slate-500 text-sm">Join our medical team</p>
                            </div>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            {resolvingTenant ? (
                                <div className="py-12 flex justify-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
                                </div>
                            ) : error ? (
                                <div className="text-center py-8 text-red-500">
                                    <p>{error}</p>
                                    <button onClick={onClose} className="mt-4 text-slate-600 underline text-sm">Close</button>
                                </div>
                            ) : done ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">Application Submitted!</h3>
                                    <p className="text-slate-500 max-w-xs mx-auto mb-8">
                                        Your application has been sent to our admin team. We will review it and get back to you shortly.
                                    </p>
                                    <button
                                        onClick={onClose}
                                        className="btn btn-primary px-8 py-3 rounded-xl"
                                        style={{ backgroundColor: themeColor }}
                                    >
                                        Close
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={onSubmit} className="space-y-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                            <input className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 transition-colors text-sm" placeholder="Dr. John Doe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                            <input type="email" className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 transition-colors text-sm" placeholder="doctor@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                                        <input className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 transition-colors text-sm" placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        <SelectWithOther label="Department" options={DEPARTMENTS} value={form.department} field="department" setForm={setForm} />
                                        <SelectWithOther label="Specialization" options={SPECIALIZATIONS} value={form.specialization} field="specialization" setForm={setForm} />
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        <SelectWithOther label="Qualifications" options={QUALIFICATIONS} value={form.education} field="education" setForm={setForm} />
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Years of Exp.</label>
                                            <input className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 transition-colors text-sm" type="number" min="0" placeholder="e.g. 5" value={form.yearsExperience} onChange={e => setForm({ ...form, yearsExperience: e.target.value })} required />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                                        <input className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 transition-colors text-sm" placeholder="Clinic or Residential Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} required />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Cover Message</label>
                                        <textarea className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 transition-colors text-sm min-h-[80px]" placeholder="Brief notes..." value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            disabled={loading}
                                            className="w-full py-3 rounded-xl font-bold text-white shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
                                            style={{ backgroundColor: themeColor }}
                                        >
                                            {loading ? 'Submitting...' : 'Submit Application'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </motion.div>
                </div >
            )
            }
        </AnimatePresence >
    );
}
