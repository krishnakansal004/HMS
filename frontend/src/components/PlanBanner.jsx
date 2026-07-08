import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getMyTenant } from '../services/api'
import { useNavigate } from 'react-router-dom'
import TenantRenewModal from './TenantRenewModal'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export default function PlanBanner() {
    const { user } = useAuth()
    const navigate = useNavigate()

    const { data } = useQuery({
        queryKey: ['tenant'],
        queryFn: getMyTenant,
        enabled: !!user
    })
    const tenant = data?.tenant || null

    if (!user || !tenant) return null

    // Determine suspended/expired
    const status = tenant.status || (tenant.subscriptionEnd && (new Date(tenant.subscriptionEnd) < new Date()) ? 'expired' : 'active')
    const limits = (tenant.plan && tenant.plan.limits) ? tenant.plan.limits : {}
    const usage = tenant.usage || {}
    const isPlanActive = typeof tenant.isPlanActive !== 'undefined' ? tenant.isPlanActive : (tenant.subscriptionEnd ? (new Date() < new Date(tenant.subscriptionEnd)) : true)

    // find first resource at/over limit
    const over = Object.keys(limits).find(k => typeof limits[k] === 'number' && (usage[k] || 0) >= limits[k])

    if (status !== 'active') {
        return (
            <RenewWrapper tenant={tenant} status={status} />
        )
    }

    // Show quota-warning only when plan is not active (i.e. after expiry)
    if (over && !isPlanActive) {
        return (
            <div className="w-full bg-yellow-50 border border-yellow-200 text-yellow-900 p-2 text-sm flex items-center justify-between">
                <div>
                    <strong>Limit reached:</strong> {over} usage has reached the plan limit. Some actions may be disabled.
                </div>
                <div>
                    <button onClick={() => navigate('/director/queryforplan')} className="px-3 py-1 bg-yellow-700 text-white rounded text-sm">Upgrade</button>
                </div>
            </div>
        )
    }

    return null
}

function RenewWrapper({ tenant, status }) {
    const [open, setOpen] = React.useState(false)
    const queryClient = useQueryClient()
    return (
        <div className="w-full bg-red-50 border border-red-200 text-red-800 p-2 text-sm flex items-center justify-between">
            <div>
                <strong>Subscription {status === 'expired' ? 'Expired' : 'Suspended'}</strong>: Tenant access is restricted. Please renew your plan or contact support.
            </div>
            <div>
                <button onClick={() => setOpen(true)} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Renew Plan</button>
            </div>
            <TenantRenewModal open={open} onClose={(done) => { setOpen(false); if (done) queryClient.invalidateQueries({ queryKey: ['tenant'] }) }} tenant={tenant} />
        </div>
    )
}
