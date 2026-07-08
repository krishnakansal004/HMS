import { useCallback, memo } from 'react'
import { NavLink, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSidebar } from '../context/SidebarContext'
import { toast } from 'react-toastify'
import { X } from 'lucide-react'
import Logo from './Logo'
import { useQueryClient } from '@tanstack/react-query'
import { listMedicines, getMyTenant, listDoctors, listPatients } from '../services/api'
import { directorNav, allNav } from '../constants/navigation'


const Sidebar = memo(function Sidebar() {
    const { user } = useAuth()
    const { open, setOpen } = useSidebar()
    const { hospitalSlug: paramSlug } = useParams()
    // Fallback to user's tenant slug if not in URL (e.g. root dashboard)
    const hospitalSlug = paramSlug || user?.tenantSlug
    const queryClient = useQueryClient()

    const handlePrefetch = useCallback((to) => {
        // Normalize path to ignore '/portal/:slug' prefix
        const path = to.replace(/^\/portal\/[^/]+/, '')
        if (path === '/inventory') {
            queryClient.prefetchQuery({
                queryKey: ['medicines', 1, ''],
                queryFn: () => listMedicines({ q: '', page: 1, limit: 25 }),
            })
            queryClient.prefetchQuery({
                queryKey: ['tenant'],
                queryFn: getMyTenant,
            })
        } else if (path === '/appointments') {
            queryClient.prefetchQuery({
                queryKey: ['doctors'],
                queryFn: () => listDoctors(),
            })
            queryClient.prefetchQuery({
                queryKey: ['patients'],
                queryFn: () => listPatients(),
            })
        }
    }, [queryClient])

    const nav = user?.role === 'director' ? directorNav : allNav

    const NavItems = ({ onItemClick }) => (
        <nav className="p-2 space-y-0.5">
            {nav.map(({ to, label, icon: Icon, roles }) => {
                let isAccessible = !roles || (user && roles.includes(user.role))

                // Sub-admin feature grant check
                if (user?.role === 'subadmin' && isAccessible) {
                    const features = user.features || []
                    // Allow Dashboard by default; everything else requires an explicit feature grant
                    if (label !== 'Dashboard' && label !== 'Sub Admin Feature') {
                        isAccessible = features.includes(label)
                    }
                }

                if (isAccessible) {
                    // Construct dynamic path for tenant routes
                    let finalTo = to
                    if (hospitalSlug && !to.startsWith('/director') && !to.startsWith('http')) {
                        // Ensure we don't double slash if to is '/'
                        if (to === '/') finalTo = `/portal/${hospitalSlug}/dashboard` // Default to dashboard for root
                        else finalTo = `/portal/${hospitalSlug}${to}`
                    } else if (to === '/' && hospitalSlug) {
                        finalTo = `/portal/${hospitalSlug}/dashboard`
                    }

                    return (
                        <NavLink
                            key={to}
                            to={finalTo}
                            end={to === '/'}
                            onClick={onItemClick}
                            onMouseEnter={() => handlePrefetch(finalTo)}
                            className={({ isActive }) => [
                                'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
                                isActive
                                    ? 'bg-blue-100 text-blue-700 font-semibold'
                                    : 'text-slate-600 hover:bg-blue-100/50',
                            ].join(' ')}
                        >
                            <Icon size={18} />
                            <span className="font-medium">{label}</span>
                        </NavLink>
                    )
                }
                return null
            })}
        </nav>
    )

    return (
        <>
            {/* Desktop sidebar: fixed with scrollable content, light blue background */}
            <aside className="hidden md:flex md:fixed md:top-16 md:bottom-16 md:left-0 md:w-64 md:bg-blue-50 md:border-r md:border-blue-200 md:flex-col z-20 overflow-hidden">
                <div className="h-full overflow-y-auto">
                    <NavItems />
                </div>
            </aside>

            {/* Mobile overlay and top-down panel */}
            {open && (
                <button
                    aria-label="Close menu overlay"
                    className="md:hidden fixed inset-0 bg-black/30 z-40"
                    onClick={() => setOpen(false)}
                />
            )}
            <div
                className={[
                    'md:hidden fixed top-0 inset-x-0 z-50 bg-blue-50 border-b border-blue-200 shadow-sm transition-transform duration-200',
                    open ? 'translate-y-0' : '-translate-y-full',
                ].join(' ')}
                style={{ willChange: 'transform' }}
            >
                <div className="h-14 sm:h-16 px-3 sm:px-4 md:px-6 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Logo size={18} className="sm:hidden" />
                        <Logo size={20} withText text="HMS" className="hidden sm:flex" />
                    </div>
                    <button className="icon-btn" aria-label="Close menu" onClick={() => setOpen(false)}>
                        <X size={18} />
                    </button>
                </div>
                <div className="max-h-[calc(100vh-3.5rem)] sm:max-h-[70vh] overflow-auto">
                    <NavItems onItemClick={() => setOpen(false)} />
                </div>
            </div>
        </>
    )
})

export default Sidebar
