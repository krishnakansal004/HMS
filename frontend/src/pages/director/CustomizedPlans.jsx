import { useProfileRender } from '../../utils/profiler';
import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { authFetch } from '../../services/api'

const NAV = [
    { to: '/', label: 'Dashboard', key: 'dashboard', roles: ['admin', 'doctor', 'patient'] },
    { to: '/inventory', label: 'Inventory', key: 'inventory', roles: ['admin'] },
    { to: '/billing', label: 'Billing', key: 'billing', roles: ['admin'] },
    { to: '/bill-manager', label: 'Bill Manager', key: 'billManager', roles: ['admin'] },
    { to: '/purchases', label: 'Purchases', key: 'purchases', roles: ['admin'] },
    { to: '/reports', label: 'Reports', key: 'reports', roles: ['admin'] },
    { to: '/appointments', label: 'Appointments', key: 'appointments', roles: ['admin', 'doctor'] },
    { to: '/doctor-patients', label: 'My Patients', key: 'doctorPatients', roles: ['doctor'] },
    { to: '/doctor-prescriptions', label: 'Prescriptions', key: 'doctorPrescriptions', roles: ['doctor'] },
    { to: '/virtual-room', label: 'Virtual Room', key: 'virtualRoom', roles: ['admin', 'doctor', 'patient'] },
    { to: '/my-appointments', label: 'My Appointments', key: 'myAppointments', roles: ['patient'] },
    { to: '/my-billing', label: 'Billing', key: 'myBilling', roles: ['patient'] },
    { to: '/my-receipts', label: 'Receipts', key: 'myReceipts', roles: ['patient'] },
    { to: '/prescriptions', label: 'Prescriptions', key: 'prescriptions', roles: ['patient'] },
    { to: '/availability', label: 'Availability', key: 'availability', roles: ['doctor'] },
    { to: '/doctor-attendance', label: 'Attendance', key: 'doctorAttendance', roles: ['doctor'] },
    { to: '/doctors', label: 'Doctors', key: 'doctors', roles: ['admin'] },
    { to: '/doctor-approvals', label: 'Doctor Approvals', key: 'doctorApprovals', roles: ['admin'] },
    { to: '/staff', label: 'Staff', key: 'staff', roles: ['admin'] },
    { to: '/wards', label: 'Wards', key: 'wards', roles: ['admin'] },
    { to: '/wards-live', label: 'Live Wards', key: 'wardsLive', roles: ['admin'] },
    { to: '/patients', label: 'Patients', key: 'patients', roles: ['admin', 'doctor'] },
    { to: '/shifts', label: 'Shifts', key: 'shifts', roles: ['admin'] },
    { to: '/attendance', label: 'Attendance', key: 'attendance', roles: ['admin'] },
    { to: '/doctor-attendance-board', label: 'Doctor Attendance', key: 'doctorAttendanceBoard', roles: ['admin'] },
    { to: '/leaves', label: 'Leaves', key: 'leaves', roles: ['admin'] },
    { to: '/prescription-templates', label: 'Templates', key: 'prescriptionTemplates', roles: ['doctor'] },
    { to: '/queries', label: 'Queries', key: 'queries', roles: ['admin'] },
]

