import { useProfileRender } from '../../utils/profiler';
import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { authFetch } from '../../services/api'
import { Save, Settings, Globe, Palette, Mail, Database } from 'lucide-react'
import { motion } from 'framer-motion'

export default function SettingsPage() {
    useProfileRender('SettingsPage', true);
    const { token } = useAuth()
    const [settings, setSettings] = useState([])
    const [form, setForm] = useState({})
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('branding')

    useEffect(() => { load() }, [])

    async function load() {
        try {
            const data = await authFetch(`/api/settings`)
            setSettings(data)
            const f = {}
            data.forEach(s => f[s.key] = s.value)
            setForm(f)
        } catch (e) { console.error(e) }
    }

    function onChange(key, val) {
        setForm(prev => ({ ...prev, [key]: val }))
    }

    async function save() {
        setLoading(true)
        try {
            await authFetch(`/api/settings/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            })
            alert('Settings saved successfully!')
        } catch (e) {
            alert('Error: ' + e.message)
        } finally { setLoading(false) }
    }

    const knownSettings = [
        { key: 'COMPANY_NAME', label: 'Company Name', group: 'branding', default: 'HospitechVerse', icon: Globe },
        { key: 'COMPANY_LOGO', label: 'Logo URL', group: 'branding', default: '', icon: Settings },
        { key: 'THEME_COLOR', label: 'Theme Color', group: 'branding', default: '#3b82f6', type: 'color', icon: Palette },
        { key: 'SUPPORT_EMAIL', label: 'Support Contact Email', group: 'general', default: '', icon: Mail },
        { key: 'ENABLED_FEATURES', label: 'Global Features Config (JSON)', group: 'system', default: '[]', type: 'textarea', icon: Database }
    ]

    const displayList = [...knownSettings]
    settings.forEach(s => {
        if (!displayList.find(d => d.key === s.key)) {
            displayList.push({ key: s.key, label: s.label || s.key, group: s.group || 'misc', type: 'string', icon: Settings })
        }
    })

    const groups = ['branding', 'general', 'system', 'misc'].filter(g => displayList.some(s => s.group === g))

    return (
        <div className="max-w-4xl mx-auto p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Platform Settings</h1>
                    <p className="text-slate-500">Configure global application parameters.</p>
                </div>
                <button
                    onClick={save}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 shadow-md transition-all active:scale-95 disabled:opacity-70"
                >
                    <Save size={18} />
                    {loading ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Navigation */}
                <div className="w-full md:w-64 flex-none space-y-1">
                    {groups.map(g => (
                        <button
                            key={g}
                            onClick={() => setActiveTab(g)}
                            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all capitalize flex items-center justify-between ${activeTab === g ? 'bg-white text-indigo-600 shadow-sm border border-slate-100 ring-1 ring-indigo-500/10' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                        >
                            {g}
                            {activeTab === g && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600"></div>}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 space-y-6">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
                            <h2 className="text-xl font-bold text-slate-800 capitalize mb-6 pb-4 border-b border-slate-100">{activeTab} Settings</h2>
                            <div className="space-y-6">
                                {displayList.filter(s => s.group === activeTab).map(s => {
                                    const Icon = s.icon || Settings
                                    return (
                                        <div key={s.key} className="space-y-2">
                                            <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                                                <div className="p-1 bg-slate-100 rounded text-slate-500"><Icon size={14} /></div>
                                                {s.label}
                                            </label>
                                            <div className="relative">
                                                {s.type === 'textarea' ? (
                                                    <textarea
                                                        value={form[s.key] !== undefined ? form[s.key] : (s.default || '')}
                                                        onChange={e => onChange(s.key, e.target.value)}
                                                        className="w-full p-4 border border-slate-200 rounded-xl font-mono text-sm h-32 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white resize-y"
                                                        placeholder={`Enter ${s.label.toLowerCase()}...`}
                                                    />
                                                ) : s.type === 'color' ? (
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="color"
                                                            value={form[s.key] !== undefined ? form[s.key] : (s.default || '#000000')}
                                                            onChange={e => onChange(s.key, e.target.value)}
                                                            className="h-12 w-24 p-1 border border-slate-200 rounded-lg cursor-pointer"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={form[s.key] !== undefined ? form[s.key] : (s.default || '')}
                                                            onChange={e => onChange(s.key, e.target.value)}
                                                            className="flex-1 p-3 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                                        />
                                                    </div>
                                                ) : (
                                                    <input
                                                        type={s.type || 'text'}
                                                        value={form[s.key] !== undefined ? form[s.key] : (s.default || '')}
                                                        onChange={e => onChange(s.key, e.target.value)}
                                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                                                        placeholder={`Enter ${s.label.toLowerCase()}...`}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                                {displayList.filter(s => s.group === activeTab).length === 0 && (
                                    <div className="text-center py-8 text-slate-400 italic">No settings found for this group.</div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
