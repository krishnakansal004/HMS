import { create } from 'zustand';
import { settingsApi } from '../api/settings.js';

export const useSettingsStore = create((set, get) => ({
  settings: {},
  loading: false,
  fetchSettings: async () => {
    set({ loading: true });
    try {
      const res = await settingsApi.list();
      const map = {};
      res.data.forEach(s => { map[s.key] = s.value; });
      set({ settings: map });
    } finally {
      set({ loading: false });
    }
  },
  getSetting: (key, def) => get().settings[key] || def,
}));