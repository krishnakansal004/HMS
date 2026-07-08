import { useProfileRender } from '../utils/profiler';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { submitDoctorApplication, getPublicTenant } from '../services/api';

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

export default function DoctorApply() {
    useProfileRender('DoctorApply', true);
    const { hospitalSlug } = useParams();
    const [form, setForm] = useState({ name: '', email: '', phone: '', specialization: '', department: '', education: '', yearsExperience: '', address: '', message: '' });
    const [tenantId, setTenantId] = useState(null);
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (hospitalSlug) {
            getPublicTenant(hospitalSlug).then(t => setTenantId(t.id)).catch(() => { })
        }
    }, [hospitalSlug]);

    const onSubmit = async (e) => {
        e.preventDefault();
        await submitDoctorApplication({ ...form, tenantId });
        setDone(true);
    };

    if (done) return (
        <div className="p-6 max-w-lg mx-auto">
            <div className="bg-white rounded-lg shadow p-6 text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h1 className="text-xl font-semibold mb-2">Application Submitted</h1>
                <p className="text-slate-600">Thanks for applying. Our admin team will review your application and contact you via email.</p>
                <button className="btn btn-primary mt-6" onClick={() => setDone(false)}>Submit Another</button>
            </div>
        </div>
    );

    const SelectWithOther = ({ label, options, value, onChange, placeholder }) => {
        const isKnown = options.includes(value);
        const isOther = !isKnown && value !== '';

        return (
            <div className="form-control mb-3">
                <label className="label text-sm font-medium text-slate-700 mb-1 block">{label}</label>
                <select
                    className="input w-full mb-2"
                    value={isKnown ? value : (value ? 'Other' : '')}
                    onChange={(e) => {
                        if (e.target.value === 'Other') onChange(''); // Clear value for user input
                        else onChange(e.target.value);
                    }}
                    required={!value} // Only required if value is empty in select loop (logic checked below)
                >
                    <option value="" disabled>{placeholder || `Select ${label}`}</option>
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    <option value="Other">Other</option>
                </select>
                {(!isKnown && (value || value === '')) && (
                    // Show input if specific value is not in list (implies "Other" or custom entry)
                    // But we want to hide it if user explicitly selected "Select Department" (empty)
                    // Logic fix:
                    // 1. Initial: value="", select="" -> Input hidden (isKnown check fails? No, options doesn't include "". Wait.)
                    // Let's refine the logic.
                    /*
                       If value is empty, select shows default. Input hidden?
                       We want the input ONLY if the user selected "Other".
                       But our state is single source.
                       Problem: If value is "", is it "Other" or "Unselected"?
                       We need a local state or a way to distinguish.
                       Actually, let's keep it simple:
                       If select value is "Other", show input.
                       But select value is derived from `value`.
                       So if I type "MyDept", select says "Other". Input shows "MyDept".
                       If I clear input "", select says "Other". Input shows "".
                       BUT if I start fresh? Value is "". Select says "". Input?
                       If value is "" and it's NOT in options...
                       We need to know if the user INTENDED "Other".
                       With just one string, we can't distinguish "unselected" from "deleted other text".
                       Fix: Use `value` usually. If value is NOT in options and NOT empty, it's definitely Other.
                       If value IS empty, we treat it as unselected dropdown.
                       BUT what if user wants to type a custom value starting from empty?
                       They select "Other". onChange('') is called. Value is ''.
                       We need a secondary tracker for "isOtherMode".
                    */
                    // Simplifying by just always showing select. If they pick Other, we show input.
                    // To support "Other" selection persisting when value is empty:
                    // We check if value is NOT in options.
                    // If value is empty, we assume it's unselected UNLESS we explicitly track it.
                    // Let's use a simpler UI: Always show input if "Other" is selected in dropdown.
                    // But we can't determine "Other" solely from value if value is empty.
                    // We'll use a local 'showOther' boolean if we were inside a component, but here we are in a loop.
                    // Let's just create a wrapper component inside the file.
                    null
                )}
            </div>
        )
    }

    // Better implementation inline
    const renderSelect = (label, options, value, field) => {
        const isCustom = value && !options.includes(value);
        const [showOther, setShowOther] = useState(isCustom);

        // Sync state: if value becomes a known option, hide other.
        // If value is unknown and not empty, show other.
        if (value && !options.includes(value) && !showOther) setShowOther(true);
        if (options.includes(value) && showOther) setShowOther(false);

        return (
            <div className="mb-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
                <select
                    className="input w-full"
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
                        className="input w-full mt-2 animate-fade-in"
                        placeholder={`Enter ${label}`}
                        value={value}
                        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                        autoFocus
                        required
                    />
                )}
            </div>
        )
    }

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm p-8 border border-slate-100">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-800">Apply as Doctor</h1>
                    <p className="text-slate-500 mt-1">Join our medical team. Please fill in your professional details.</p>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                            <input className="input w-full" placeholder="Dr. John Doe" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <input type="email" className="input w-full" placeholder="doctor@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                        <input className="input w-full" placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        {renderSelect('Department', DEPARTMENTS, form.department, 'department')}
                        {renderSelect('Specialization', SPECIALIZATIONS, form.specialization, 'specialization')}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        {renderSelect('Education / Qualifications', QUALIFICATIONS, form.education, 'education')}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Years of Experience</label>
                            <input className="input w-full" type="number" min="0" placeholder="e.g. 5" value={form.yearsExperience} onChange={e => setForm({ ...form, yearsExperience: e.target.value })} required />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                        <input className="input w-full" placeholder="Clinic or Residential Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} required />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Cover Message (Optional)</label>
                        <textarea className="input w-full min-h-[100px]" placeholder="Briefly describe your experience and why you'd like to join..." value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
                    </div>

                    <div className="pt-4">
                        <button className="btn btn-primary w-full py-3 text-lg">Submit Application</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

