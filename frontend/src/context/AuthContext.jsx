import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { login as apiLogin, register as apiRegister, me as apiMe, setToken as setApiToken, refreshToken as apiRefreshToken, logout as apiLogout, registerUnauthorizedCallback as apiRegisterUnauthorizedCallback, googleLogin as apiGoogleLogin, googleRegister as apiGoogleRegister } from '../services/api'
import i18n from '../i18n'

const AuthContext = (typeof window !== 'undefined' && window.__AuthContext)
    ? window.__AuthContext
    : createContext(null)

if (typeof window !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    window.__AuthContext = AuthContext
}
const AUTH_TOKEN_KEY = 'hms.auth.token'
const AUTH_USER_KEY = 'hms.auth.user'

function loadStoredAuth() {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return { token: null, user: null }
        const token = window.localStorage.getItem(AUTH_TOKEN_KEY)
        const rawUser = window.localStorage.getItem(AUTH_USER_KEY)
        const user = rawUser ? JSON.parse(rawUser) : null
        return { token: token || null, user }
    } catch {
        return { token: null, user: null }
    }
}

function persistAuth(token, user) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return
        if (token) {
            window.localStorage.setItem(AUTH_TOKEN_KEY, token)
            window.localStorage.setItem('token', token) // Backward compatibility fallback
        } else {
            window.localStorage.removeItem(AUTH_TOKEN_KEY)
            window.localStorage.removeItem('token')
        }
        if (user) window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
        else window.localStorage.removeItem(AUTH_USER_KEY)
    } catch (e) { }
}

function clearStoredAuth() {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return
        window.localStorage.removeItem(AUTH_TOKEN_KEY)
        window.localStorage.removeItem('token')
        window.localStorage.removeItem(AUTH_USER_KEY)
    } catch (e) { }
}

export function AuthProvider({ children }) {
    const [token, setToken] = useState(null)
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        apiRegisterUnauthorizedCallback(() => {
            let redirectUrl = '/login'
            try {
                const rawUser = window.localStorage.getItem(AUTH_USER_KEY)
                const userObj = rawUser ? JSON.parse(rawUser) : null
                const role = userObj?.role
                const tenantSlug = userObj?.tenantSlug || userObj?.tenantPlan?.slug
                if ((role === 'doctor' || role === 'patient') && tenantSlug) {
                    redirectUrl = `/portal/${tenantSlug}/login`
                }
            } catch (e) { }

            // Clear state and storage
            setToken(null)
            setUser(null)
            clearStoredAuth()

            // Fire and forget logout API call to clear HTTP-only cookies
            apiLogout().catch(() => { })

            // Perform hard redirect to clean React-Query and other states
            if (typeof window !== 'undefined') {
                window.location.href = redirectUrl
            }
        })
        async function bootstrap() {
            const stored = loadStoredAuth()
            if (stored.token) {
                setToken(stored.token)
                setApiToken(stored.token)
                if (stored.user) setUser(stored.user)
            }

            try {
                // If we already have a stored token, validate it first to avoid logout-on-refresh when refresh cookie is unavailable.
                if (stored.token) {
                    try {
                        const meRes = await apiMe()
                        if (meRes?.user) {
                            setUser(meRes.user)
                            persistAuth(stored.token, meRes.user)
                            try {
                                const locale = meRes.user?.locale || (typeof window !== 'undefined' && window.localStorage.getItem('lang'))
                                if (locale) i18n.changeLanguage(locale)
                            } catch (e) { }
                            setLoading(false)
                            return
                        }
                    } catch (e) {
                        // Token may be expired; try refresh-token path next.
                    }
                }

                // Streamline boot: apiRefreshToken status code 200 already returns { token, user }
                const result = await apiRefreshToken()
                if (!result?.token) throw new Error('No token returned on refresh')
                setToken(result.token)
                setApiToken(result.token)
                setUser(result.user || null)
                persistAuth(result.token, result.user || null)
                try {
                    const locale = result.user?.locale || (typeof window !== 'undefined' && window.localStorage.getItem('lang'))
                    if (locale) i18n.changeLanguage(locale)
                } catch (e) { }
            } catch (e) {
                // Check if it's a network/server error or just unauthenticated
                if (e.status && e.status >= 500) {
                    console.error('Server error during auth bootstrap:', e)
                    // Optionally toast here? Or just let the UI handle it.
                }
                // Not logged in or refresh failed
                setToken(null)
                setApiToken(null)
                setUser(null)
                clearStoredAuth()
            } finally {
                setLoading(false)
            }
        }
        bootstrap()
    }, [])

    const googleLogin = async (accessToken, hospitalSlug) => {
        const data = await apiGoogleLogin(accessToken, hospitalSlug)

        setToken(data.token)
        setApiToken(data.token)
        setUser(data.user)
        persistAuth(data.token, data.user)

        try {
            if (data.user?.locale) {
                i18n.changeLanguage(data.user.locale)
            }
        } catch (e) { }

        return data
    }

    const registerViaGoogle = async (accessToken) => {
        const data = await apiGoogleRegister(accessToken)

        setToken(data.token)
        setApiToken(data.token)
        setUser(data.user)
        persistAuth(data.token, data.user)

        try {
            if (data.user?.locale) {
                i18n.changeLanguage(data.user.locale)
            }
        } catch (e) { }

        return data
    }

    const login = async (email, password, hospitalSlug) => {
        const data = await apiLogin(email, password, hospitalSlug)
        // No storage
        setToken(data.token)
        setApiToken(data.token)
        setUser(data.user)
        persistAuth(data.token, data.user)
        try { if (data.user?.locale) i18n.changeLanguage(data.user.locale) } catch (e) { }
        return data
    }

    // Clear stored chatbot conversations from localStorage (if present)
    function clearChatbotConversations() {
        try {
            if (typeof window === 'undefined' || !window.localStorage) return
            const prefix = 'chatbot.widget.convo.'
            const toRemove = []
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i)
                if (!k) continue
                if (k.startsWith(prefix)) toRemove.push(k)
            }
            toRemove.forEach(k => localStorage.removeItem(k))
        } catch (e) { /* ignore */ }
    }

    const refreshUser = async () => {
        if (!token) return null
        try {
            const data = await apiMe()
            setUser(data.user)
            persistAuth(token, data.user)
            return data.user
        } catch (e) {
            console.error('refreshUser failed', e)
            return null
        }
    }

    const register = async (name, email, password) => {
        const data = await apiRegister(name, email, password)
        // No storage
        setToken(data.token)
        setApiToken(data.token)
        setUser(data.user)
        persistAuth(data.token, data.user)
        try { if (data.user?.locale) i18n.changeLanguage(data.user.locale) } catch (e) { }
        return data
    }

    const logout = async () => {
        // Call backend to clear cookie
        try { await apiLogout() } catch (e) { console.error('Logout failed', e) }

        // Capture user info before clearing state for redirection logic
        const role = user?.role
        const tenantSlug = user?.tenantSlug || user?.tenantPlan?.slug

        // Clear local state
        clearChatbotConversations()
        setToken(null)
        setApiToken(null)
        setUser(null)
        clearStoredAuth()

        // Handle redirection based on role
        if (typeof window !== 'undefined') {
            if ((role === 'doctor' || role === 'patient') && tenantSlug) {
                window.location.href = `/portal/${tenantSlug}/login`
            } else {
                // Admin, Director, or Fallback
                window.location.href = '/login'
            }
        }
    }

    const value = useMemo(() => ({ token, user, loading, login, googleLogin, registerViaGoogle, register, logout, refreshUser }), [token, user, loading])
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
