import { create } from 'zustand'

export const useAppStore = create((set) => ({
    sidebarOpen: false,
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
