import { useEffect, useState } from 'react'
import { listSuppliers, listMedicines, createPurchase } from '../services/api'
import { toast } from 'react-toastify'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, Trash2, ShoppingBag } from 'lucide-react'

export default function PurchaseModal({ onClose, onSaved }) {
    const [suppliers, setSuppliers] = useState([])
    const [medicines, setMedicines] = useState([])
    const [supplier, setSupplier] = useState('')
    const [items, setItems] = useState([])
    const [draft, setDraft] = useState({ medicine: '', quantity: 1, unitCost: 0 })
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState(null)

    useEffect(() => {
        let mounted = true
        Promise.all([listSuppliers(), listMedicines()])
            .then(([s, m]) => {
                if (mounted) { setSuppliers(s); setMedicines(m); setLoading(false) }
            })
            .catch(e => { setError(e.message || 'Failed to load'); setLoading(false) })
        return () => { mounted = false }
    }, [])

    const addItem = () => {
        if (!draft.medicine || draft.quantity <= 0 || draft.unitCost < 0) return
        setItems(prev => [...prev, draft])
        setDraft({ medicine: '', quantity: 1, unitCost: 0 })
    }
    const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx))

    const readyDraft = draft.medicine && draft.quantity > 0 && draft.unitCost >= 0
    const effectiveItems = readyDraft ? [...items, draft] : items
    const total = effectiveItems.reduce((sum, i) => sum + i.quantity * i.unitCost, 0)

    const submit = async (e) => {
        e.preventDefault()
        setError(null)
        const payloadItems = effectiveItems
        if (!supplier || payloadItems.length === 0) {
            setError('Select a supplier and add at least one item')
            return
        }
        try {
            setSubmitting(true)
            await createPurchase({ supplier, items: payloadItems, status: 'Completed' })
            setSubmitting(false)
            toast.success('Purchase created successfully')
            onSaved() // trigger parent reload
        } catch (e) {
            setSubmitting(false)
            setError(e.message || 'Failed to create purchase')
            toast.error(e.message || 'Failed to create purchase')
        }
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
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <ShoppingBag className="text-blue-600" /> New Purchase Order
                    </h2>
                    <button className="p-2 hover:bg-slate-100 rounded-full transition-colors" onClick={onClose}>
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-6">
                        {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm font-medium border border-red-100">{error}</div>}

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                            <select
                                className="w-full rounded-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500 p-2.5 bg-slate-50 border"
                                value={supplier}
                                onChange={e => setSupplier(e.target.value)}
                                required
                            >
                                <option value="">Select supplier</option>
                                {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                            </select>
                        </div>

                        <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                            <div className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                <Plus size={16} className="text-blue-600" /> Add Items
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4 items-end">
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Select Medicine</label>
                                    <select className="w-full rounded-lg border-slate-200 p-2 text-sm" value={draft.medicine} onChange={e => setDraft({ ...draft, medicine: e.target.value })}>
                                        <option value="">Select Medicine</option>
                                        {medicines.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Qty</label>
                                    <input type="number" min="1" className="w-full rounded-lg border-slate-200 p-2 text-sm" placeholder="Qty" value={draft.quantity} onChange={e => setDraft({ ...draft, quantity: Number(e.target.value) })} />
                                </div>
                                <div className="flex gap-2 items-center">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Cost</label>
                                        <input type="number" min="0" step="0.01" className="w-full rounded-lg border-slate-200 p-2 text-sm" placeholder="Cost" value={draft.unitCost} onChange={e => setDraft({ ...draft, unitCost: Number(e.target.value) })} />
                                    </div>
                                    <div className="mt-5">
                                        <button
                                            type="button"
                                            className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                                            disabled={!readyDraft}
                                            onClick={addItem}
                                            title="Add to list"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>


                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                                        <tr>
                                            <th className="px-3 py-2">Medicine</th>
                                            <th className="px-3 py-2 text-right">Qty</th>
                                            <th className="px-3 py-2 text-right">Cost</th>
                                            <th className="px-3 py-2 text-right">Total</th>
                                            <th className="px-3 py-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {effectiveItems.length === 0 ? (
                                            <tr><td colSpan={5} className="py-6 text-center text-slate-400 text-xs text-italic">No items added yet</td></tr>
                                        ) : (
                                            effectiveItems.map((it, i) => (
                                                <tr key={i}>
                                                    <td className="px-3 py-2 font-medium text-slate-700">{medicines.find(m => m._id === it.medicine)?.name || '-'}</td>
                                                    <td className="px-3 py-2 text-right text-slate-600">{it.quantity}</td>
                                                    <td className="px-3 py-2 text-right text-slate-600">₹{it.unitCost.toFixed(2)}</td>
                                                    <td className="px-3 py-2 text-right font-medium text-slate-800">₹{(it.quantity * it.unitCost).toFixed(2)}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        {i < items.length && (
                                                            <button
                                                                type="button"
                                                                className="text-slate-400 hover:text-red-600 transition-colors"
                                                                onClick={() => removeItem(i)}
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex justify-end mt-3">
                                <div className="text-slate-500 text-sm font-medium">Total Amount: <span className="text-lg font-bold text-slate-800 ml-2">₹{total.toFixed(2)}</span></div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <button type="button" className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-50 rounded-lg transition-colors" onClick={onClose} disabled={submitting}>Cancel</button>
                            <button className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled={submitting || !supplier || effectiveItems.length === 0}>
                                {submitting ? 'Creating Purchase...' : 'Confirm Purchase'}
                            </button>
                        </div>
                    </form>
                )}
            </motion.div>
        </div>
    )
}
