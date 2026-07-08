import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Menu, X, ChevronRight } from 'lucide-react'
import Logo from './Logo'
import { useAuth } from '../context/AuthContext'

export default function PublicNavbar() {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [scrolled, setScrolled] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    // Smooth scroll effect
    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const signedIn = !!user
    const hideCreatePaths = ['/', '/home', '/contact', '/features', '/about']
    const hideCreateButton = hideCreatePaths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))

    const navLinks = [
        { name: 'Home', path: '/home' },
        { name: 'Features', path: '/features' },
        { name: 'About Us', path: '/about' },
        { name: 'Contact', path: '/contact' },
    ]

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200/50 py-3' : 'bg-transparent py-5'
                }`}
        >
            <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
                <Link to="/home" className="flex items-center gap-2 group">
                    <div className="transition-transform group-hover:scale-105">
                        <Logo size={32} withText={false} />
                    </div>
                    <span className={`text-xl font-extrabold tracking-tight transition-colors ${scrolled || location.pathname !== '/home' ? 'text-slate-900' : 'text-slate-900 lg:text-white'
                        }`}>
                        HOSPITECH<span className="text-indigo-500">VERSE</span>
                    </span>
                </Link>

                {/* Desktop Menu */}
                <div className="hidden md:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <Link
                            key={link.name}
                            to={link.path}
                            className={`text-sm font-semibold transition-colors hover:text-indigo-500 ${scrolled || location.pathname !== '/home'
                                ? 'text-slate-600'
                                : 'text-slate-300 hover:text-white'
                                }`}
                        >
                            {link.name}
                        </Link>
                    ))}
                </div>

                <div className="hidden md:flex items-center gap-4">
                    {signedIn ? (
                        <>
                            <button
                                onClick={() => {
                                    if (user?.role === 'director') {
                                        navigate('/director/dashboard');
                                    } else {
                                        navigate(user?.tenantSlug ? `/portal/${user.tenantSlug}/dashboard` : '/dashboard');
                                    }
                                }}
                                className="px-5 py-2.5 rounded-full bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20"
                            >
                                Dashboard
                            </button>
                        </>
                    ) : (
                        <div className="flex items-center gap-4">
                            <Link
                                to="/login"
                                className={`text-sm font-semibold transition-colors ${scrolled || location.pathname !== '/home' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}`}
                            >
                                Sign In
                            </Link>
                            {!hideCreateButton && (
                                <Link
                                    to="/signup"
                                    className="px-5 py-2.5 rounded-full bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20"
                                >
                                    Get Started
                                </Link>
                            )}
                        </div>
                    )}
                </div>

                {/* Mobile Toggle */}
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className={`md:hidden p-2 rounded-lg transition-colors ${scrolled || location.pathname !== '/home' ? 'text-slate-900' : 'text-white'
                        }`}
                >
                    {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            {
                mobileMenuOpen && (
                    <div className="absolute top-full left-0 right-0 bg-white border-b border-slate-100 shadow-xl p-4 md:hidden flex flex-col gap-2 animate-in slide-in-from-top-4 duration-200">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                to={link.path}
                                onClick={() => setMobileMenuOpen(false)}
                                className="p-3 rounded-lg text-slate-700 font-medium hover:bg-slate-50 hover:text-indigo-600 flex items-center justify-between group"
                            >
                                {link.name}
                                <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500" />
                            </Link>
                        ))}
                        <div className="h-px bg-slate-100 my-2"></div>
                        {signedIn ? (
                            <button
                                onClick={() => {
                                    if (user?.role === 'director') {
                                        navigate('/director/dashboard');
                                    } else {
                                        navigate(user?.tenantSlug ? `/portal/${user.tenantSlug}/dashboard` : '/dashboard');
                                    }
                                    setMobileMenuOpen(false);
                                }}
                                className="w-full py-3 rounded-lg bg-indigo-600 text-white font-bold text-center"
                            >
                                Go to Dashboard
                            </button>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <Link
                                    to="/login"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="w-full py-3 rounded-lg border border-slate-200 text-slate-700 font-bold text-center"
                                >
                                    Sign In
                                </Link>
                                {!hideCreateButton && (
                                    <Link
                                        to="/signup"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="w-full py-3 rounded-lg bg-indigo-600 text-white font-bold text-center"
                                    >
                                        Create Account
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                )
            }
        </nav >
    )
}
