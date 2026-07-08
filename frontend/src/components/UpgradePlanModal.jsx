import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function UpgradePlanModal({ open, onClose, tenant, plans = [], apiBase }) {
    const { token } = useAuth()
    const [selected, setSelected] = useState(0)
    const [period, setPeriod] = useState('monthly')
    const [amount, setAmount] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [accessCode, setAccessCode] = useState('')
    const [accessValidated, setAccessValidated] = useState(false)

    useEffect(() => {
        if (!open) return
        setSelected(0)
        setPeriod('monthly')
        computeAmount('monthly', plans && plans[0])
    }, [open, plans])

    function computeAmount(p, plan) {
        try {
            setError(null)
            if (!plan) return setAmount(null)
            const prices = plan.prices || {}
            let cents = 0
            switch ((p || '').toLowerCase()) {
                case '3months': cents = prices.threeMonths || prices['3months'] || 0; break
                case 'yearly': cents = prices.year || prices.yearly || 0; break
                case '5years': cents = prices.fiveYears || 0; break
                default: cents = prices.month || prices.monthly || 0; break
            }
            if (!cents) {
                const base = prices.month || prices.monthly || 0
                if (base) {
                    if (p === '3months') cents = base * 3
                    else if (p === 'yearly') cents = base * 12
                    else if (p === '5years') cents = base * 60
                    else cents = base
                }
            }
            setAmount(cents ? (cents / 100).toFixed(2) : null)
        } catch (e) { setError('Failed to compute amount') }
    }

    useEffect(() => {
        const plan = plans && plans[selected]
        computeAmount(period, plan)
        // reset access code validation whenever plan selection changes
        setAccessCode('')
        setAccessValidated(false)
    }, [selected, period, plans])

    async function proceed() {
        if (!tenant) return
        setLoading(true)
        setError(null)
        try {
            const plan = plans && plans[selected]
            if (!plan) throw new Error('No plan selected')
            // If plan is customized require access code
            if (plan.customized) {
                if (!accessCode) throw new Error('Access code required for customized plan')
            }
            const body = { tenantId: tenant.id || tenant._id, planId: plan._id || plan.id, period, accessCode: accessCode || undefined }
            const res = await fetch(`${apiBase || ''}/api/plan-requests/upgrade`, { method: 'POST', headers: { Authorization: token ? `Bearer ${token}` : '', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            if (!res.ok) {
                const j = await res.json().catch(() => ({ error: 'Upgrade failed' }))
                throw new Error(j && j.error ? j.error : 'Upgrade failed')
            }
            const data = await res.json()
            if (data && data.paymentShortUrl) window.open(data.paymentShortUrl, '_blank')
            const linkId = data && (data.paymentLinkId || (data.paymentRequest && data.paymentRequest.razorpay && data.paymentRequest.razorpay.linkId))
            if (linkId) {
                const checkUrl = `${apiBase || ''}/api/payments/razorpay/check-public/${linkId}`
                let paid = false
                const start = Date.now()
                while (Date.now() - start < 2 * 60 * 1000) {
                    // eslint-disable-next-line no-await-in-loop
                    await new Promise(r => setTimeout(r, 4000))
                    try {
                        // eslint-disable-next-line no-await-in-loop
                        const ch = await fetch(checkUrl)
                        if (!ch.ok) continue
                        const chj = await ch.json()
                        if (chj && chj.paid) { paid = true; break }
                    } catch (e) { }
                }
                if (paid) {
                    alert('Payment completed — tenant should be upgraded shortly.')
                    onClose(true)
                    return
                }
                alert('Payment not detected yet. Webhook may process later.')
                onClose(true)
                return
            }
            alert('Payment link created. Complete payment in the opened tab. Receipt will arrive when processed.')
            onClose(true)
        } catch (e) {
            console.error(e)
            setError(e.message || 'Upgrade failed')
        } finally { setLoading(false) }
    }

    if (!open) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow p-6 w-full max-w-lg">
                <h2 className="text-lg font-semibold mb-2">Upgrade Tenant Plan</h2>
                <div className="mb-3 text-sm text-gray-700">Tenant: <strong>{tenant?.name || tenant?.company || '-'}</strong></div>
                <div className="mb-3">
                    <label className="block text-sm mb-1">Select Plan</label>
                    <select value={selected} onChange={e => setSelected(Number(e.target.value))} className="w-full border rounded px-2 py-1">
                        {(plans || []).map((p, i) => <option key={p._id || p.id || i} value={i}>{p.name} {p.customized ? '(custom)' : ''}</option>)}
                    </select>
                </div>
                <div className="mb-3">
                    <label className="block text-sm mb-1">Select period</label>
                    <select value={period} onChange={e => setPeriod(e.target.value)} className="w-full border rounded px-2 py-1">
                        <option value="monthly">Monthly</option>
                        <option value="3months">3 Months</option>
                        <option value="yearly">Yearly</option>
                        <option value="5years">5 Years</option>
                    </select>
                </div>
                {plans && plans[selected] && plans[selected].customized && (
                    <div className="mb-3">
                        <label className="block text-sm mb-1">Access code (required for customized plans)</label>
                        <div className="flex gap-2">
                            <input value={accessCode} onChange={e => { setAccessCode(e.target.value); setAccessValidated(false) }} className="flex-1 px-3 py-2 border rounded" placeholder="Access code" />
                            <button onClick={async () => {
                                setError(null)
                                try {
                                    const plan = plans && plans[selected]
                                    if (!plan) throw new Error('No plan selected')
                                    const res = await fetch(`${apiBase || ''}/api/plans/validate-access`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ planId: plan._id || plan.id, code: accessCode }) })
                                    if (!res.ok) {
                                        const j = await res.json().catch(() => ({ error: 'Invalid code' }))
                                        throw new Error(j && j.error ? j.error : 'Invalid code')
                                    }
                                    setAccessValidated(true)
                                } catch (e) { setError(e.message || 'Invalid access code') }
                            }} className="px-3 py-1 bg-gray-200 rounded">Validate</button>
                        </div>
                        {accessValidated && <div className="text-xs text-green-600 mt-1">Access code validated</div>}
                    </div>
                )}
                <div className="mb-4">Amount: <strong>{amount ? `₹${amount}` : '—'}</strong></div>
                {error && <div className="text-red-600 mb-2">{error}</div>}
                <div className="flex justify-end gap-2">
                    <button onClick={() => onClose(false)} className="px-3 py-1 border rounded">Cancel</button>
                    <button onClick={proceed} disabled={loading || !amount || (plans && plans[selected] && plans[selected].customized && !accessValidated)} className={`px-3 py-1 rounded text-white ${loading || !amount || (plans && plans[selected] && plans[selected].customized && !accessValidated) ? 'bg-gray-400' : 'bg-blue-600'}`}>{loading ? 'Processing...' : 'Proceed to Payment'}</button>
                </div>
            </div>
        </div>
    )
}
