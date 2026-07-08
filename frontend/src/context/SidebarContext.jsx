import { useAppStore } from '../store/useAppStore'

export function SidebarProvider({ children }) {
    return <>{children}</>
}

export function useSidebar() {
    const open = useAppStore((state) => state.sidebarOpen)
    const setOpen = useAppStore((state) => state.setSidebarOpen)
    return { open, setOpen }
}

