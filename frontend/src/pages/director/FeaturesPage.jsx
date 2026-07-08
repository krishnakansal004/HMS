import { useProfileRender } from '../../utils/profiler';
import React, { useState, useEffect } from 'react'
import { LayoutDashboard, Package, CreditCard, ShoppingBag, BarChart2, Stethoscope, User, CalendarClock, Users, Clock, FileText, MessageSquare, Check, Save } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'react-toastify' // Assuming react-toastify is used elsewhere, otherwise we'll use native alert or a custom toast

const NAV = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'doctor', 'patient'] },
    { to: '/inventory', label: 'Inventory', icon: Package, roles: ['admin'] },
    { to: '/billing', label: 'Billing', icon: CreditCard, roles: ['admin'] },
    { to: '/bill-manager', label: 'Bill Manager', icon: FileText, roles: ['admin'] },
    { to: '/purchases', label: 'Purchases', icon: ShoppingBag, roles: ['admin'] },
    { to: '/reports', label: 'Reports', icon: BarChart2, roles: ['admin'] },
    { to: '/appointments', label: 'Appointments', icon: CalendarClock, roles: ['admin', 'doctor'] },
    { to: '/doctor-patients', label: 'My Patients', icon: Users, roles: ['doctor'] },
    { to: '/doctor-prescriptions', label: 'Prescriptions', icon: FileText, roles: ['doctor'] },
    { to: '/virtual-room', label: 'Virtual Room', icon: CalendarClock, roles: ['admin', 'doctor', 'patient'] },
    { to: '/my-appointments', label: 'My Appointments', icon: CalendarClock, roles: ['patient'] },
    { to: '/my-billing', label: 'Billing', icon: CreditCard, roles: ['patient'] },
    { to: '/my-receipts', label: 'Receipts', icon: FileText, roles: ['patient'] },
    { to: '/prescriptions', label: 'Prescriptions', icon: FileText, roles: ['patient'] },
    { to: '/availability', label: 'Availability', icon: BarChart2, roles: ['doctor'] },
    { to: '/doctor-attendance', label: 'Attendance', icon: Clock, roles: ['doctor'] },
    { to: '/doctors', label: 'Doctors', icon: Stethoscope, roles: ['admin'] },
    { to: '/doctor-approvals', label: 'Doctor Approvals', icon: Stethoscope, roles: ['admin'] },
    { to: '/staff', label: 'Staff', icon: User, roles: ['admin'] },
    { to: '/wards', label: 'Wards', icon: User, roles: ['admin'] },
    { to: '/patients', label: 'Patients', icon: Users, roles: ['admin', 'doctor'] },
    { to: '/shifts', label: 'Shifts', icon: Clock, roles: ['admin'] },
    { to: '/attendance', label: 'Attendance', icon: Clock, roles: ['admin'] },
    { to: '/doctor-attendance-board', label: 'Doctor Attendance', icon: Clock, roles: ['admin'] },
    { to: '/leaves', label: 'Leaves', icon: Clock, roles: ['admin'] },
    { to: '/prescription-templates', label: 'Templates', icon: Package, roles: ['doctor'] },
    { to: '/queries', label: 'Queries', icon: MessageSquare, roles: ['admin'] },
]

function RoleColumn({ role, items, selected, onToggle, onSelectAll, onClear }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            <div className={`px-4 py-3 border-b border-slate-100 flex justify-between items-center ${role === 'admin' ? 'bg-indigo-50/50' : role === 'doctor' ? 'bg-emerald-50/50' : 'bg-sky-50/50'
                }`}>
                <div className="font-bold text-slate-800 capitalize flex items-center gap-2">
                    {role} Features
                    <span className="text-xs font-normal text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">{items.length}</span>
                </div>
                <div className="flex gap-1.5">
                    <button type="button" onClick={onSelectAll} className="text-xs px-2 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors text-slate-600 font-medium">All</button>
                    <button type="button" onClick={onClear} className="text-xs px-2 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors text-slate-600 font-medium">None</button>
                </div>
            </div>
            <div className="p-2 space-y-1 overflow-y-auto custom-scrollbar flex-1">
                {items.map(it => {
                    const Icon = it.icon
                    const key = `${role}:${it.to}`
                    const isActive = !!selected[key]
                    return (
                        <label key={key} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${isActive ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isActive ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                                {isActive && <Check size={14} className="text-white" />}
                            </div>
                            <input type="checkbox" checked={isActive} onChange={() => onToggle(key)} className="hidden" />
                            <Icon size={18} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                            <span className="text-sm font-medium">{it.label}</span>
                        </label>
                    )
                })}
            </div>
        </div>
    )
}

export default function FeaturesPage() {
    useProfileRender('FeaturesPage', true);
    const [adminItems, setAdminItems] = useState([])
    const [doctorItems, setDoctorItems] = useState([])
    const [patientItems, setPatientItems] = useState([])
    const [selected, setSelected] = useState(() => {
        try { return JSON.parse(localStorage.getItem('director:selectedFeatures') || '{}') } catch (e) { return {} }
    })

    useEffect(() => {
        setAdminItems(NAV.filter(n => n.roles.includes('admin')))
        setDoctorItems(NAV.filter(n => n.roles.includes('doctor')))
        setPatientItems(NAV.filter(n => n.roles.includes('patient')))
    }, [])

    function toggle(key) {
        setSelected(prev => {
            const next = { ...prev }
            if (next[key]) delete next[key]
            else next[key] = true
            return next
        })
    }

    function selectAllFor(items, role) {
        setSelected(prev => {
            const next = { ...prev }
            items.forEach(it => { next[`${role}:${it.to}`] = true })
            return next
        })
    }

    function clearFor(items, role) {
        setSelected(prev => {
            const next = { ...prev }
            items.forEach(it => { delete next[`${role}:${it.to}`] })
            return next
        })
    }

    function onSave() {
        localStorage.setItem('director:selectedFeatures', JSON.stringify(selected))
        alert('Feature preferences saved locally!')
    }

    return (
        <div className="p-10 space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center flex-none">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Feature Management</h1>
                    <p className="text-slate-500">Configure global sidebar defaults for roles.</p>
                </div>
                <button onClick={onSave} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 shadow-md transition-all active:scale-95">
                    <Save size={18} /> Save Configuration
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0 pb-6">
                <RoleColumn role="admin" items={adminItems} selected={selected} onToggle={toggle} onSelectAll={() => selectAllFor(adminItems, 'admin')} onClear={() => clearFor(adminItems, 'admin')} />
                <RoleColumn role="doctor" items={doctorItems} selected={selected} onToggle={toggle} onSelectAll={() => selectAllFor(doctorItems, 'doctor')} onClear={() => clearFor(doctorItems, 'doctor')} />
                <RoleColumn role="patient" items={patientItems} selected={selected} onToggle={toggle} onSelectAll={() => selectAllFor(patientItems, 'patient')} onClear={() => clearFor(patientItems, 'patient')} />
            </div>
        </div>
    )
}
