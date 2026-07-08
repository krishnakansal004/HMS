import { useProfileRender } from '../utils/profiler';
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { Pencil, Trash2, Plus, Search, Filter, X } from 'lucide-react'
import { createMedicine, deleteMedicine, listMedicines, listSuppliers, updateMedicine, createSupplier, getMyTenant } from '../services/api'
import { toast } from 'react-toastify'
import { motion, AnimatePresence } from 'framer-motion'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'
import VirtualizedTable from '../components/common/VirtualizedTable'

function MedicineForm({ initial, onClose, onSaved, suppliers = [] }) {
    const queryClient = useQueryClient()
    const [form, setForm] = useState(() => {
        if (!initial) return {
            name: '', batchNumber: '', expiryDate: '', supplier: '', quantity: 0, reorderLevel: 0,
            gstRate: 0, purchasePrice: 0, sellingPrice: 0,
        }
        return {
            ...initial,
            supplier: initial.supplier && typeof initial.supplier === 'object' ? initial.supplier._id : (initial.supplier || '')
        }
    })
    const [addingSupplier, setAddingSupplier] = useState(false)
    const [newSupplier, setNewSupplier] = useState({ name: '', contactEmail: '', contactPhone: '' })
    const isEdit = !!initial?._id

    // fetch tenant to determine plan limits for suppliers/medicines using TanStack Query
    const { data: tenantData } = useQuery({
        queryKey: ['tenant'],
        queryFn: getMyTenant
    })
    const tenant = tenantData?.tenant || null
    const canCreateSupplier = useMemo(() => {
        if (!tenant) return true
        if (tenant.plan?.limits?.suppliers == null) return true
        return (tenant.usage?.suppliers || 0) < tenant.plan.limits.suppliers
    }, [tenant])
    const canCreateMedicine = useMemo(() => {
        if (!tenant) return true
        if (tenant.plan?.limits?.medicines == null) return true
        return (tenant.usage?.medicines || 0) < tenant.plan.limits.medicines
    }, [tenant])

    const saveSupplier = async () => {
        const s = await createSupplier(newSupplier)
        // Update TanStack Query cache directly
        queryClient.setQueryData(['suppliers'], (old) => [...(old || []), s])
        setForm((f) => ({ ...f, supplier: s._id }))
        setAddingSupplier(false)
        setNewSupplier({ name: '', contactEmail: '', contactPhone: '' })
    }

    const createMedMutation = useMutation({
        mutationFn: createMedicine,
        onMutate: async (newMed) => {
            await queryClient.cancelQueries({ queryKey: ['medicines'] })
            const previousMedicines = queryClient.getQueryData(['medicines', 1, ''])

            queryClient.setQueryData(['medicines', 1, ''], old => {
                const arr = Array.isArray(old) ? old : []
                return [...arr, { _id: 'temp-id-' + Date.now(), ...newMed }]
            })

            return { previousMedicines }
        },
        onError: (err, newMed, context) => {
            if (context?.previousMedicines) {
                queryClient.setQueryData(['medicines', 1, ''], context.previousMedicines)
            }
            toast.error(err.message || 'Failed to create medicine')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['medicines'] })
        }
    })

    const updateMedMutation = useMutation({
        mutationFn: ({ id, payload }) => updateMedicine(id, payload),
        onMutate: async ({ id, payload }) => {
            await queryClient.cancelQueries({ queryKey: ['medicines'] })
            const queries = queryClient.getQueriesData({ queryKey: ['medicines'] })

            queries.forEach(([queryKey, oldData]) => {
                if (Array.isArray(oldData)) {
                    queryClient.setQueryData(queryKey, oldData.map(m => {
                        if (m._id === id || m.id === id) {
                            return { ...m, ...payload }
                        }
                        return m
                    }))
                }
            })
        },
        onError: (err, variables, context) => {
            toast.error(err.message || 'Failed to update medicine')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['medicines'] })
        }
    })

    const onSubmit = async (e) => {
        e.preventDefault()
        const payload = { ...form }
        if (typeof payload.quantity === 'string') payload.quantity = Number(payload.quantity)
        if (typeof payload.reorderLevel === 'string') payload.reorderLevel = Number(payload.reorderLevel)
        payload.gstRate = Number(payload.gstRate)
        payload.purchasePrice = Number(payload.purchasePrice)
        payload.sellingPrice = Number(payload.sellingPrice)
        
        try {
            if (isEdit) {
                await updateMedMutation.mutateAsync({ id: initial._id, payload })
                toast.success('Medicine updated')
            } else {
                await createMedMutation.mutateAsync(payload)
                toast.success('Medicine created')
            }
            onSaved()
        } catch (err) { }
    }

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between mb-6 border-b pb-4">
                    <h2 className="text-xl font-bold text-slate-800">{isEdit ? 'Edit Medicine' : 'Add New Medicine'}</h2>
                    <button className="p-2 hover:bg-slate-100 rounded-full transition-colors" onClick={onClose}>
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Medicine Name</label>
                        <input className="w-full rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500 p-2.5 bg-slate-50 border" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Paracetamol 500mg" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Batch Number</label>
                        <input className="w-full rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500 p-2.5 bg-slate-50 border" value={form.batchNumber} onChange={e => setForm({ ...form, batchNumber: e.target.value })} required placeholder="BATCH-001" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
                        <input type="date" className="w-full rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500 p-2.5 bg-slate-50 border" value={form.expiryDate?.slice(0, 10) || ''} onChange={e => setForm({ ...form, expiryDate: e.target.value })} required />
                    </div>

                    <div className="col-span-2">
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-slate-700">Supplier</label>
                            <button type="button"
                                className={`text-xs flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700 ${!canCreateSupplier ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={!canCreateSupplier}
                                onClick={() => {
                                    if (!canCreateSupplier) {
                                        toast.info('Supplier limit reached')
                                        return
                                    }
                                    setAddingSupplier(v => !v)
                                }}
                            >
                                <Plus size={14} /> New Supplier
                            </button>
                        </div>
                        <select className="w-full rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500 p-2.5 bg-slate-50 border" value={form.supplier || ''} onChange={e => setForm({ ...form, supplier: e.target.value })}>
                            <option value="">Select supplier (optional)</option>
                            {suppliers.map(s => (
                                <option key={s._id} value={s._id}>{s.name}</option>
                            ))}
                        </select>

                        <AnimatePresence>
                            {addingSupplier && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden"
                                >
                                    <h4 className="text-sm font-semibold mb-3 text-slate-700">New Supplier Details</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <input className="rounded border-slate-200 p-2 text-sm" placeholder="Supplier Name" value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} />
                                        <input className="rounded border-slate-200 p-2 text-sm" placeholder="Email" value={newSupplier.contactEmail} onChange={e => setNewSupplier({ ...newSupplier, contactEmail: e.target.value })} />
                                        <input className="rounded border-slate-200 p-2 text-sm" placeholder="Phone" value={newSupplier.contactPhone} onChange={e => setNewSupplier({ ...newSupplier, contactPhone: e.target.value })} />
                                        <button className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700" type="button" onClick={saveSupplier}>Save Supplier</button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
                        <input type="number" min="0" className="w-full rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500 p-2.5 bg-slate-50 border" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Reorder Level</label>
                        <input type="number" min="0" className="w-full rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500 p-2.5 bg-slate-50 border" value={form.reorderLevel} onChange={e => setForm({ ...form, reorderLevel: e.target.value })} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Price (₹)</label>
                        <input type="number" step="0.01" className="w-full rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500 p-2.5 bg-slate-50 border" value={form.purchasePrice} onChange={e => setForm({ ...form, purchasePrice: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price (₹)</label>
                        <input type="number" step="0.01" className="w-full rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500 p-2.5 bg-slate-50 border" value={form.sellingPrice} onChange={e => setForm({ ...form, sellingPrice: e.target.value })} />
                    </div>

                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-1">GST %</label>
                        <input type="number" step="0.1" className="w-full rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500 p-2.5 bg-slate-50 border" value={form.gstRate} onChange={e => setForm({ ...form, gstRate: e.target.value })} />
                    </div>

                    <div className="col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t">
                        <button type="button" className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors" onClick={onClose}>Cancel</button>
                        <button className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-sm shadow-blue-200 transition-all hover:scale-[1.02]" type="submit">{isEdit ? 'Update Medicine' : 'Create Medicine'}</button>
                    </div>
                </form>
            </motion.div>
        </div>
    )
}

const MedicineRow = React.memo(({ r, openEdit, onDelete }) => {
    const expired = r.expiryDate ? new Date(r.expiryDate) < new Date() : false
    const lowStock = r.quantity <= (r.reorderLevel || 10)
    return (
        <tr className="hover:bg-slate-50/80 transition-colors group">
            <td className="px-6 py-4">
                <div className="font-semibold text-slate-800">{r.name}</div>
                {lowStock && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 mt-1 inline-block">LOW STOCK</span>}
            </td>
            <td className="px-6 py-4 text-sm text-slate-600 font-mono">{r.batchNumber}</td>
            <td className="px-6 py-4 text-sm text-slate-600">{(r.supplier?.name || (typeof r.supplier === 'string' ? r.supplier : '—'))}</td>
            <td className="px-6 py-4 text-sm">
                <span className={`${expired ? 'text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded' : 'text-slate-600'}`}>
                    {r.expiryDate ? new Date(r.expiryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </span>
            </td>
            <td className="px-6 py-4 text-right font-medium text-slate-700">{r.quantity}</td>
            <td className="px-6 py-4 text-right font-medium text-slate-700">₹{Number(r.sellingPrice || 0).toFixed(2)}</td>
            <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2">
                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit" onClick={() => openEdit(r)}>
                        <Pencil size={16} />
                    </button>
                    <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete" onClick={() => onDelete(r._id || r.id)}>
                        <Trash2 size={16} />
                    </button>
                </div>
            </td>
        </tr>
    )
})

export default function Inventory() {
    useProfileRender('Inventory', true);
    const location = useLocation()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const [page, setPage] = useState(1)
    const limit = 25
    const [query, setQuery] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState(null)

    // Load Tenant Limit details using TanStack Query
    const { data: tenantData } = useQuery({
        queryKey: ['tenant'],
        queryFn: getMyTenant
    })
    const tenant = tenantData?.tenant || null
    const canCreateMedicine = useMemo(() => {
        if (!tenant) return true
        if (tenant.plan?.limits?.medicines == null) return true
        return (tenant.usage?.medicines || 0) < tenant.plan.limits.medicines
    }, [tenant])

    // Fetch suppliers via TanStack Query
    const { data: suppliers = [] } = useQuery({
        queryKey: ['suppliers'],
        queryFn: () => listSuppliers(),
    })

    // TanStack Query caching & pagination
    const { data: rawMedicines, isLoading: loading, error: queryError, refetch: fetchMedicines } = useQuery({
        queryKey: ['medicines', page, searchQuery],
        queryFn: () => listMedicines({ q: searchQuery, page, limit }),
    })

    const items = useMemo(() => {
        return Array.isArray(rawMedicines) ? rawMedicines : []
    }, [rawMedicines])

    const error = queryError ? (queryError.data?.error || queryError.message || 'Failed to load') : ''

    const load = useCallback(() => {
        fetchMedicines()
    }, [fetchMedicines])

    // Open create form if routed with ?new=1
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        if (params.get('new') === '1') {
            setEditing(null)
            setShowForm(true)
        }
    }, [location.search])

    const filtered = useMemo(() => items, [items])

    const hasMore = items.length === limit

    const deleteMedMutation = useMutation({
        mutationFn: deleteMedicine,
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['medicines'] })
            const queries = queryClient.getQueriesData({ queryKey: ['medicines'] })
            const previousQueries = []

            queries.forEach(([queryKey, oldData]) => {
                if (Array.isArray(oldData)) {
                    previousQueries.push([queryKey, oldData])
                    queryClient.setQueryData(queryKey, oldData.filter(m => m._id !== id && m.id !== id))
                }
            })
            return { previousQueries }
        },
        onError: (err, id, context) => {
            if (context?.previousQueries) {
                context.previousQueries.forEach(([queryKey, oldData]) => {
                    queryClient.setQueryData(queryKey, oldData)
                })
            }
            toast.error(err.message || 'Failed to delete medicine')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['medicines'] })
        }
    })

    const onDelete = useCallback(async (id) => {
        if (!confirm('Delete this medicine?')) return
        try {
            await deleteMedMutation.mutateAsync(id)
            toast.success('Medicine deleted')
        } catch (err) {}
    }, [deleteMedMutation])

    const handleSearchSubmit = useCallback((e) => {
        e.preventDefault()
        setSearchQuery(query)
        setPage(1)
    }, [query])

    const openNew = useCallback(() => { setEditing(null); setShowForm(true) }, [])
    const openEdit = useCallback((m) => { setEditing(m); setShowForm(true) }, [])

    return (
        <PageContainer>
            <PageHeader
                title="Inventory Management"
                breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Inventory' }]}
                actions={
                    <button
                        className={`flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium shadow-sm hover:bg-blue-700 transition-all ${!canCreateMedicine ? 'opacity-60 cursor-not-allowed' : ''}`}
                        onClick={() => {
                            if (!canCreateMedicine) {
                                try {
                                    const now = new Date()
                                    if (tenant && tenant.subscriptionEnd && now >= new Date(tenant.subscriptionEnd)) {
                                        navigate('/director/queryforplan')
                                        return
                                    }
                                } catch (e) { }
                                toast.info('Medicine limit reached. Upgrade plan to add more.')
                                return
                            }
                            openNew()
                        }}
                        disabled={!canCreateMedicine}
                    >
                        <Plus size={18} />
                        Add Medicine
                    </button>
                }
            />

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-12rem)] md:h-auto overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
                    <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                                placeholder="Search by name, generic name..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition-colors">Search</button>
                    </form>
                </div>

                <div className="table-responsive flex-1 overflow-x-auto">
                    {error && <div className="p-4 text-sm text-red-600 bg-red-50 m-4 rounded-lg border border-red-100">{error}</div>}

                    {loading ? (
                        <div className="px-6 py-12 text-center text-slate-500">
                            <div className="flex justify-center items-center gap-2">
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="px-6 py-12 text-center text-slate-500">No medicines found matching your search.</div>
                    ) : (
                        <VirtualizedTable
                            items={filtered}
                            rowHeight={72}
                            viewportHeight={400}
                            colSpan={7}
                            className="min-w-[900px]"
                            headers={
                                <tr>
                                    <th className="px-6 py-4">Medicine Name</th>
                                    <th className="px-6 py-4">Batch</th>
                                    <th className="px-6 py-4">Supplier</th>
                                    <th className="px-6 py-4">Expiry</th>
                                    <th className="px-6 py-4 text-right">Stock</th>
                                    <th className="px-6 py-4 text-right">Price</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            }
                            renderRow={(r) => (
                                <MedicineRow key={r._id || r.id} r={r} openEdit={openEdit} onDelete={onDelete} />
                            )}
                        />
                    )}
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm bg-slate-50/50">
                    <div className="text-slate-500">Page {page}</div>
                    <div className="flex gap-2">
                        <button 
                            className="btn btn-sm btn-ghost" 
                            onClick={() => setPage(p => Math.max(1, p - 1))} 
                            disabled={loading || page === 1}
                        >
                            Previous
                        </button>
                        <button 
                            className="btn btn-sm btn-ghost" 
                            onClick={() => setPage(p => p + 1)} 
                            disabled={loading || !hasMore}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showForm && (
                    <MedicineForm initial={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchMedicines() }} suppliers={suppliers} />
                )}
            </AnimatePresence>
        </PageContainer>
    )
}

