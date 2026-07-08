import { useProfileRender } from '../utils/profiler';
import React, { useEffect, useState } from 'react'
import { listFaqs, createFaq, updateFaq, deleteFaq } from '../services/api'

export default function FaqsAdmin() {
    useProfileRender('FaqsAdmin', true);
    const [faqs, setFaqs] = useState([])
    const [loading, setLoading] = useState(false)
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({ question: '', answer: '', roles: ['general'] })

    async function load() {
        setLoading(true)
        try {
            // fetch all (admin) via API (admin endpoints return all roles)
            const data = await listFaqs('admin')
            setFaqs(Array.isArray(data) ? data : [])
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    function resetForm() { setEditing(null); setForm({ question: '', answer: '', roles: ['general'] }) }

    async function onSave(e) {
        e.preventDefault()
        try {
            if (editing) {
                await updateFaq(editing._id, form)
            } else {
                await createFaq(form)
            }
            await load(); resetForm()
        } catch (err) { console.error(err); alert(err.message || 'Save failed') }
    }

    function onEdit(f) { setEditing(f); setForm({ question: f.question, answer: f.answer, roles: f.roles || ['general'] }) }

    async function onDelete(id) { if (!confirm('Delete this FAQ?')) return; await deleteFaq(id); await load() }

    function toggleRole(r) {
        const next = new Set(form.roles || [])
        if (next.has(r)) next.delete(r); else next.add(r)
        setForm({ ...form, roles: Array.from(next) })
    }

    return (
        <div>
            <h1 className="text-xl font-semibold mb-4">FAQs (Admin)</h1>
            <div className="mb-4">
                <form onSubmit={onSave} className="space-y-2">
                    <div>
                        <label className="block text-sm font-medium">Question</label>
                        <input className="input" value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Answer</label>
                        <textarea className="input" rows={4} value={form.answer} onChange={e => setForm({ ...form, answer: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Roles</label>
                        <div className="flex gap-2 mt-2">
                            {['admin', 'doctor', 'patient', 'general'].map(r => (
                                <label key={r} className="inline-flex items-center gap-2">
                                    <input type="checkbox" checked={(form.roles || []).includes(r)} onChange={() => toggleRole(r)} /> {r}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button className="btn" type="submit">{editing ? 'Update' : 'Create'}</button>
                        <button type="button" className="btn" onClick={resetForm}>Clear</button>
                    </div>
                </form>
            </div>

            <div>
                <h2 className="text-lg font-medium mb-2">Existing FAQs</h2>
                {loading ? <div>Loading…</div> : (
                    <div className="space-y-2">
                        {faqs.map(f => (
                            <div key={f._id} className="p-3 border rounded">
                                <div className="font-semibold">{f.question}</div>
                                <div className="text-sm text-slate-600">{f.answer}</div>
                                <div className="text-xs text-slate-500 mt-2">Roles: {(f.roles || []).join(', ')}</div>
                                <div className="mt-2 flex gap-2">
                                    <button className="btn" onClick={() => onEdit(f)}>Edit</button>
                                    <button className="btn danger" onClick={() => onDelete(f._id)}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

