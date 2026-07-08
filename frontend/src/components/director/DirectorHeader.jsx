import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Bell, Search, ChevronDown, User, LogOut, Settings, Menu } from 'lucide-react'
import { useSidebar } from '../../context/SidebarContext'

export default function DirectorHeader() {
    const { user, logout } = useAuth()
    const { setOpen } = useSidebar()
    const [open, setOpenMenu] = useState(false)
    const navigate = useNavigate()

    const doLogout = () => {
        logout()
        navigate('/login')
    }

    return (
        <header className="fixed top-0 right-0 left-0 lg:left-72 z-50 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between transition-all duration-300">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                    onClick={() => setOpen(true)}
                    className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
                    aria-label="Open menu"
                >
                    <Menu size={22} />
                </button>
                {/* Search Bar (Hidden on mobile for now) */}
                {/* Search Bar (Hidden on mobile for now) */}
                <div className="hidden sm:flex items-center flex-1 max-w-lg min-w-0">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search anything..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none text-slate-600 placeholder:text-slate-400"
                        />
                    </div>
                </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3 sm:gap-4">
                {/* Notifications */}
                <button className="relative p-2 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 rounded-lg transition-colors">
                    <Bell size={20} />
                    <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>

                {/* Profile Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setOpenMenu(!open)}
                        className="flex items-center gap-3 p-1 pl-2 pr-3 rounded-xl hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
                    >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold shadow-sm text-sm">
                            {(user?.name || 'D').charAt(0)}
                        </div>
                        <div className="hidden md:block text-left">
                            <p className="text-sm font-semibold text-slate-700 leading-tight truncate max-w-[100px]">{user?.name || 'Director'}</p>
                            <p className="text-[10px] text-slate-500 font-medium">Super Admin</p>
                        </div>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {open && (
                        <>
                            <div
                                className="fixed inset-0 z-30"
                                onClick={() => setOpenMenu(false)}
                            />
                            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-40 transform origin-top-right transition-all animate-in fade-in slide-in-from-top-2">
                                <div className="px-4 py-3 border-b border-slate-50 mb-1">
                                    <p className="text-sm font-semibold text-slate-800">{user?.name || 'Director Account'}</p>
                                    <p className="text-xs text-slate-500 truncate">{user?.email || 'admin@hospital.com'}</p>
                                </div>

                                <button
                                    onClick={() => { navigate('/my-profile'); setOpenMenu(false) }}
                                    className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2 transition-colors"
                                >
                                    <User size={16} /> Profile
                                </button>
                                <button
                                    className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2 transition-colors"
                                >
                                    <Settings size={16} /> Settings
                                </button>

                                <div className="my-1 border-t border-slate-50"></div>

                                <button
                                    onClick={doLogout}
                                    className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors font-medium"
                                >
                                    <LogOut size={16} /> Logout
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    )
}
