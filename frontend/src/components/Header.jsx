import { Link, useNavigate, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogOut } from 'lucide-react'
import Logo from './Logo'
import { Menu } from 'lucide-react'
import { useSidebar } from '../context/SidebarContext'
import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { useTranslation } from 'react-i18next'
import PlanBanner from './PlanBanner'

const Header = memo(function Header() {
    const { user, logout } = useAuth()
    const { setOpen } = useSidebar()
    const { t } = useTranslation()
    const { pathname } = useLocation()
    const navigate = useNavigate()
    const { hospitalSlug } = useParams()
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRef = useRef(null)

    const onLogout = useCallback(() => {
        logout()
        navigate(hospitalSlug ? `/portal/${hospitalSlug}` : '/', { replace: true })
        // Clear any lingering state if needed, but context handles it.
    }, [logout, navigate, hospitalSlug])

    // Language selection removed for patient/admin/doctor panels

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    // Configure chatbot widget scope per current user role (so widget shows role-specific FAQs)
    useEffect(() => {
        try {
            const cfg = window.ChatbotWidgetConfig || {}
            if (user && user.role) {
                cfg.panelScope = [user.role]
            } else {
                cfg.panelScope = ['general']
            }
            window.ChatbotWidgetConfig = cfg
        } catch (e) {/* ignore */ }
    }, [user, pathname])

    return (
        <header className="bg-blue-50 shadow-sm sticky top-0 z-30">
            <div className="h-14 sm:h-16 px-2 sm:px-4 md:px-6 flex items-center justify-between gap-2 sm:gap-3 relative">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    {/* Mobile hamburger (shows on small screens only) */}
                    <button
                        aria-label="Open menu"
                        onClick={() => setOpen(true)}
                        className="mobile-only md:hidden icon-btn mr-1 sm:mr-2 flex-shrink-0"
                    >
                        <Menu size={18} />
                    </button>
                    <Link to={hospitalSlug ? `/portal/${hospitalSlug}/dashboard` : '/'} className="flex items-center gap-1 sm:gap-2 min-w-0">
                        <span className="sm:hidden"><Logo size={20} /></span>
                        <span className="hidden sm:flex"><Logo size={22} withText /></span>
                    </Link>
                </div>
                {/* Center role label - hidden on very small screens */}
                <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 pointer-events-none select-none hidden xs:block">
                    {user?.role === 'admin' && (
                        <span className="text-blue-700 font-semibold tracking-wide uppercase text-xs sm:text-sm">{t('adminPanel')}</span>
                    )}
                    {user?.role === 'doctor' && (
                        <span className="text-blue-700 font-semibold tracking-wide uppercase text-xs sm:text-sm">{t('doctor')}</span>
                    )}
                </div>
                <div className="relative flex-shrink-0" ref={menuRef}>
                    {user ? (
                        <div>
                            <button
                                type="button"
                                className="flex items-center gap-3 text-left"
                                onClick={() => setMenuOpen(!menuOpen)}
                            >
                                <img
                                    src={user.avatarUrl ? user.avatarUrl : `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                                    alt="user"
                                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover flex-shrink-0"
                                />
                                {/* language selector removed */}
                                <div className="hidden sm:block min-w-0">
                                    <div className="font-medium text-sm text-slate-800 truncate">{user.name}</div>
                                    <div className="text-xs text-slate-500 capitalize">{user.role}</div>
                                </div>
                            </button>
                            {menuOpen && (
                                <div className="absolute right-0 mt-2 w-40 sm:w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-slate-200">
                                    {user?.role === 'patient' && (
                                        <button
                                            onClick={() => { navigate('/my-profile'); setMenuOpen(false); }}
                                            className="w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-700 hover:bg-slate-100"
                                        >
                                            <span>View Profile</span>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => { onLogout(); setMenuOpen(false); }}
                                        className="w-full text-left flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-700 hover:bg-slate-100"
                                    >
                                        <LogOut size={14} className="sm:w-4 sm:h-4" />
                                        <span>Logout</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Link
                            to="/login"
                            aria-current={pathname === '/login' ? 'page' : undefined}
                            className={`btn btn-primary text-xs sm:text-sm ${pathname === '/login' ? 'pointer-events-none ring-2 ring-primary/40 opacity-90' : ''}`}
                        >
                            <span className="hidden xs:inline">{pathname === '/login' ? 'Signing In' : 'Sign In'}</span>
                            <span className="xs:hidden">{pathname === '/login' ? '...' : 'Login'}</span>
                        </Link>
                    )}
                </div>
            </div>
            {/* Plan/banner area (shows between header and page content) */}
            <PlanBanner />
        </header>
    )
})

export default Header
