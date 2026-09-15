import { create } from 'zustand';

const STORAGE_KEY = 'hms-theme';

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Private browsing or blocked storage: use the device preference.
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

export function initializeTheme() {
  const theme = getInitialTheme();
  applyTheme(theme);
  return theme;
}

export const useThemeStore = create((set) => ({
  theme: getInitialTheme(),
  toggleTheme: () => set((state) => {
    const theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Theme still applies for this session when storage is unavailable.
    }
    return { theme };
  }),
}));