export default function CustomizedPlans() {
    useProfileRender('CustomizedPlans', true);
    const { token } = useAuth()
    const [showForm, setShowForm] = useState(false)
    const [editingPlanId, setEditingPlanId] = useState(null)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [roleFeatures, setRoleFeatures] = useState({ admin: [], doctor: [], patient: [] })
    const [prices, setPrices] = useState({ month: '', threeMonths: '', year: '', fiveYears: '' })
    const [limits, setLimits] = useState({ admins: '', subAdmins: '', doctors: '', patients: '' })
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)
    const [plans, setPlans] = useState([])

    useEffect(() => { loadPlans() }, [])

    async function loadPlans() {
        try {
            const data = await authFetch(`/api/plans/all`)
            // show only non-public (customized) plans
            setPlans((data.plans || []).filter(p => p.public === false))
        } catch (e) {
            console.error(e)
        }
    }

    function toggleRoleFeature(role, key) {
        setRoleFeatures(prev => {
            const next = { ...prev }
            const arr = new Set(next[role] || [])
            if (arr.has(key)) arr.delete(key)
            else arr.add(key)
            next[role] = Array.from(arr)
            return next
        })
    }

    function onPriceChange(key, value) {
        const sanitized = value.replace(/[^0-9.]/g, '')
        setPrices(prev => ({ ...prev, [key]: sanitized }))
    }

    async function onSubmit(e) {
        e.preventDefault()
        setError(null)
        if (!name) return setError('Plan name is required')
        setLoading(true)
        try {
            const payload = {
                name,
                description,
                roleFeatures: roleFeatures,
                limits: {
                    admins: limits.admins ? Number(limits.admins) : undefined,
                    subAdmins: limits.subAdmins ? Number(limits.subAdmins) : undefined,
                    doctors: limits.doctors ? Number(limits.doctors) : undefined,
                    patients: limits.patients ? Number(limits.patients) : undefined,
                },
                prices: {
                    month: Math.round((Number(prices.month) || 0) * 100),
                    threeMonths: Math.round((Number(prices.threeMonths) || 0) * 100),
                    year: Math.round((Number(prices.year) || 0) * 100),
                    fiveYears: Math.round((Number(prices.fiveYears) || 0) * 100),
                },
                public: false
            }
            let data
            if (editingPlanId) {
                data = await authFetch(`/api/plans/${editingPlanId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                await loadPlans()
            } else {
                data = await authFetch(`/api/plans`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                await loadPlans()
            }
            setShowForm(false)
            setEditingPlanId(null)
            setName('')
            setDescription('')
            setRoleFeatures({ admin: [], doctor: [], patient: [] })
            setPrices({ month: '', threeMonths: '', year: '', fiveYears: '' })
        } catch (e) {
            console.error(e)
            setError(e.message || 'Server error')
        } finally { setLoading(false) }
    }

    function onEditClick(plan) {
        setEditingPlanId(plan._id)
        setName(plan.name || '')
        setDescription(plan.description || '')
        setRoleFeatures(plan.roleFeatures || { admin: [], doctor: [], patient: [] })
        setPrices({
            month: (plan.prices?.month ? (plan.prices.month / 100).toString() : ''),
            threeMonths: (plan.prices?.threeMonths ? (plan.prices.threeMonths / 100).toString() : ''),
            year: (plan.prices?.year ? (plan.prices.year / 100).toString() : ''),
            fiveYears: (plan.prices?.fiveYears ? (plan.prices.fiveYears / 100).toString() : ''),
        })
        setLimits({
            admins: plan.limits?.admins ? String(plan.limits.admins) : '',
            subAdmins: plan.limits?.subAdmins ? String(plan.limits.subAdmins) : '',
            doctors: plan.limits?.doctors ? String(plan.limits.doctors) : '',
            patients: plan.limits?.patients ? String(plan.limits.patients) : '',
        })
        setShowForm(true)
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
    }

    async function deletePlan(id) {
        if (!confirm('Delete this plan? This action cannot be undone. Continue?')) return
        try {
            await authFetch(`/api/plans/${id}`, { method: 'DELETE' })
            await loadPlans()
        } catch (e) {
            alert('Delete failed: ' + (e.message || e))
        }
    }

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mt-6">
                <h1 className="text-2xl font-semibold mb-4">Director — Customized Plans</h1>
                <button onClick={() => setShowForm(s => !s)} className="px-3 py-2 bg-green-600 text-white rounded">{showForm ? 'Close' : 'Add Customized Plan'}</button>
            </div>
            {showForm && (
                <form onSubmit={onSubmit} className="mb-6 border rounded p-4 bg-white">
                    {error && <div className="text-red-600 mb-2">{error}</div>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium">Plan name</label>
                            <input value={name} onChange={e => setName(e.target.value)} className="mt-1 p-2 border rounded w-full" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Short description</label>
                            <input value={description} onChange={e => setDescription(e.target.value)} className="mt-1 p-2 border rounded w-full" />
                        </div>
                    </div>
                    <div className="mt-3">
                        <label className="block text-sm font-medium mb-2">Role-specific Features</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {['admin', 'doctor', 'patient'].map(role => (
                                <div key={role} className="border p-2 rounded">
                                    <div className="font-medium mb-2">{role.charAt(0).toUpperCase() + role.slice(1)}</div>
                                    <div className="space-y-2">
                                        {NAV.filter(n => n.roles.includes(role)).map(item => (
                                            <label key={item.key} className="flex items-center gap-2">
                                                <input type="checkbox" checked={(roleFeatures[role] || []).includes(item.key)} onChange={() => toggleRoleFeature(role, item.key)} />
                                                <span className="text-sm">{item.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-sm font-medium">Per month price</label>
                            <input value={prices.month} onChange={e => onPriceChange('month', e.target.value)} placeholder="0.00" className="mt-1 p-2 border rounded w-full" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">3 months price</label>
                            <input value={prices.threeMonths} onChange={e => onPriceChange('threeMonths', e.target.value)} placeholder="0.00" className="mt-1 p-2 border rounded w-full" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">1 year price</label>
                            <input value={prices.year} onChange={e => onPriceChange('year', e.target.value)} placeholder="0.00" className="mt-1 p-2 border rounded w-full" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">5 years price</label>
                            <input value={prices.fiveYears} onChange={e => onPriceChange('fiveYears', e.target.value)} placeholder="0.00" className="mt-1 p-2 border rounded w-full" />
                        </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-sm font-medium">Admins limit</label>
                            <input value={limits.admins} onChange={e => setLimits(prev => ({ ...prev, admins: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="e.g. 2" className="mt-1 p-2 border rounded w-full" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Sub-admins limit</label>
                            <input value={limits.subAdmins} onChange={e => setLimits(prev => ({ ...prev, subAdmins: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="e.g. 5" className="mt-1 p-2 border rounded w-full" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Doctors limit</label>
                            <input value={limits.doctors} onChange={e => setLimits(prev => ({ ...prev, doctors: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="e.g. 10" className="mt-1 p-2 border rounded w-full" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Patients limit</label>
                            <input value={limits.patients} onChange={e => setLimits(prev => ({ ...prev, patients: e.target.value.replace(/[^0-9]/g, '') }))} placeholder="e.g. 1000" className="mt-1 p-2 border rounded w-full" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <button disabled={loading} type="submit" className="px-3 py-2 bg-blue-600 text-white rounded">{loading ? 'Saving...' : 'Create Customized Plan'}</button>
                    </div>
                </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map((p, idx) => (
                    <div key={p._id} className={`rounded-lg p-4 shadow-md bg-white`}>
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="font-semibold text-lg">{p.name}</div>
                                <div className="text-sm opacity-90">{p.description}</div>
                            </div>
                            <div className="space-y-1 text-sm text-right opacity-95">
                                <div>Month: {(p.prices?.month ?? 0) / 100}</div>
                                <div>3 mo: {(p.prices?.threeMonths ?? 0) / 100}</div>
                                <div>1 yr: {(p.prices?.year ?? 0) / 100}</div>
                                <div>5 yr: {(p.prices?.fiveYears ?? 0) / 100}</div>
                            </div>
                        </div>
                        <div className="mt-3 text-sm opacity-95">
                            <div className="mb-2">
                                <strong>Limits:</strong>
                                <div className="mt-1 text-sm">
                                    <div><strong>Admins:</strong> {typeof p.limits?.admins !== 'undefined' ? p.limits.admins : 0}</div>
                                    <div><strong>Sub-admins:</strong> {typeof p.limits?.subAdmins !== 'undefined' ? p.limits.subAdmins : 0}</div>
                                    <div><strong>Doctors:</strong> {typeof p.limits?.doctors !== 'undefined' ? p.limits.doctors : 0}</div>
                                    <div><strong>Patients:</strong> {typeof p.limits?.patients !== 'undefined' ? p.limits.patients : 0}</div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 flex space-x-2">
                            <button onClick={() => onEditClick(p)} className="px-2 py-1 rounded border bg-white text-black">Edit</button>
                            <button onClick={() => deletePlan(p._id)} className="px-2 py-1 rounded border bg-red-600 text-white">Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
