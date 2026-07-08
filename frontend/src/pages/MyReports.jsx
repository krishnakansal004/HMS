import { useProfileRender } from '../utils/profiler';

import { useEffect, useState } from 'react'
import { listMyReports, uploadMyReport, deleteMyReport } from '../services/api'
import { toast } from 'react-toastify'
import { FileText, Upload, Trash2, Download, Eye, Plus, Search } from 'lucide-react'
import PageContainer from '../components/Admin/PageContainer'
import PageHeader from '../components/Admin/PageHeader'

export default function MyReports() {
    useProfileRender('MyReports', true);
    const [reports, setReports] = useState([])
    const [loading, setLoading] = useState(true)
    const [file, setFile] = useState(null)
    const [title, setTitle] = useState('')
    const [uploading, setUploading] = useState(false)
    const [search, setSearch] = useState('')

    useEffect(() => {
        listMyReports().then(data => {
            const arr = Array.isArray(data) ? data.slice().sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)) : []
            setReports(arr)
        }).finally(() => setLoading(false))
    }, [])

    const submit = async (e) => {
        e.preventDefault()
        if (!file) return
        setUploading(true)
        try {
            const fd = new FormData()
            fd.append('report', file)
            if (title) fd.append('title', title)
            const rep = await uploadMyReport(fd)
            setReports([rep, ...reports].slice().sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)))
            setFile(null); setTitle('')
            toast.success('Report uploaded successfully')
        } catch (err) { toast.error(err.message || 'Upload failed') }
        finally { setUploading(false) }
    }

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this report? This cannot be undone.')) return
        try {
            await deleteMyReport(id)
            setReports(reports.filter(r => String(r._id) !== String(id)))
            toast.success('Report deleted')
        } catch (err) { toast.error('Delete failed') }
    }

    const filtered = reports.filter(r => (r.title || r.originalName || '').toLowerCase().includes(search.toLowerCase()))

    return (
        <PageContainer>
            <PageHeader title="My Medical Reports" breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Reports' }]} />

            <div className="grid lg:grid-cols-12 gap-6">
                {/* UPLOAD CARD */}
                <div className="lg:col-span-4 h-fit">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sticky top-6">
                        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Upload size={20} className="text-indigo-600" /> Upload New Report
                        </h2>
                        <form onSubmit={submit} className="space-y-4">
                            <div>
                                <label className="label">Title (Optional)</label>
                                <input
                                    className="input w-full"
                                    placeholder="e.g. Blood Test Result"
                                    value={title} onChange={e => setTitle(e.target.value)}
                                />
                            </div>

                            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center bg-slate-50 hover:bg-slate-100 hover:border-indigo-300 transition-colors">
                                <input type="file" id="upload-report" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                                <label htmlFor="upload-report" className="cursor-pointer">
                                    {file ? (
                                        <div className="flex items-center justify-center gap-2 text-indigo-600 font-medium break-all">
                                            <FileText size={20} /> {file.name}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-slate-500">
                                            <Upload size={24} />
                                            <span className="text-sm font-medium">Select PDF or Image</span>
                                        </div>
                                    )}
                                </label>
                            </div>

                            <button disabled={!file || uploading} className="btn btn-primary w-full">
                                {uploading ? 'Uploading...' : 'Upload Report'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* LIST CARD */}
                <div className="lg:col-span-8">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 min-h-[500px]">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                            <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                <FileText size={20} className="text-slate-400" /> Recent Reports
                            </h2>
                            <div className="relative w-full sm:w-64">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    className="input pl-10 h-10 w-full text-sm"
                                    placeholder="Search reports..."
                                    value={search} onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        {loading ? (
                            <div className="py-12 text-center text-slate-400">Loading reports...</div>
                        ) : filtered.length === 0 ? (
                            <div className="py-20 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <FileText size={48} className="mx-auto text-slate-300 mb-3" />
                                <p className="text-slate-500 font-medium">No reports found</p>
                                <p className="text-xs text-slate-400 mt-1">Upload your medical documents to keep them safe.</p>
                            </div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-4">
                                {filtered.map(r => (
                                    <div key={r._id} className="group p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all bg-white relative">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                                <FileText size={20} />
                                            </div>
                                            <div className="flex-1 min-w-0 pr-8">
                                                <h4 className="font-semibold text-slate-800 truncate" title={r.title || r.originalName}>{r.title || r.originalName}</h4>
                                                <div className="text-xs text-slate-500 mt-0.5">{new Date(r.uploadedAt).toLocaleDateString()}</div>
                                            </div>
                                        </div>

                                        <div className="absolute top-4 right-4 transition-opacity">
                                            <button onClick={() => handleDelete(r._id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mt-4">
                                            <a href={r.url} target="_blank" rel="noreferrer" className="btn btn-xs btn-outline flex items-center justify-center gap-1">
                                                <Eye size={12} /> View
                                            </a>
                                            <a href={r.url} download className="btn btn-xs btn-outline flex items-center justify-center gap-1">
                                                <Download size={12} /> Download
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PageContainer>
    )
}

