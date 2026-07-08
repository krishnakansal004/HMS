import { useProfileRender } from '../utils/profiler';

import { useEffect, useState } from 'react'
import { getMyPatient, updateMyPatient, uploadMyAvatar, uploadMyReportsMulti, listMyReports, updateMe } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { toast } from 'react-toastify'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { todayStr } from '../utils/time'
import { User, Mail, Phone, MapPin, Heart, Activity, FileText, Upload, Plus, X, Save, Edit2, Globe, Shield, Calendar, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'

export default function MyProfile() {
    useProfileRender('MyProfile', true);
    const { user, refreshUser } = useAuth()
    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [patient, setPatient] = useState(null)
    const [editing, setEditing] = useState(false)
    const [form, setForm] = useState({})
    const [avatarFile, setAvatarFile] = useState(null)
    const [activeTab, setActiveTab] = useState('details') // details, history, reports

    useEffect(() => { load() }, [])

    const load = async () => {
        setLoading(true)
        try {
            const data = await getMyPatient()
            setPatient(data)
            setForm({
                firstName: data.firstName || '',
                email: data.email || '',
                lastName: data.lastName || '',
                phone: data.phone || '',
                address: data.address || '',
                emergencyContact: data.emergencyContact || { name: '', phone: '', relation: '' },
                medicalHistory: data.medicalHistory || [],
                allergies: data.allergies || []
            })
        } catch (e) { toast.error('Failed to load profile') }
        finally { setLoading(false) }
    }

    const handleSave = async () => {
        try {
            await updateMyPatient(form)
            toast.success('Profile updated')
            setEditing(false)
            await load()
        } catch (e) { toast.error('Failed to update profile') }
    }

    const handleUploadAvatar = async () => {
        if (!avatarFile) return
        const fd = new FormData()
        fd.append('avatar', avatarFile)
        try {
            await uploadMyAvatar(fd)
            toast.success('Avatar updated')
            setAvatarFile(null)
            await load()
            await refreshUser()
        } catch (e) { toast.error('Failed to upload avatar') }
    }

    const addHistory = () => {
        setForm(prev => ({
            ...prev,
            medicalHistory: [...(prev.medicalHistory || []), { condition: '', notes: '', diagnosedAt: todayStr(), treatment: '', startDate: '', endDate: '' }]
        }))
        setActiveTab('history')
        setEditing(true)
    }

    if (loading) return <div className="p-10 text-center text-slate-500">Loading profile...</div>
    if (!patient) return <div className="p-10 text-center text-slate-500">No patient record found.</div>

    return (
        <PageContainer>
            <PageHeader title="My Profile" breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Profile' }]} />

            <div className="grid lg:grid-cols-12 gap-6">
                {/* LEFT SIDEBAR - PROFILE CARD */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative group">
                        <div className="h-24 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                        <div className="px-6 pb-6 pt-0 relative">
                            <div className="absolute -top-12 left-6">
                                <div className="relative">
                                    <img
                                        src={avatarFile ? URL.createObjectURL(avatarFile) : (patient.avatarUrl || `https://api.dicebear.com/9.x/initials/svg?seed=${patient.firstName}`)}
                                        alt="Avatar"
                                        className="w-24 h-24 rounded-2xl border-4 border-white shadow-md object-cover bg-white"
                                    />
                                    <label className="absolute bottom-0 -right-2 p-1.5 bg-white rounded-full shadow border border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors text-slate-600">
                                        <Edit2 size={14} />
                                        <input type="file" className="hidden" accept="image/*" onChange={e => {
                                            if (e.target.files?.[0]) {
                                                setAvatarFile(e.target.files[0])
                                                // auto upload or show save button
                                            }
                                        }} />
                                    </label>
                                </div>
                            </div>

                            <div className="mt-14 mb-4">
                                <h2 className="text-xl font-bold text-slate-800">{patient.firstName} {patient.lastName}</h2>
                                <div className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                                    <Mail size={14} /> {patient.email}
                                </div>
                            </div>

                            {avatarFile && (
                                <button onClick={handleUploadAvatar} className="w-full btn btn-primary mb-4">Save New Photo</button>
                            )}

                            <div className="space-y-3 pt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500 flex items-center gap-2"><Phone size={14} /> Phone</span>
                                    <span className="font-medium text-slate-800">{patient.phone || '—'}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500 flex items-center gap-2"><MapPin size={14} /> Location</span>
                                    <span className="font-medium text-slate-800 truncate max-w-[150px]">{patient.address || '—'}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500 flex items-center gap-2"><Globe size={14} /> Language</span>
                                    <select
                                        className="text-right text-slate-800 font-medium bg-transparent focus:outline-none cursor-pointer"
                                        value={user?.locale || 'en'}
                                        onChange={async (e) => {
                                            try {
                                                await updateMe({ locale: e.target.value })
                                                i18n.changeLanguage(e.target.value)
                                                await refreshUser()
                                                toast.success('Language updated')
                                            } catch (err) { }
                                        }}
                                    >
                                        <option value="en">English</option>
                                        <option value="hi">Hindi (हिन्दी)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-200 text-white p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="font-bold text-lg">Emergency Contact</h3>
                                <p className="text-indigo-100 text-xs mt-1">In case of any emergency</p>
                            </div>
                            <Shield size={24} className="opacity-80" />
                        </div>
                        <div className="space-y-1">
                            <div className="text-2xl font-bold">{patient.emergencyContact?.phone || '—'}</div>
                            <div className="font-medium text-indigo-100">{patient.emergencyContact?.name || 'Not set'}</div>
                            <div className="text-xs opacity-70 uppercase tracking-wider mt-1">{patient.emergencyContact?.relation}</div>
                        </div>
                        <button onClick={() => { setActiveTab('details'); setEditing(true) }} className="w-full mt-4 btn bg-white/20 hover:bg-white/30 border-none text-white btn-sm">
                            Update Contact
                        </button>
                    </div>
                </div>

                {/* RIGHT CONTENT */}
                <div className="lg:col-span-8 space-y-6">
                    {/* TABS */}
                    <div className="flex items-center gap-2 border-b border-slate-200">
                        {['details', 'history', 'reports'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 transition-colors ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {tab === 'details' && 'Personal Info'}
                                {tab === 'history' && 'Medical History'}
                                {tab === 'reports' && 'Digital Reports'}
                            </button>
                        ))}
                    </div>

                    <div className="min-h-[400px]">
                        {activeTab === 'details' && (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-fade-in">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="font-bold text-slate-800 text-lg">Personal Information</h3>
                                    <button
                                        onClick={() => {
                                            if (editing) handleSave()
                                            else setEditing(true)
                                        }}
                                        className={`btn btn-sm ${editing ? 'btn-primary' : 'btn-outline'}`}
                                    >
                                        {editing ? <><Save size={16} /> Save Changes</> : <><Edit2 size={16} /> Edit Details</>}
                                    </button>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="label">First Name</label>
                                            <input disabled={!editing} className="input w-full" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="label">Last Name</label>
                                            <input disabled={!editing} className="input w-full" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="label">Email Address</label>
                                            <input disabled={!editing} className="input w-full" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="label">Phone Number</label>
                                            <input disabled={!editing} className="input w-full" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="label">Home Address</label>
                                            <input disabled={!editing} className="input w-full" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-100">
                                    <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Shield size={18} className="text-red-500" /> Emergency Contact</h4>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="label">Contact Name</label>
                                            <input disabled={!editing} className="input w-full" placeholder="e.g. John Doe"
                                                value={form.emergencyContact?.name} onChange={e => setForm({ ...form, emergencyContact: { ...form.emergencyContact, name: e.target.value } })} />
                                        </div>
                                        <div>
                                            <label className="label">Phone</label>
                                            <input disabled={!editing} className="input w-full" placeholder="+91..."
                                                value={form.emergencyContact?.phone} onChange={e => setForm({ ...form, emergencyContact: { ...form.emergencyContact, phone: e.target.value } })} />
                                        </div>
                                        <div>
                                            <label className="label">Relation</label>
                                            <input disabled={!editing} className="input w-full" placeholder="e.g. Father"
                                                value={form.emergencyContact?.relation} onChange={e => setForm({ ...form, emergencyContact: { ...form.emergencyContact, relation: e.target.value } })} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="space-y-4 animate-fade-in">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800 text-lg">Medical History</h3>
                                    <button onClick={addHistory} className="btn btn-primary btn-sm"><Plus size={16} /> Add Record</button>
                                </div>

                                {(form.medicalHistory || []).length === 0 ? (
                                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        <Heart size={32} className="mx-auto text-slate-300 mb-2" />
                                        <p className="text-slate-500">No medical history records found.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {(form.medicalHistory || []).map((entry, idx) => (
                                            <div key={idx} className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 group">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div className="flex-1 grid md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-400 uppercase">Condition</label>
                                                            <input
                                                                className="w-full font-semibold text-slate-800 border-b border-transparent focus:border-blue-500 focus:outline-none bg-transparent"
                                                                placeholder="e.g. Diabetes Type 2"
                                                                value={entry.condition} onChange={e => {
                                                                    const nh = [...form.medicalHistory]; nh[idx].condition = e.target.value; setForm({ ...form, medicalHistory: nh })
                                                                }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-slate-400 uppercase">Timeline</label>
                                                            <div className="flex gap-2 text-sm">
                                                                <input type="date" className="bg-transparent focus:outline-none" value={entry.startDate?.split('T')[0] || ''} onChange={e => {
                                                                    const nh = [...form.medicalHistory]; nh[idx].startDate = e.target.value; setForm({ ...form, medicalHistory: nh })
                                                                }} />
                                                                <span className="text-slate-400">-</span>
                                                                <input type="date" className="bg-transparent focus:outline-none" value={entry.endDate?.split('T')[0] || ''} onChange={e => {
                                                                    const nh = [...form.medicalHistory]; nh[idx].endDate = e.target.value; setForm({ ...form, medicalHistory: nh })
                                                                }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 transition-opacity">
                                                        <button onClick={handleSave} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Save size={16} /></button>
                                                        <button onClick={() => {
                                                            const nh = form.medicalHistory.filter((_, i) => i !== idx); setForm({ ...form, medicalHistory: nh }); handleSave()
                                                        }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                                    </div>
                                                </div>
                                                <div className="grid md:grid-cols-2 gap-4">
                                                    <textarea
                                                        className="input text-sm h-20" placeholder="Treatment details..."
                                                        value={entry.treatment} onChange={e => {
                                                            const nh = [...form.medicalHistory]; nh[idx].treatment = e.target.value; setForm({ ...form, medicalHistory: nh })
                                                        }}
                                                    />
                                                    <textarea
                                                        className="input text-sm h-20" placeholder="Notes..."
                                                        value={entry.notes} onChange={e => {
                                                            const nh = [...form.medicalHistory]; nh[idx].notes = e.target.value; setForm({ ...form, medicalHistory: nh })
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'reports' && (
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-fade-in">
                                <ReportsManager patient={patient} onUploaded={load} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PageContainer>
    )
}

function ReportsManager({ patient, onUploaded }) {
    const [files, setFiles] = useState([])
    const [uploading, setUploading] = useState(false)
    const [list, setList] = useState([])

    useEffect(() => { loadList() }, [])
    const loadList = async () => { try { setList(await listMyReports()) } catch (e) { } }

    const handleUpload = async () => {
        if (!files.length) return
        setUploading(true)
        const fd = new FormData()
        files.forEach(f => fd.append('reports', f))
        try {
            await uploadMyReportsMulti(fd)
            toast.success('Reports uploaded')
            setFiles([])
            onUploaded()
            loadList()
        } catch (e) { toast.error('Upload failed') }
        finally { setUploading(false) }
    }

    return (
        <div className="space-y-6">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-indigo-300 transition-colors bg-slate-50/50">
                <input type="file" multiple className="hidden" id="report-upload" onChange={e => setFiles(Array.from(e.target.files || []))} />
                <label htmlFor="report-upload" className="cursor-pointer block">
                    <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Upload size={24} />
                    </div>
                    <h4 className="font-bold text-slate-700">Click to upload reports</h4>
                    <p className="text-sm text-slate-500 mt-1">PDF, JPG, PNG (Max 1GB)</p>
                </label>
                {files.length > 0 && (
                    <div className="mt-4 flex flex-col items-center gap-2">
                        <div className="text-sm font-medium text-emerald-600">{files.length} files selected</div>
                        <div className="flex gap-2">
                            <button onClick={handleUpload} disabled={uploading} className="btn btn-primary btn-sm">
                                {uploading ? 'Uploading...' : 'Confirm Upload'}
                            </button>
                            <button onClick={() => setFiles([])} className="btn btn-outline btn-sm">Clear</button>
                        </div>
                    </div>
                )}
            </div>

            <div>
                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <FileText size={18} className="text-slate-400" /> Uploaded Documents
                </h4>
                {list.length === 0 ? (
                    <div className="text-sm text-slate-500 italic pl-1">No files uploaded yet.</div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-3">
                        {list.map(r => (
                            <a key={r._id} href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:shadow-sm transition-all group bg-white">
                                <div className="p-2 bg-slate-50 rounded-lg text-slate-500 group-hover:text-indigo-600 transition-colors">
                                    <FileText size={20} />
                                </div>
                                <div className="flex-1 truncate">
                                    <div className="font-medium text-slate-700 truncate">{r.title || r.originalName}</div>
                                    <div className="text-xs text-slate-400">{new Date(r.uploadedAt).toLocaleDateString()}</div>
                                </div>
                                <Download size={16} className="text-slate-300 group-hover:text-indigo-600" />
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function Trash2(props) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
}

