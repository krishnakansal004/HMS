import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function PageHeader({ title, breadcrumbs = [], actions }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
                {breadcrumbs.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                        {breadcrumbs.map((b, i) => (
                            <div key={i} className="flex items-center gap-2">
                                {i > 0 && <ChevronRight size={14} />}
                                {b.to ? (
                                    <Link to={b.to} className="hover:text-blue-600 transition-colors">
                                        {b.label}
                                    </Link>
                                ) : (
                                    <span>{b.label}</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
    )
}
