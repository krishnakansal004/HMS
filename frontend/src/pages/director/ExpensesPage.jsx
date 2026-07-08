import { useProfileRender } from '../../utils/profiler';
import React, { useState, useMemo, useCallback } from 'react'
import { authFetch } from '../../services/api'
import { Plus, Trash2, Edit3, DollarSign, Calendar, Tag, FileText, X, Save, AlertCircle, Activity, CreditCard } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'react-toastify'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const ExpenseRow = React.memo(({ exp, idx, onEditClick, onDeleteClick }) => {
    return (
        <tr className="hover:bg-slate-50/50 transition-colors group">
            <td className="px-8 py-5">
                <div className="font-bold text-slate-800">{exp.title}</div>
                <div className="text-xs text-slate-400 max-w-xs truncate">{exp.description || 'No description'}</div>
            </td>
            <td className="px-8 py-5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold ring-1 ring-inset ring-slate-200/50">
                    <Tag size={12} /> {exp.category}
                </span>
            </td>
            <td className="px-8 py-5 text-slate-600 text-sm font-medium">
                <div className="flex items-center gap-2"><Calendar size={14} className="opacity-40" /> {new Date(exp.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</div>
            </td>
            <td className="px-8 py-5 text-right font-black text-rose-600 text-lg">
                ₹{Number(exp.amount).toLocaleString()}
            </td>
            <td className="px-8 py-5">
                <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onEditClick(idx, exp)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    ><Edit3 size={18} /></button>
                    <button
                        onClick={() => onDeleteClick(exp._id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    ><Trash2 size={18} /></button>
                </div>
            </td>
        </tr>
    )
})

export default function ExpensesPage() {
    useProfileRender('ExpensesPage', true);
    const [showModal, setShowModal] = useState(false)
    const [editingIdx, setEditingIdx] = useState(-1)
    const [form, setForm] = useState({
        title: '',
        category: 'Infrastructure',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
    })

    const categories = ['Infrastructure', 'Marketing', 'Salary', 'Legal', 'Taxes', 'Software', 'Other']
    const queryClient = useQueryClient()

    // Queries
    const { data: expensesData, isLoading: expensesLoading } = useQuery({
        queryKey: ['expenses'],
        queryFn: () => authFetch('/api/expenses')
    })
    const expenses = expensesData?.expenses || []

    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ['directorStats'],
        queryFn: () => authFetch('/api/director/stats')
    })
    const financials = statsData?.financials || { revenue: 0, expenses: 0, profit: 0 }

    const loading = expensesLoading || statsLoading

    // Mutations
    const submitExpenseMutation = useMutation({
        mutationFn: async (payload) => {
            if (editingIdx >= 0) {
                const id = expenses[editingIdx]._id
                return authFetch(`/api/expenses/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                })
            } else {
                return authFetch('/api/expenses', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                })
            }
        },
        onSuccess: () => {
            toast.success(editingIdx >= 0 ? 'Expense updated' : 'Expense added')
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
            queryClient.invalidateQueries({ queryKey: ['directorStats'] })
            setShowModal(false)
            setEditingIdx(-1)
            setForm({ title: '', category: 'Infrastructure', amount: '', date: new Date().toISOString().split('T')[0], description: '' })
        },
        onError: () => {
            toast.error('Operation failed')
        }
    })

    const deleteExpenseMutation = useMutation({
        mutationFn: (id) => authFetch(`/api/expenses/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            toast.success('Deleted')
            queryClient.invalidateQueries({ queryKey: ['expenses'] })
            queryClient.invalidateQueries({ queryKey: ['directorStats'] })
        },
        onError: () => {
            toast.error('Delete failed')
        }
    })

    const handleSubmit = useCallback((e) => {
        e.preventDefault()
        if (!form.title || !form.amount) return toast.warning('Title and Amount are required')
        submitExpenseMutation.mutate(form)
    }, [form, submitExpenseMutation])

    const handleDelete = useCallback((id) => {
        if (!window.confirm('Delete this expense?')) return
        deleteExpenseMutation.mutate(id)
    }, [deleteExpenseMutation])

    const handleAddClick = useCallback(() => {
        setEditingIdx(-1)
        setForm({ title: '', category: 'Infrastructure', amount: '', date: new Date().toISOString().split('T')[0], description: '' })
        setShowModal(true)
    }, [])

    const handleEditClick = useCallback((idx, exp) => {
        setEditingIdx(idx)
        setForm({ ...exp, date: exp.date?.split('T')[0] || '' })
        setShowModal(true)
    }, [])

    const total = useMemo(() => {
        return expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
    }, [expenses])

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Expense Management</h1>
                    <p className="text-slate-500 mt-1">Track manual costs and operational overheads.</p>
                </div>
                <button
                    onClick={handleAddClick}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-200"
                >
                    <Plus size={20} /> Add New Expense
                </button>
            </div>

            {/* Financial Overview - Enhanced Logic View */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-3xl p-1 shadow-2xl overflow-hidden mb-8">
                <div className="bg-slate-900/40 backdrop-blur-xl p-8 rounded-[22px] flex flex-col lg:flex-row items-center justify-between gap-8">
                    {/* Revenue Card */}
                    <div className="flex-1 w-full flex items-center gap-6">
                        <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
                            <DollarSign size={32} />
                        </div>
                        <div>
                            <p className="text-emerald-400/60 text-xs font-bold uppercase tracking-widest mb-1">Current Total Revenue</p>
                            <h3 className="text-4xl font-black text-white">₹{financials.revenue.toLocaleString()}</h3>
                        </div>
                    </div>

                    {/* Minus Sign */}
                    <div className="hidden lg:flex items-center justify-center text-slate-600 font-black text-3xl">
                        <X className="rotate-45" size={40} />
                    </div>

                    {/* Expenses Card */}
                    <div className="flex-1 w-full flex items-center gap-6">
                        <div className="p-4 bg-rose-500/10 text-rose-400 rounded-2xl border border-rose-500/20">
                            <CreditCard size={32} />
                        </div>
                        <div>
                            <p className="text-rose-400/60 text-xs font-bold uppercase tracking-widest mb-1">Total Operational Expenses</p>
                            <h3 className="text-4xl font-black text-white">₹{financials.expenses.toLocaleString()}</h3>
                        </div>
                    </div>

                    {/* Equals Sign */}
                    <div className="hidden lg:flex items-center justify-center text-slate-600 font-black text-3xl">
                        <span className="text-4xl">=</span>
                    </div>

                    {/* Profit/Loss Result Card */}
                    <div className={`flex-1 w-full p-6 rounded-2xl border-2 ${financials.profit >= 0 ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-amber-500/10 border-amber-500/30'} flex flex-col justify-center min-w-[280px]`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${financials.profit >= 0 ? 'text-indigo-400' : 'text-amber-400'}`}>Net Profit / Loss</span>
                            <div className={`p-1.5 rounded-full ${financials.profit >= 0 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                <Activity size={16} />
                            </div>
                        </div>
                        <h3 className={`text-4xl font-black ${financials.profit >= 0 ? 'text-white' : 'text-amber-400'}`}>
                            ₹{financials.profit.toLocaleString()}
                        </h3>
                        <div className="flex items-center gap-2 mt-2">
                             <div className={`h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden`}>
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, (financials.revenue > 0 ? (financials.profit / financials.revenue) * 100 : 0))}%` }}
                                    className={`h-full ${financials.profit >= 0 ? 'bg-indigo-400' : 'bg-amber-400'}`}
                                />
                             </div>
                             <span className={`text-xs font-bold ${financials.profit >= 0 ? 'text-indigo-300' : 'text-amber-300'}`}>
                                {financials.revenue > 0 ? Math.round((financials.profit / financials.revenue) * 100) : 0}% Margin
                             </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 uppercase text-[11px] font-black tracking-widest text-slate-500">
                                <th className="px-8 py-5">Expense Details</th>
                                <th className="px-8 py-5">Category</th>
                                <th className="px-8 py-5">Date</th>
                                <th className="px-8 py-5 text-right">Amount</th>
                                <th className="px-8 py-5 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr><td colSpan={5} className="p-20 text-center animate-pulse text-slate-400">Loading expenses...</td></tr>
                            ) : expenses.length === 0 ? (
                                <tr><td colSpan={5} className="p-20 text-center text-slate-400 whitespace-pre">No expenses logged yet.{"\n"}Click "Add New Expense" to get started.</td></tr>
                                                        ) : expenses.map((exp, idx) => (
                                <ExpenseRow
                                    key={exp._id}
                                    exp={exp}
                                    idx={idx}
                                    onEditClick={handleEditClick}
                                    onDeleteClick={handleDelete}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-white/20"
                        >
                            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">{editingIdx >= 0 ? 'Edit' : 'Add'} Expense</h2>
                                    <p className="text-slate-400 text-xs mt-0.5">Record operational costs below.</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleSubmit} className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-700">Expense Title</label>
                                        <div className="relative">
                                            <FileText className="absolute left-3 top-3.5 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. AWS Cloud Bill"
                                                value={form.title}
                                                onChange={e => setForm({ ...form, title: e.target.value })}
                                                className="w-full pl-10 pr-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-bold text-slate-700">Category</label>
                                            <select
                                                value={form.category}
                                                onChange={e => setForm({ ...form, category: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
                                            >
                                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-bold text-slate-700">Amount (₹)</label>
                                            <input
                                                type="number"
                                                required
                                                placeholder="0.00"
                                                value={form.amount}
                                                onChange={e => setForm({ ...form, amount: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/20 transition-all font-black text-rose-600"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-700">Expense Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={form.date}
                                            onChange={e => setForm({ ...form, date: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-bold text-slate-700">Notes / Description</label>
                                        <textarea
                                            rows="3"
                                            value={form.description}
                                            onChange={e => setForm({ ...form, description: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
                                            placeholder="Additional context about this expenditure..."
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
                                    >Cancel</button>
                                    <button
                                        type="submit"
                                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                                    ><Save size={20} /> {editingIdx >= 0 ? 'Update' : 'Save'} Expense</button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
