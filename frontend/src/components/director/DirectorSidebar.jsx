import React from 'react'
import { useSidebar } from '../../context/SidebarContext'
import { Link, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Users,
    ShieldCheck,
    FileText,
    PaintBucket,
    Layers,
    Star,
    BarChart2,
    Activity,
    HelpCircle,
    Menu,
    X,
    ChevronRight,
    Search,
    Wallet
} from 'lucide-react'

// Define menu items with mapped icons
const items = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/director/dashboard' },
    { key: 'admins', label: 'Admins', icon: ShieldCheck, path: '/director/admins' },
    { key: 'users', label: 'Users', icon: Users, path: '/director/users' },
    { key: 'receipts', label: 'Receipts', icon: FileText, path: '/director/receipts' },
    { key: 'customization', label: 'Customization', icon: PaintBucket, path: '/director/customization-requests' },
    { key: 'plans', label: 'Plans', icon: Layers, path: '/director/plans' },
    { key: 'plans-usage', label: 'Plans Usage', icon: Activity, path: '/director/plans-usage' },
    { key: 'features', label: 'Features', icon: Star, path: '/director/features' },
    { key: 'queryforplan', label: 'Plan Queries', icon: HelpCircle, path: '/director/queryforplan' },
    { key: 'expenses', label: 'Expenses', icon: Wallet, path: '/director/expenses' },
]

export default function DirectorSidebar() {
    const loc = useLocation()
    const { open, setOpen } = useSidebar()

    const NavItem = ({ item, onClick }) => {
        const isActive = loc.pathname === item.path
        const Icon = item.icon

        return (
            <Link
                to={item.path}
                onClick={onClick}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
            >
                <Icon size={20} className={`transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-indigo-600'}`} />
                <span className="font-medium text-sm tracking-wide">{item.label}</span>
                {isActive && (
                    <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight size={16} className="text-white/70" />
                    </div>
                )}
            </Link>
        )
    }

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity duration-300 lg:hidden ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={() => setOpen(false)}
            />

            {/* Sidebar Container */}
            <aside
                className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-white border-r border-slate-100 flex flex-col transform transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                {/* Sidebar Header */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-50">
                    <div className="flex items-center gap-2 text-indigo-700">
                        <div className="p-1.5 bg-indigo-50 rounded-lg">
                            <LayoutDashboard size={20} className="text-indigo-600" />
                        </div>
                        <span className="font-bold text-lg tracking-tight">Director<span className="text-slate-400 font-normal">Panel</span></span>
                    </div>
                    <button
                        onClick={() => setOpen(false)}
                        className="lg:hidden p-1 rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Sidebar Content */}
                <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
                    <div className="mb-6 px-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Main Menu</p>
                        <div className="space-y-1">
                            {items.slice(0, 6).map(item => (
                                <NavItem key={item.key} item={item} onClick={() => setOpen(false)} />
                            ))}
                        </div>
                    </div>

                    <div className="px-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Management</p>
                        <div className="space-y-1">
                            {items.slice(6).map(item => (
                                <NavItem key={item.key} item={item} onClick={() => setOpen(false)} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sidebar Footer */}
                <div className="p-4 border-t border-slate-50 bg-slate-50/50">
                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                        <h4 className="font-semibold text-indigo-900 text-sm mb-1">Need Help?</h4>
                        <p className="text-xs text-indigo-700/80 mb-3">Check our documentation or contact support.</p>
                        <button className="w-full py-2 px-3 bg-white border border-indigo-200 rounded-lg text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:border-indigo-300 transition-colors shadow-sm">
                            Documentation
                        </button>
                    </div>
                </div>
            </aside>
        </>
    )
}
