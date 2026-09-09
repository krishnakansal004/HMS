import { create } from 'zustand';
import { authApi } from '../api/auth.js';
import { setAccessToken, setSessionHandlers, refreshSession } from '../api/client.js';
import { toast } from '../components/ui/Toast.jsx';
import { clearAsyncCache } from '../hooks/useAsync.js';

// Session is memory-only by design (no token in localStorage/sessionStorage).
// That used to mean a hard page refresh always logged the user out. Now that
// POST /api/auth/refresh exists, `bootstrap()` uses the httpOnly refresh
// cookie to silently restore the session on app load instead — see App.jsx.

export const useAuthStore = create((set, get) => ({
  user: null, // { id, email, name, role, tenantSlug, mustChangePassword }
  status: 'idle', // 'idle' | 'loading' | 'ready' | 'error' — login/register actions only
  error: null,
  bootstrapped: false, // true once the initial silent-session-restore attempt has finished

  async login({ email, password, hospitalSlug }) {
    set({ status: 'loading', error: null });
    try {
      const res = await authApi.login({ email, password, hospitalSlug });
      setAccessToken(res.data.accessToken);
      clearAsyncCache();
      set({ user: res.data.user, status: 'ready', error: null });
      return res.data.user;
    } catch (err) {
      set({ status: 'error', error: err.message });
      throw err;
    }
  },

  async register(data) {
    set({ status: 'loading', error: null });
    try {
      await authApi.register(data);
      set({ status: 'idle', error: null });
    } catch (err) {
      set({ status: 'error', error: err.message });
      throw err;
    }
  },

  async logout() {
    try {
      await authApi.logout();
    } catch {
      // Clear client state regardless of network outcome.
    }
    setAccessToken(null);
    clearAsyncCache();
    set({ user: null, status: 'idle', error: null });
  },

  clearError() {
    set({ error: null });
  },

  /**
   * Called once at app startup (App.jsx). Tries to silently restore a
   * session from the httpOnly refresh cookie so a hard reload doesn't
   * always bounce to /login even when the cookie is still valid. A
   * missing/expired cookie is the ordinary "not logged in" case here, not
   * an error worth surfacing — resolves either way.
   */
  async bootstrap() {
    clearAsyncCache();
    try {
      const user = await refreshSession();
      set({ user, bootstrapped: true });
    } catch {
      set({ user: null, bootstrapped: true });
    }
  },
}));

// Wired once at module load, not per-component: a failed silent refresh
// mid-session (client.js's 401 interceptor) clears `user`, which is all
// ProtectedRoute needs to redirect to /login. A successful one — from
// either the interceptor or bootstrap() — keeps `user` in sync in case
// any field (e.g. mustChangePassword) changed server-side.
setSessionHandlers({
  onExpired: () => {
    // Only reachable from client.js's mid-session 401 interceptor — a
    // failed bootstrap() refresh handles its own error separately and
    // never calls this, so this toast means "was logged in, isn't anymore",
    // not the ordinary first-visit logged-out state.
    if (useAuthStore.getState().user) {
      toast.info('Your session expired. Please log in again.');
    }
    clearAsyncCache();
    useAuthStore.setState({ user: null });
  },
  onRefreshed: (user) => useAuthStore.setState({ user }),
});
