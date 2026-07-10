import { useProfileRender } from '../utils/profiler';
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { submitDoctorApplication, getPublicHospitals } from '../services/api'
import PublicNavbar from '../components/PublicNavbar'

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

export default function Signup() {
    useProfileRender('Signup', true);
    const { register, token } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const from = location.state?.from?.pathname || '/'

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Doctor application toggle + fields
    const [applyDoctor, setApplyDoctor] = useState(false)
    const [phone, setPhone] = useState('')
    const [specialization, setSpecialization] = useState('')
    const [department, setDepartment] = useState('')
    const [education, setEducation] = useState('')
    const [yearsExperience, setYearsExperience] = useState('')
    const [address, setAddress] = useState('')
    const [message, setMessage] = useState('')
    const [hospitals, setHospitals] = useState([])
    const [tenantId, setTenantId] = useState('')

    useEffect(() => {
        getPublicHospitals().then(setHospitals).catch(() => { })
    }, [])

    useEffect(() => {
        if (token) navigate('/')
    }, [token])

    const onSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')
        if (!applyDoctor) {
            if (password !== confirm) {
                setError('Passwords do not match')
                return
            }
        }
        setLoading(true)
        try {
            if (applyDoctor) {
                if (!tenantId) {
                    setError('Please select a hospital to apply to')
                    setLoading(false)
                    return
                }
                await submitDoctorApplication({
                    name: name.trim(),
                    email: email.trim(),
                    phone: phone.trim(),
                    specialization: specialization.trim(),
                    department: department.trim(),
                    education: education.trim(),
                    yearsExperience: yearsExperience ? Number(yearsExperience) : 0,
                    address: address.trim(),
                    message: message.trim(),
                    tenantId: tenantId
                })
                setSuccess('Doctor application submitted. Admin will review and you will receive credentials by email if approved.')
                // Clear doctor-specific fields
                setPhone(''); setSpecialization(''); setDepartment(''); setEducation(''); setYearsExperience(''); setAddress(''); setMessage(''); setTenantId('')
            } else {
                await register(name.trim(), email.trim(), password)
                navigate(from, { replace: true })
            }
        } catch (e) {
            setError(e?.data?.error || e.message || 'Request failed')
        } finally {
            setLoading(false)
        }
    }

    // Helper to render select with "Other" option logic
    const renderSelect = (label, options, value, setValue, placeholder) => {
        const isCustom = value && !options.includes(value);
        // We use a simpler logic here: if value is not in options, we assume it's custom/other
        // But to make the UI nice, we need to know if the user explicitly picked "Other"
        // Since we don't have per-field state for "showOther", we infer:
        // If value is truthy and NOT in options, show text input.
        // If value is "Other" (placeholder from select), show text input (and clear value).

        // Actually, we need to allow the user to select "Other" to switch to custom mode.
        // If they select "Other", we can set value to something distinctive or keep it empty but flag it?
        // Let's use a local state variable for "other mode" only if we extract this component.
        // Since we are inline, let's use a state-less approach with a small limitation or
        // use a "magic string" for the select value when custom.

        const showInput = (value && !options.includes(value));

        return (
            <div className="space-y-2">
                <select
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={options.includes(value) ? value : (value ? 'Other' : '')}
                    onChange={(e) => {
                        if (e.target.value === 'Other') {
                            setValue(''); // Clear value to allow typing
                            // But wait, if we set to '', options.includes('') is false.
                            // So showInput becomes false? No, (value && ...) check.
                            // Problem: If value is empty, we don't know if it's "unselected" or "start of custom".
                            // Quick fix: Set value to a specialized empty string or rely on the user typing.
                            // Better: Just show the input if the select value is 'Other'.
                            // But we can't control the select value independently of the real value easily without extra state.
                            // Let's revert to a simpler "isCustom" check and a specialized "Other" option handling.
                            // We will assume that if the user selects "Other", we temporarily force the UI to show input.
                            // To do this properly without extra state, we might need a dedicated CustomSelect component.
                            // For now, let's try a clever hack:
                            // If user selects "Other", we set a special flag or just rely on clear instruction.
                            // Actually, let's just make the input always visible if "Other" is selected.
                            // But "Other" isn't a valid value.
                            // Okay, let's use a simple hybrid:
                            // Select has options + "Other".
                            // If valid option selected -> value = option. Input hidden.
                            // If "Other" selected -> value = "Other" (temporarily). Input shown?
                            // No, let's stick to the pattern used in DoctorApply.jsx which used local state in a sub-component.
                            // I will define a mini component here just like before.
                        } else {
                            setValue(e.target.value);
                        }
                    }}
                >
                    <option value="" disabled>{placeholder}</option>
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                    <option value="Other">Other (Specify)</option>
                </select>

                {/* 
                  Since we can't easily track "Other" mode with just one state variable for the field,
                  we will just use a helper component defined inside or outside. 
                  Let's define it inside Signup for simplicity and closure access.
               */}
            </div>
        )
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-100">
            <PublicNavbar />
            <div className="flex-1 grid place-items-center px-4 sm:px-6 py-24">
                <div className="w-full max-w-md bg-white p-6 rounded-xl shadow border border-slate-200">
                    <div className="mb-6 text-center">
                        <div className="mx-auto mb-2 w-10 h-10 bg-primary rotate-45 rounded-sm" />
                        <h1 className="text-2xl font-semibold">Create your HOSPITECHVERSE account</h1>
                        <p className="text-sm text-slate-500">Fill in your details to continue</p>
                    </div>
                    {error && (
                        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>
                    )}
                    {success && (
                        <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">{success}</div>
                    )}
                    <form onSubmit={onSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
                            <input
                                type="text"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <input
                                type="email"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                            <input id="applyDoctor" type="checkbox" className="h-4 w-4" checked={applyDoctor} onChange={e => setApplyDoctor(e.target.checked)} />
                            <label htmlFor="applyDoctor" className="text-sm font-medium text-slate-700">Apply as Doctor (admin approval required)</label>
                        </div>
                        {!applyDoctor && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                                    <input
                                        type="password"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        minLength={6}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
                                    <input
                                        type="password"
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        minLength={6}
                                        required
                                    />
                                </div>
                            </>
                        )}
                        {applyDoctor && (
                            <div className="space-y-3 border border-slate-200 rounded-lg p-4 bg-slate-50">
                                <div className="text-sm font-semibold text-slate-700">Doctor Application Details</div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Select Hospital</label>
                                    <select
                                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                                        value={tenantId}
                                        onChange={(e) => setTenantId(e.target.value)}
                                        required
                                    >
                                        <option value="" disabled>Select a hospital to apply to</option>
                                        {hospitals.map(h => (
                                            <option key={h.id} value={h.id}>{h.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} required />

                                {/* Specialized Dropdowns using helper component logic */}
                                <SelectWithOther
                                    options={DEPARTMENTS}
                                    value={department}
                                    onChange={setDepartment}
                                    placeholder="Select Department"
                                />
                                <SelectWithOther
                                    options={SPECIALIZATIONS}
                                    value={specialization}
                                    onChange={setSpecialization}
                                    placeholder="Select Specialization"
                                />
                                <SelectWithOther
                                    options={QUALIFICATIONS}
                                    value={education}
                                    onChange={setEducation}
                                    placeholder="Select Education / Qualifications"
                                />

                                <input type="number" min="0" className="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="Years of Experience" value={yearsExperience} onChange={e => setYearsExperience(e.target.value)} />
                                <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} />
                                <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="Cover Message (optional)" value={message} onChange={e => setMessage(e.target.value)} />
                                <p className="text-xs text-slate-600">After submission, the admin will review your application. If approved, credentials for the doctor panel will be emailed to you.</p>
                            </div>
                        )}
                        <button type="submit" disabled={loading} className="w-full btn btn-primary">
                            {loading ? (applyDoctor ? 'Submitting application...' : 'Creating account...') : (applyDoctor ? 'Submit Doctor Application' : 'Create account')}
                        </button>
                        <div className="mt-4 sm:mt-5 text-xs sm:text-sm text-slate-600 text-center flex items-center justify-center gap-2 cursor-pointer hover:text-slate-800" onClick={() => window.location.href = '/auth/google'}>
                            <img src="../../googleLogo.webp" alt="googleLogo" width="20" height="20" />
                            Continue with Google
                        </div>
                    </form>
                    <div className="mt-4 text-xs text-slate-500 text-center">
                        {applyDoctor ? (
                            <>
                                Want a regular account instead? <button type="button" className="text-primary hover:underline" onClick={() => { setApplyDoctor(false); setSuccess(''); }}>Switch to normal signup</button>
                            </>
                        ) : (
                            <>
                                Already have an account?{' '}
                                <Link to="/login" className="text-primary hover:underline">Sign in</Link>
                                {' '}• Apply as doctor?{' '}
                                <button type="button" className="text-primary hover:underline" onClick={() => { setApplyDoctor(true); setSuccess(''); }}>Start here</button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// Helper Component for Dropdown + Other
function SelectWithOther({ options, value, onChange, placeholder }) {
    const isKnown = options.includes(value);
    const [showOther, setShowOther] = useState(value && !isKnown);

    useEffect(() => {
        if (value && !options.includes(value)) setShowOther(true);
        if (options.includes(value)) setShowOther(false);
    }, [value, options]);

    return (
        <div className="w-full">
            <select
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 text-slate-700 bg-white mb-2"
                value={options.includes(value) ? value : (showOther ? 'Other' : '')}
                onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'Other') {
                        setShowOther(true);
                        onChange('');
                    } else {
                        setShowOther(false);
                        onChange(val);
                    }
                }}
            >
                <option value="" disabled>{placeholder}</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
                <option value="Other">Other (Specify)</option>
            </select>
            {showOther && (
                <input
                    type="text"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 animate-fade-in"
                    placeholder={`Enter ${placeholder.replace('Select ', '')}`}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    required
                />
            )}
        </div>
    )
}

