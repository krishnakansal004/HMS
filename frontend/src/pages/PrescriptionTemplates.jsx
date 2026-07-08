import { useProfileRender } from '../utils/profiler';
import { useEffect, useState } from 'react';
import { listPrescriptionTemplates, createPrescriptionTemplate, updatePrescriptionTemplate, deletePrescriptionTemplate } from '../services/api';

export default function PrescriptionTemplates() {
    useProfileRender('PrescriptionTemplates', true);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [form, setForm] = useState({ name: '', notes: '', html: '', medicines: [{ name: '', dosage: '', frequency: '', duration: '' }], tests: [{ name: '', notes: '' }] });
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const data = await listPrescriptionTemplates();
            setTemplates(data);
        } catch (e) {
            // errors toasted globally
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setForm({ name: '', notes: '', html: '', medicines: [{ name: '', dosage: '', frequency: '', duration: '' }], tests: [{ name: '', notes: '' }] });
        setEditingId(null);
    };

    const handleCreate = async () => {
        await createPrescriptionTemplate(form);
        resetForm();
        setIsCreating(false);
        fetchTemplates();
    };

    const handleUpdate = async () => {
        await updatePrescriptionTemplate(editingId, form);
        resetForm();
        setIsCreating(false);
        fetchTemplates();
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete template?')) return;
        await deletePrescriptionTemplate(id);
        fetchTemplates();
    };

    const startEdit = (tpl) => {
        setEditingId(tpl._id);
        setForm({
            name: tpl.name || '',
            notes: tpl.notes || '',
            html: tpl.html || '',
            medicines: (tpl.medicines && tpl.medicines.length) ? tpl.medicines.map(m => ({ name: m.name || '', dosage: m.dosage || '', frequency: m.frequency || '', duration: m.duration || '' })) : [{ name: '', dosage: '', frequency: '', duration: '' }],
            tests: (tpl.tests && tpl.tests.length) ? tpl.tests.map(t => ({ name: t.name || '', notes: t.notes || '' })) : [{ name: '', notes: '' }],
        });
        setIsCreating(true);
    };

    const handleMedChange = (idx, field, value) => {
        const next = [...form.medicines];
        next[idx][field] = value;
        setForm({ ...form, medicines: next });
    };
    const addMedicine = () => setForm({ ...form, medicines: [...form.medicines, { name: '', dosage: '', frequency: '', duration: '' }] });
    const removeMedicine = (idx) => {
        const next = form.medicines.filter((_, i) => i !== idx);
        setForm({ ...form, medicines: next.length ? next : [{ name: '', dosage: '', frequency: '', duration: '' }] });
    };

    const handleTestChange = (idx, field, value) => {
        const next = [...form.tests];
        next[idx][field] = value;
        setForm({ ...form, tests: next });
    };
    const addTest = () => setForm({ ...form, tests: [...form.tests, { name: '', notes: '' }] });
    const removeTest = (idx) => {
        const next = form.tests.filter((_, i) => i !== idx);
        setForm({ ...form, tests: next.length ? next : [{ name: '', notes: '' }] });
    };

    if (loading) return <div className="p-6">Loading...</div>;

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-semibold">Prescription Templates</h1>
                <button className="btn btn-primary btn-sm" onClick={() => { if (isCreating) { resetForm(); setIsCreating(false); } else { setIsCreating(true); } }}>{isCreating ? 'Cancel' : 'New Template'}</button>
            </div>

            {isCreating && (
                <div className="bg-white shadow rounded-lg p-6 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="label">Name</label>
                            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="label">Notes</label>
                            <textarea className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                        </div>
                        <div className="md:col-span-2">
                            <label className="label">Custom HTML (optional)</label>
                            <textarea className="input min-h-[160px] font-mono text-xs" placeholder="Use {{patientName}}, {{doctorName}}, {{date}}, {{medicines}}, {{tests}}, {{notes}}"
                                value={form.html} onChange={e => setForm({ ...form, html: e.target.value })} />
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-medium">Medicines</h3>
                            <button type="button" className="btn btn-secondary btn-xs" onClick={addMedicine}>+ Add</button>
                        </div>
                        {form.medicines.map((m, idx) => (
                            <div key={idx} className="grid sm:grid-cols-2 md:grid-cols-5 gap-2 mb-2">
                                <input className="input" placeholder="Name" value={m.name} onChange={e => handleMedChange(idx, 'name', e.target.value)} />
                                <input className="input" placeholder="Dosage" value={m.dosage} onChange={e => handleMedChange(idx, 'dosage', e.target.value)} />
                                <input className="input" placeholder="Frequency" value={m.frequency} onChange={e => handleMedChange(idx, 'frequency', e.target.value)} />
                                <input className="input" placeholder="Duration" value={m.duration} onChange={e => handleMedChange(idx, 'duration', e.target.value)} />
                                <button type="button" className="btn btn-danger btn-xs" onClick={() => removeMedicine(idx)}>Remove</button>
                            </div>
                        ))}
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-medium">Tests</h3>
                            <button type="button" className="btn btn-secondary btn-xs" onClick={addTest}>+ Add</button>
                        </div>
                        {form.tests.map((t, idx) => (
                            <div key={idx} className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                                <input className="input" placeholder="Name" value={t.name} onChange={e => handleTestChange(idx, 'name', e.target.value)} />
                                <input className="input" placeholder="Notes" value={t.notes} onChange={e => handleTestChange(idx, 'notes', e.target.value)} />
                                <button type="button" className="btn btn-danger btn-xs" onClick={() => removeTest(idx)}>Remove</button>
                            </div>
                        ))}
                    </div>

                    <div className="pt-2">
                        <button className="btn btn-primary" onClick={editingId ? handleUpdate : handleCreate}>{editingId ? 'Update Template' : 'Create Template'}</button>
                    </div>
                </div>
            )}

            <div className="bg-white shadow rounded-lg">
                <div className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Existing Templates</h2>
                </div>
                <ul className="divide-y">
                    {templates.map(tpl => (
                        <li key={tpl._id} className="p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="font-medium">{tpl.name}</div>
                                <div className="text-xs text-slate-500">{tpl.medicines?.length || 0} medicines • {tpl.tests?.length || 0} tests</div>
                                {tpl.html && <div className="text-[11px] text-emerald-700 mt-1">Custom HTML defined</div>}
                                {tpl.notes && <div className="text-xs mt-1 text-slate-600">{tpl.notes}</div>}
                            </div>
                            <div className="flex gap-2">
                                <button className="btn btn-secondary btn-xs" onClick={() => startEdit(tpl)}>Edit</button>
                                <button className="btn btn-danger btn-xs" onClick={() => handleDelete(tpl._id)}>Delete</button>
                            </div>
                        </li>
                    ))}
                    {!templates.length && <li className="p-4 text-sm text-slate-500">No templates yet.</li>}
                </ul>
            </div>
        </div>
    );
}

