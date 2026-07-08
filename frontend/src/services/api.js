// // // Prefer same-origin in dev/prod when served via proxy or backend static hosting.
// // let BASE = (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.VITE_API_URL !== 'undefined')
// //   ? (import.meta.env.VITE_API_URL || '')
// //   : ''

// // // If local dev or Vercel, force relative path so proxy handles it and preserves cookies
// // if (typeof window !== 'undefined') {
// //   if (window.location.hostname.endsWith('.vercel.app') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
// //     BASE = ''
// //   }
// // }

// // export const API_BASE = BASE

// // if (typeof window !== 'undefined' && window.console && window.location && !import.meta.env.PROD) {
// //   console.debug('[api] API base =', BASE || '(relative)', 'window.origin=', window.location.origin)
// // }

// // let authToken = null
// // let csrfTokenStr = null
// // // No longer using sessionStorage/localStorage for tokens.
// // // Token is held in memory.

// // export function setToken(token) {
// //   authToken = token
// //   // No persistence to storage
// // }

// // // Function to fetch CSRF token on boot or before refresh
// // export async function fetchCsrfToken() {
// //   try {
// //     const res = await fetch(`${BASE}/api/auth/csrf`, {
// //       method: 'GET',
// //       credentials: 'include' // Important: ensures the _csrf cookie is actually saved by the browser
// //     })
// //     if (res.ok) {
// //       const data = await res.json()
// //       if (data.csrfToken) {
// //         csrfTokenStr = data.csrfToken
// //       }
// //     }
// //   } catch (err) {
// //     console.error('Failed to fetch CSRF token', err)
// //   }
// // }


// // import { toast } from 'react-toastify'

// // export async function authFetch(path, options = {}) {
// //   // If body is FormData, do not set Content-Type (browser will set multipart boundary)
// //   const isFormData = options && options.body && (typeof FormData !== 'undefined') && (options.body instanceof FormData)
// //   const headers = {
// //     ...(options.headers || {}),
// //     ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
// //     ...(csrfTokenStr ? { 'x-csrf-token': csrfTokenStr } : {})
// //   }
// //   if (!isFormData) headers['Content-Type'] = 'application/json'

// //   // If first auth request and no csrf token yet, fetch it
// //   if (!csrfTokenStr) await fetchCsrfToken()
// //   if (csrfTokenStr && !headers['x-csrf-token']) headers['x-csrf-token'] = csrfTokenStr

// //   // Helper to perform fetch and handle JSON parsing
// //   async function doFetch(fullUrl) {
// //     const res = await fetch(fullUrl, { ...options, headers })
// //     const data = await res.json().catch(() => ({}))
// //     return { res, data }
// //   }

// //   // Primary URL (relative when BASE is '')
// //   const primaryUrl = `${BASE}${path}`

// //   try {
// //     if (!import.meta.env.PROD) {
// //       console.debug('[api] authFetch primary request ->', primaryUrl)
// //     }
// //     let { res, data } = await doFetch(primaryUrl)
// //     if (!import.meta.env.PROD) {
// //       console.debug('[api] authFetch primary response', { url: primaryUrl, status: res.status })
// //     }

// //     // If dev server returned 404 (proxy not running) or network error, try fallback backend
// //     const isDevLocal = (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost' && window.location.port === '5173')
// //     if (res.status === 404 && !BASE && isDevLocal) {
// //       const fallbackHost = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ? import.meta.env.VITE_API_URL : 'http://127.0.0.1:4000'
// //       const fallbackUrl = `${fallbackHost}${path}`
// //       if (!import.meta.env.PROD) {
// //         console.debug('[api] authFetch attempting fallback ->', fallbackUrl)
// //       }
// //       try {
// //         ; ({ res, data } = await doFetch(fallbackUrl))
// //         if (!import.meta.env.PROD) {
// //           console.debug('[api] authFetch fallback response', { url: fallbackUrl, status: res.status })
// //         }
// //       } catch (e) {
// //         if (!import.meta.env.PROD) {
// //           console.debug('[api] authFetch fallback failed', e)
// //         }
// //         // fallback fetch failed — continue to error handling below
// //       }
// //     }

// //     if (!res.ok) {
// //       const message = data.error || 'Request failed'
// //       if (res.status === 401) {
// //         // Try to refresh token if we receive 401
// //         if (path !== '/api/auth/refresh-token' && path !== '/api/auth/login' && path !== '/api/auth/logout') {
// //           try {
// //             // First time token refresh? Go grab the CSRF token.
// //             if (!csrfTokenStr) await fetchCsrfToken();

// //             // Prevent infinite loop
// //             const refreshRes = await fetch(`${BASE}/api/auth/refresh-token`, {
// //               method: 'POST',
// //               headers: {
// //                 'Content-Type': 'application/json',
// //                 ...(csrfTokenStr ? { 'x-csrf-token': csrfTokenStr } : {})
// //               },
// //               credentials: 'include',
// //               body: JSON.stringify({}) // Explicitly send empty body to avoid 400 in some parsers
// //             })
// //             if (refreshRes.ok) {
// //               const refreshData = await refreshRes.json()
// //               if (refreshData.token) {
// //                 setToken(refreshData.token)
// //                 // Retry original request with new token
// //                 headers['Authorization'] = `Bearer ${refreshData.token}`
// //                 // If the initial request used fallbackUrl, retrying primaryUrl is safer since the backend is up.
// //                 const retry = await doFetch(primaryUrl)
// //                 res = retry.res
// //                 data = retry.data
// //                 if (res.ok) return data // success after retry
// //               }
// //             }
// //           } catch (e) {
// //             // Refresh failed, proceed to error handling (logout)
// //           }
// //         }

// //         // If still 401 after retry (or if we didn't retry)
// //         // Check res.status again in case retry overwrote it
// //         if (res.status === 401) {
// //           setToken(null)
// //           // Avoid aggressive redirect for now; let the AuthContext/Guard handle state transitions
// //         }
// //       }

// //       // Re-check ok status after potential retry
// //       if (!res.ok) {
// //         // Do not toast for 401s (handled by redirect/state clear) or auth messages
// //         if (res.status !== 401 && !/invalid token|unauthorized|session invalidated/i.test(message)) {
// //           toast.error(message)
// //         }
// //         const error = new Error(message)
// //         error.status = res.status
// //         error.data = data
// //         throw error
// //       }
// //       return data
// //     }
// //     return data
// //   } catch (err) {
// //     if (!err.status) {
// //       // toast.error(err.message || 'Network error')
// //     }
// //     throw err
// //   }
// // }

// // export function logout() {
// //   return authFetch('/api/auth/logout', { method: 'POST' })
// //     .catch(() => ({ ok: false }))
// //     .finally(() => {
// //       setToken(null)
// //       if (typeof window !== 'undefined') {
// //         window.location.href = '/login'
// //       }
// //     })
// // }

// // // Explicit refresh (call on app boot)
// // export function refreshToken() {
// //   return fetch(`${BASE}/api/auth/refresh-token`, {
// //     method: 'POST',
// //     headers: { 'Content-Type': 'application/json' },
// //     credentials: 'include', // Ensure cookie is sent
// //     body: JSON.stringify({}) // Explicitly send empty body to avoid 400
// //   })
// //     .then(r => r.json())
// //     .then(data => {
// //       if (data.token) {
// //         setToken(data.token)
// //         return { token: data.token, user: data.user }
// //       }
// //       throw new Error(data.error || 'Refresh failed')
// //     })
// // }

// // // Auth endpoints
// // export function login(email, password, hospitalSlug) {
// //   return authFetch('/api/auth/login', {
// //     method: 'POST',
// //     body: JSON.stringify({ email, password, hospitalSlug }),
// //   })
// // }

// // export function register(name, email, password, hospitalSlug) {
// //   return authFetch('/api/auth/register', {
// //     method: 'POST',
// //     body: JSON.stringify({ name, email, password, hospitalSlug }),
// //   })
// // }

// // export function forgotPassword(email) {
// //   return fetch(`${BASE}/api/auth/forgot-password`, {
// //     method: 'POST',
// //     headers: { 'Content-Type': 'application/json' },
// //     body: JSON.stringify({ email })
// //   }).then(async (res) => {
// //     const data = await res.json().catch(() => ({}))
// //     if (!res.ok) {
// //       const message = data.error || 'Request failed'
// //       toast.error(message)
// //       const error = new Error(message)
// //       error.status = res.status
// //       error.data = data
// //       throw error
// //     }
// //     return data
// //   })
// // }

// // export function resetPassword(email, token, password) {
// //   return fetch(`${BASE}/api/auth/reset-password`, {
// //     method: 'POST',
// //     headers: { 'Content-Type': 'application/json' },
// //     body: JSON.stringify({ email, token, password })
// //   }).then(async (res) => {
// //     const data = await res.json().catch(() => ({}))
// //     if (!res.ok) {
// //       const message = data.error || 'Request failed'
// //       toast.error(message)
// //       const error = new Error(message)
// //       error.status = res.status
// //       error.data = data
// //       throw error
// //     }
// //     // If a token is returned, set it like a login
// //     if (data.token) {
// //       setToken(data.token)
// //     }
// //     return data
// //   })
// // }

// // export function me() {
// //   return authFetch('/api/auth/me')
// // }

// // export function updateMe(payload) {
// //   return authFetch('/api/auth/me', { method: 'PUT', body: JSON.stringify(payload) })
// // }

// // export function changePassword(currentPassword, newPassword) {
// //   return authFetch('/api/auth/change-password', {
// //     method: 'PUT',
// //     body: JSON.stringify({ currentPassword, newPassword }),
// //   })
// // }

// // // Data endpoints
// // export function getSummary() {
// //   return authFetch('/api/summary')
// // }

// // export function getWeeklySales() {
// //   return authFetch('/api/sales/weekly')
// // }

// // export function getDailySales() {
// //   return authFetch('/api/sales/daily')
// // }

// // export function getInventory() {
// //   return authFetch('/api/inventory')
// // }

// // export function getPurchases() {
// //   return authFetch('/api/purchases')
// // }

// // // Medicines
// // export function listMedicines(q) {
// //   const qs = q ? `?q=${encodeURIComponent(q)}` : ''
// //   return authFetch(`/api/medicines${qs}`)
// // }
// // export function createMedicine(payload) {
// //   return authFetch('/api/medicines', { method: 'POST', body: JSON.stringify(payload) })
// // }
// // export function updateMedicine(id, payload) {
// //   return authFetch(`/api/medicines/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
// // }
// // export function deleteMedicine(id) {
// //   return authFetch(`/api/medicines/${id}`, { method: 'DELETE' })
// // }

// // // Suppliers
// // export function listSuppliers(q) {
// //   const qs = q ? `?q=${encodeURIComponent(q)}` : ''
// //   return authFetch(`/api/suppliers${qs}`)
// // }
// // export function createSupplier(payload) {
// //   return authFetch('/api/suppliers', { method: 'POST', body: JSON.stringify(payload) })
// // }
// // export function updateSupplier(id, payload) {
// //   return authFetch(`/api/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
// // }
// // export function deleteSupplier(id) {
// //   return authFetch(`/api/suppliers/${id}`, { method: 'DELETE' })
// // }

// // // Purchases
// // export function listPurchases() {
// //   return authFetch('/api/purchases')
// // }
// // export function createPurchase(payload) {
// //   return authFetch('/api/purchases', { method: 'POST', body: JSON.stringify(payload) })
// // }

// // // Invoices
// // export function listInvoices() {
// //   return authFetch('/api/invoices')
// // }
// // export function listPlanReceipts() {
// //   return authFetch('/api/plan-receipts')
// // }
// // export function getInvoice(id) {
// //   return authFetch(`/api/invoices/${id}`)
// // }
// // export function createInvoice(payload) {
// //   return authFetch('/api/invoices', { method: 'POST', body: JSON.stringify(payload) })
// // }
// // export function listMyInvoices() {
// //   return authFetch('/api/invoices/my')
// // }
// // export function hideInvoice(id) {
// //   return authFetch(`/api/invoices/${id}/hide`, { method: 'PATCH' })
// // }
// // export function createMyInvoice(items) {
// //   return authFetch('/api/invoices/my', { method: 'POST', body: JSON.stringify({ items }) })
// // }
// // export function getInvoicePdf(id) {
// //   return fetch(`${API_BASE}/api/invoices/${id}/pdf`, {
// //     headers: {
// //       ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
// //     }
// //   }).then(res => {
// //     if (!res.ok) throw new Error('Failed to fetch PDF')
// //     return res.blob()
// //   })
// // }



// // }
// // // Razorpay Checkout order + verify endpoints
// // export function createRazorpayOrder(paymentRequestId) {
// //   return authFetch('/api/payments/razorpay/create-order', { method: 'POST', body: JSON.stringify({ paymentRequestId }) })
// // }
// // export function verifyRazorpayPayment(payload) {
// //   return authFetch('/api/payments/razorpay/verify-payment', { method: 'POST', body: JSON.stringify(payload) })
// // }

// // // Admin debug helper for Razorpay (recent paymentRequests & invoices)
// // export function razorpayDebug() { return authFetch('/api/payments/razorpay/debug') }

// // // Reports
// // export function lowStock(threshold = 10) {
// //   return authFetch(`/api/reports/low-stock?threshold=${threshold}`)
// // }
// // export function expirySoon(days = 30) {
// //   return authFetch(`/api/reports/expiry?days=${days}`)
// // }
// // export function salesSummary() {
// //   return authFetch('/api/reports/sales-summary')
// // }
// // export function salesMonthly() {
// //   return authFetch('/api/reports/sales-monthly')
// // }
// // export function stockFull() {
// //   return authFetch('/api/reports/stock-full')
// // }
// // export function expirySoonExact(days = 4) {
// //   return authFetch(`/api/reports/expiry-soon?days=${days}`)
// // }

// // // Dashboard endpoints
// // export function dashboardSummary() {
// //   return authFetch('/api/reports/dashboard-summary')
// // }

// // export function salesLast7() {
// //   return authFetch('/api/reports/sales-last-7')
// // }

// // // Doctor dashboard metrics
// // export function doctorDashboard() {
// //   return authFetch('/api/reports/doctor-dashboard')
// // }

// // // Appointments & Availability
// // export function listDoctors() { return authFetch('/api/doctors') }
// // export function createDoctor(payload) { return authFetch('/api/doctors', { method: 'POST', body: JSON.stringify(payload) }) }
// // export function updateDoctor(id, payload) { return authFetch(`/api/doctors/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) }
// // export function deleteDoctor(id, opts = {}) {
// //   const qs = opts && opts.hard ? '?hard=true' : ''
// //   return authFetch(`/api/doctors/${id}${qs}`, { method: 'DELETE' })
// // }

// // export function getAvailability(doctorId) {
// //   return authFetch(`/api/availability/${doctorId}`)
// // }

// // export function setAvailability(doctorId, payload) {
// //   return authFetch(`/api/availability/${doctorId}`, { method: 'PUT', body: JSON.stringify(payload) })
// // }

// // export function availabilityDashboard() {
// //   return authFetch('/api/availability')
// // }

// // export function listAppointments(params = {}) {
// //   const qs = new URLSearchParams(params).toString()
// //   return authFetch(`/api/appointments${qs ? `?${qs}` : ''}`)
// // }

// // export function listPatientsWithAppointments(params = {}) {
// //   const qs = new URLSearchParams(params).toString()
// //   return authFetch(`/api/appointments/patients${qs ? `?${qs}` : ''}`)
// // }

// // export function listAppointmentsByPatient(patientId) {
// //   const qs = new URLSearchParams({ patientId }).toString()
// //   return authFetch(`/api/appointments/by-patient?${qs}`)
// // }

// // export function listDoctorPatients() {
// //   return authFetch('/api/appointments/doctor-patients')
// // }

// // export function getSlots(doctorId, date) {
// //   const qs = new URLSearchParams({ doctorId, date }).toString()
// //   return authFetch(`/api/appointments/slots?${qs}`)
// // }

// // export function getAppointment(id) { return authFetch(`/api/appointments/${id}`) }

// // export function createAppointment(payload) {
// //   // Accept either plain object or FormData. If object, send JSON; if FormData, send multipart.
// //   if ((typeof FormData !== 'undefined') && (payload instanceof FormData)) {
// //     return authFetch('/api/appointments', { method: 'POST', body: payload })
// //   }
// //   return authFetch('/api/appointments', { method: 'POST', body: JSON.stringify(payload) })
// // }

// // export function updateAppointment(id, payload) {
// //   return authFetch(`/api/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
// // }

// // export function cancelAppointment(id) {
// //   return authFetch(`/api/appointments/${id}`, { method: 'DELETE' })
// // }

// // export function getMyAppointments() {
// //   return authFetch('/api/appointments/mine')
// // }

// // export function hideAppointment(id) {
// //   return authFetch(`/api/appointments/hide/${id}`, { method: 'PATCH' })
// // }

// // // Staff
// // export function listStaff() {
// //   return authFetch('/api/staff');
// // }
// // export function createStaff(payload) {
// //   return authFetch('/api/staff', { method: 'POST', body: JSON.stringify(payload) });
// // }
// // export function updateStaff(id, payload) {
// //   return authFetch(`/api/staff/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
// // }
// // export function deleteStaff(id) {
// //   return authFetch(`/api/staff/${id}`, { method: 'DELETE' });
// // }

// // // Wards
// // export function listWards() {
// //   return authFetch('/api/wards');
// // }
// // export function createWard(payload) {
// //   return authFetch('/api/wards', { method: 'POST', body: JSON.stringify(payload) });
// // }
// // export function listBeds(wardId) {
// //   return authFetch(`/api/wards/${wardId}/beds`);
// // }
// // export function createBed(wardId, payload) {
// //   return authFetch(`/api/wards/${wardId}/beds`, { method: 'POST', body: JSON.stringify(payload) });
// // }
// // export function createBedsBulk(wardId, beds) {
// //   return authFetch(`/api/wards/${wardId}/beds/bulk`, { method: 'POST', body: JSON.stringify({ beds }) });
// // }
// // export function allocateBed(wardId, payload) {
// //   return authFetch(`/api/wards/${wardId}/allocate`, { method: 'POST', body: JSON.stringify(payload) });
// // }

// // export function getWardHistory(wardId) {
// //   return authFetch(`/api/wards/${wardId}/history`);
// // }

// // // Patients
// // export function listPatients() {
// //   return authFetch('/api/patients');
// // }
// // export function getPatient(id) {
// //   return authFetch(`/api/patients/${id}`);
// // }
// // export function createPatient(payload) {
// //   return authFetch('/api/patients', { method: 'POST', body: JSON.stringify(payload) });
// // }
// // export function updatePatient(id, payload) {
// //   return authFetch(`/api/patients/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
// // }
// // export function deletePatient(id) {
// //   return authFetch(`/api/patients/${id}`, { method: 'DELETE' });
// // }
// // export function uploadPatientReport(id, formData) {
// //   return fetch(`${BASE}/api/patients/${id}/reports`, {
// //     method: 'POST',
// //     body: formData,
// //     headers: {
// //       ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
// //     },
// //   }).then(async (res) => {
// //     const data = await res.json().catch(() => ({}));
// //     if (!res.ok) {
// //       const message = data.error || 'Request failed';
// //       toast.error(message);
// //       const error = new Error(message);
// //       error.status = res.status;
// //       error.data = data;
// //       throw error;
// //     }
// //     return data;
// //   });
// // }
// // // Patient self endpoints
// // export function getMyPatient() {
// //   return authFetch('/api/patients/me');
// // }
// // export function listMyReports() {
// //   return authFetch('/api/patients/me/reports');
// // }
// // export function uploadMyReport(formData) {
// //   return fetch(`${BASE}/api/patients/me/reports`, {
// //     method: 'POST',
// //     body: formData,
// //     headers: {
// //       ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
// //     },
// //   }).then(async (res) => {
// //     const data = await res.json().catch(() => ({}))
// //     if (!res.ok) { throw new Error(data.error || 'Upload failed') }
// //     return data
// //   })
// // }
// // export function updateMyPatient(payload) {
// //   return authFetch('/api/patients/me', { method: 'PUT', body: JSON.stringify(payload) })
// // }
// // export function uploadMyAvatar(formData) {
// //   return fetch(`${BASE}/api/patients/me/avatar`, {
// //     method: 'POST',
// //     body: formData,
// //     headers: {
// //       ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
// //     }
// //   }).then(async (res) => {
// //     const data = await res.json().catch(() => ({}));
// //     if (!res.ok) {
// //       const message = data.error || 'Upload failed';
// //       toast.error(message);
// //       const err = new Error(message);
// //       err.status = res.status;
// //       err.data = data;
// //       throw err;
// //     }
// //     return data;
// //   })
// // }
// // export function uploadMyReportsMulti(formData) {
// //   return fetch(`${BASE}/api/patients/me/reports/multi`, {
// //     method: 'POST',
// //     body: formData,
// //     headers: {
// //       ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
// //     }
// //   }).then(async (res) => {
// //     const data = await res.json().catch(() => ({}));
// //     if (!res.ok) {
// //       const message = data.error || 'Upload failed';
// //       toast.error(message);
// //       const err = new Error(message);
// //       err.status = res.status;
// //       err.data = data;
// //       throw err;
// //     }
// //     return data;
// //   })
// // }
// // export function deleteMyReport(reportId) {
// //   return authFetch(`/api/patients/me/reports/${reportId}`, { method: 'DELETE' })
// // }
// // export function assignBedToPatient(patientId, bedId) {
// //   return authFetch(`/api/patients/${patientId}/assign-bed`, { method: 'POST', body: JSON.stringify({ bedId }) });
// // }
// // export function dischargePatient(id, payload) {
// //   return authFetch(`/api/patients/${id}/discharge`, { method: 'POST', body: JSON.stringify(payload) });
// // }

// // // Prescriptions
// // export function createPrescription(payload) {
// //   return authFetch('/api/prescriptions', { method: 'POST', body: JSON.stringify(payload) });
// // }
// // export function listDoctorPrescriptions() {
// //   return authFetch('/api/prescriptions/doctor')
// // }
// // export function getPrescriptionsForPatient(patientId) {
// //   return authFetch(`/api/prescriptions/patient/${patientId}`);
// // }
// // export function getMyPrescriptions() {
// //   return authFetch('/api/prescriptions/mine');
// // }

// // export function createPaymentFromPrescription(id) {
// //   return authFetch(`/api/prescriptions/${id}/create-payment`, { method: 'POST' })
// // }
// // export function hidePrescription(id) {
// //   return authFetch(`/api/prescriptions/${id}/hide`, { method: 'PATCH' })
// // }
// // export function listPrescriptions() {
// //   return authFetch('/api/prescriptions');
// // }
// // export function updatePrescriptionStatus(id, status) {
// //   return authFetch(`/api/prescriptions/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
// // }
// // export function issuePrescription(id) {
// //   return authFetch(`/api/prescriptions/${id}/issue`, { method: 'POST' });
// // }
// // export function emailPrescription(id, payload) {
// //   return authFetch(`/api/prescriptions/${id}/email`, { method: 'POST', body: JSON.stringify(payload || {}) });
// // }

// // // Autogenerate prescription draft (uses auth token)
// // export function autogenPrescription(payload) {
// //   return authFetch('/api/prescriptions/autogen', { method: 'POST', body: JSON.stringify(payload || {}) })
// // }

// // export function updatePrescription(id, payload) {
// //   return authFetch(`/api/prescriptions/${id}`, { method: 'PUT', body: JSON.stringify(payload || {}) })
// // }

// // // Shifts
// // export function listShifts() {
// //   return authFetch('/api/shifts');
// // }
// // export function createShift(payload) {
// //   return authFetch('/api/shifts', { method: 'POST', body: JSON.stringify(payload) });
// // }

// // // Queue (token system)
// // export function listQueue(params) {
// //   const qs = new URLSearchParams(params).toString();
// //   return authFetch(`/api/queue${qs ? `?${qs}` : ''}`);
// // }
// // export function postQueueMessage(id, payload) {
// //   return authFetch(`/api/queue/${id}/message`, { method: 'POST', body: JSON.stringify(payload) })
// // }
// // export function setDoctorPresence(doctorId, payload) {
// //   return authFetch(`/api/doctors/${doctorId}/presence`, { method: 'PUT', body: JSON.stringify(payload) })
// // }
// // export function issueQueueToken(payload) {
// //   return authFetch('/api/queue', { method: 'POST', body: JSON.stringify(payload) });
// // }
// // export function updateQueueToken(id, payload) {
// //   return authFetch(`/api/queue/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
// // }
// // export function callNextToken(payload) {
// //   return authFetch('/api/queue/call-next', { method: 'POST', body: JSON.stringify(payload) });
// // }

// // // Patient-facing queue helpers
// // export function getMyQueue(params = {}) {
// //   const qs = new URLSearchParams(params).toString()
// //   return authFetch(`/api/queue/my${qs ? `?${qs}` : ''}`)
// // }
// // export function joinQueue(payload) {
// //   return authFetch('/api/queue/join', { method: 'POST', body: JSON.stringify(payload) })
// // }
// // export function payQueueToken(id, payload) {
// //   return authFetch(`/api/queue/${id}/pay`, { method: 'POST', body: JSON.stringify(payload) })
// // }

// // // Attendance
// // export function listAttendance(params) {
// //   const qs = new URLSearchParams(params).toString();
// //   return authFetch(`/api/attendance${qs ? `?${qs}` : ''}`);
// // }
// // export function markAttendance(payload) {
// //   return authFetch('/api/attendance', { method: 'POST', body: JSON.stringify(payload) });
// // }

// // // Doctor Attendance (self-service)
// // export function listDoctorAttendance(params) {
// //   const qs = new URLSearchParams(params || {}).toString();
// //   return authFetch(`/api/doctor-attendance${qs ? `?${qs}` : ''}`);
// // }
// // export function markDoctorAttendance(payload) {
// //   return authFetch('/api/doctor-attendance', { method: 'POST', body: JSON.stringify(payload) });
// // }

// // // Leaves
// // export function listLeaves(params) {
// //   const qs = new URLSearchParams(params).toString();
// //   return authFetch(`/api/leaves${qs ? `?${qs}` : ''}`);
// // }
// // export function createLeave(payload) {
// //   return authFetch('/api/leaves', { method: 'POST', body: JSON.stringify(payload) });
// // }
// // export function updateLeave(id, payload) {
// //   return authFetch(`/api/leaves/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
// // }

// // // Prescription Templates
// // export function listPrescriptionTemplates() {
// //   return authFetch('/api/prescription-templates');
// // }
// // export function createPrescriptionTemplate(payload) {
// //   return authFetch('/api/prescription-templates', { method: 'POST', body: JSON.stringify(payload) });
// // }
// // export function updatePrescriptionTemplate(id, payload) {
// //   return authFetch(`/api/prescription-templates/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
// // }
// // export function deletePrescriptionTemplate(id) {
// //   return authFetch(`/api/prescription-templates/${id}`, { method: 'DELETE' });
// // }

// // // Public
// // export function listPublicDoctors() {
// //   return fetch(`${BASE}/public/doctors`).then(r => r.json());
// // }
// // // FAQs
// // export function listFaqs(role) {
// //   const qs = role ? `?role=${encodeURIComponent(role)}` : ''
// //   return fetch(`${BASE}/api/faqs${qs}`).then(async res => {
// //     if (!res.ok) throw new Error('Failed to list FAQs')
// //     return res.json()
// //   })
// // }
// // export function createFaq(payload) { return authFetch('/api/faqs', { method: 'POST', body: JSON.stringify(payload) }) }
// // export function updateFaq(id, payload) { return authFetch(`/api/faqs/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) }
// // export function deleteFaq(id) { return authFetch(`/api/faqs/${id}`, { method: 'DELETE' }) }
// // export function submitDoctorApplication(payload) {
// //   return fetch(`${BASE}/public/doctor-apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(async (res) => {
// //     const data = await res.json().catch(() => ({}))
// //     if (!res.ok) { throw new Error(data.error || 'Request failed') }
// //     return data
// //   })
// // }

// // export function getPublicTenant(slug) {
// //   return fetch(`${BASE}/public/tenant/${encodeURIComponent(slug)}`).then(async (res) => {
// //     if (!res.ok) throw await res.json().catch(() => ({ error: 'Fail' }))
// //     return res.json()
// //   })
// // }

// // export function getPublicHospitals() {
// //   return fetch(`${BASE}/public/hospitals`).then(async (res) => {
// //     if (!res.ok) throw await res.json().catch(() => ({ error: 'Fail' }))
// //     return res.json()
// //   })
// // }

// // // Contact / Queries
// // export function submitContactQuery(payload) {
// //   return fetch(`${BASE}/public/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(async (res) => {
// //     const data = await res.json().catch(() => ({}))
// //     if (!res.ok) { throw new Error(data.error || 'Request failed') }
// //     return data
// //   })
// // }
// // export function listQueries(params = {}) {
// //   const qs = new URLSearchParams(params).toString()
// //   return authFetch(`/api/queries${qs ? `?${qs}` : ''}`)
// // }
// // export function updateQueryStatus(id, status) {
// //   return authFetch(`/api/queries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
// // }

// // // Prescription admin authorization
// // export function approvePrescription(id) {
// //   return authFetch(`/api/prescriptions/${id}/approve`, { method: 'POST' });
// // }
// // export function rejectPrescription(id) {
// //   return authFetch(`/api/prescriptions/${id}/reject`, { method: 'POST' });
// // }

// // // Doctor Applications (admin)
// // export function listDoctorApplications() {
// //   return authFetch('/api/doctor-applications');
// // }
// // export function approveDoctorApplication(id) {
// //   return authFetch(`/api/doctor-applications/${id}/approve`, { method: 'POST' });
// // }
// // export function rejectDoctorApplication(id) {
// //   return authFetch(`/api/doctor-applications/${id}/reject`, { method: 'POST' });
// // }

// // // Tenant helpers
// // export async function getMyTenant() {
// //   try {
// //     return await authFetch('/api/tenants/me')
// //   } catch (err) {
// //     // If tenant not found for current user, return a neutral shape instead of throwing
// //     if (err && err.status === 404) {
// //       return { tenant: null }
// //     }
// //     throw err
// //   }
// // }
// // // Create a subadmin under a tenant
// // export function createSubadmin(tenantId, payload) {
// //   return authFetch(`/api/tenants/${tenantId}/subadmins`, { method: 'POST', body: JSON.stringify(payload) })
// // }

// // // List subadmins for a tenant (optional search q)
// // export function listSubadmins(tenantId, q) {
// //   const url = `/api/tenants/${tenantId}/subadmins${q ? `?q=${encodeURIComponent(q)}` : ''}`
// //   return authFetch(url)
// // }

// // // Delete a subadmin
// // export function deleteSubadmin(tenantId, subadminId) {
// //   return authFetch(`/api/tenants/${tenantId}/subadmins/${subadminId}`, { method: 'DELETE' })
// // }


// // Prefer same-origin in dev/prod when served via proxy or backend static hosting.
// let BASE = (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.VITE_API_URL !== 'undefined')
//   ? (import.meta.env.VITE_API_URL || '')
//   : ''

// // If local dev or Vercel, force relative path so proxy handles it and preserves cookies
// if (typeof window !== 'undefined') {
//   if (window.location.hostname.endsWith('.vercel.app') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
//     BASE = ''
//   }
// }

// export const API_BASE = BASE

// if (typeof window !== 'undefined' && window.console && window.location && !import.meta.env.PROD) {
//   console.debug('[api] API base =', BASE || '(relative)', 'window.origin=', window.location.origin)
// }

// let authToken = null
// let csrfTokenStr = null
// // No longer using sessionStorage/localStorage for tokens.
// // Token is held in memory.

// export function setToken(token) {
//   authToken = token
//   // No persistence to storage
// }

// // Function to fetch CSRF token on boot or before refresh
// export async function fetchCsrfToken() {
//   try {
//     const res = await fetch(`${BASE}/api/auth/csrf`, {
//       method: 'GET',
//       credentials: 'include' // Important: ensures the _csrf cookie is actually saved by the browser
//     })
//     if (res.ok) {
//       const data = await res.json()
//       if (data.csrfToken) {
//         csrfTokenStr = data.csrfToken
//       }
//     }
//   } catch (err) {
//     console.error('Failed to fetch CSRF token', err)
//   }
// }


// import { toast } from 'react-toastify'

// export async function authFetch(path, options = {}) {
//   // If body is FormData, do not set Content-Type (browser will set multipart boundary)
//   const isFormData = options && options.body && (typeof FormData !== 'undefined') && (options.body instanceof FormData)
//   const headers = {
//     ...(options.headers || {}),
//     ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
//   }
//   if (!isFormData) headers['Content-Type'] = 'application/json'

//   // Helper to perform fetch and handle JSON parsing
//   async function doFetch(fullUrl) {
//     const res = await fetch(fullUrl, { ...options, headers })
//     const data = await res.json().catch(() => ({}))
//     return { res, data }
//   }

//   // Primary URL (relative when BASE is '')
//   const primaryUrl = `${BASE}${path}`

//   try {
//     if (!import.meta.env.PROD) {
//       console.debug('[api] authFetch primary request ->', primaryUrl)
//     }
//     let { res, data } = await doFetch(primaryUrl)
//     if (!import.meta.env.PROD) {
//       console.debug('[api] authFetch primary response', { url: primaryUrl, status: res.status })
//     }

//     // If dev server returned 404 (proxy not running) or network error, try fallback backend
//     const isDevLocal = (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost' && window.location.port === '5173')
//     if (res.status === 404 && !BASE && isDevLocal) {
//       const fallbackHost = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ? import.meta.env.VITE_API_URL : 'http://127.0.0.1:4000'
//       const fallbackUrl = `${fallbackHost}${path}`
//       if (!import.meta.env.PROD) {
//         console.debug('[api] authFetch attempting fallback ->', fallbackUrl)
//       }
//       try {
//         ; ({ res, data } = await doFetch(fallbackUrl))
//         if (!import.meta.env.PROD) {
//           console.debug('[api] authFetch fallback response', { url: fallbackUrl, status: res.status })
//         }
//       } catch (e) {
//         if (!import.meta.env.PROD) {
//           console.debug('[api] authFetch fallback failed', e)
//         }
//         // fallback fetch failed — continue to error handling below
//       }
//     }

//     if (!res.ok) {
//       const message = data.error || 'Request failed'
//       if (res.status === 401) {
//         // Try to refresh token if we receive 401
//         if (path !== '/api/auth/refresh-token' && path !== '/api/auth/login' && path !== '/api/auth/logout') {
//           try {
//             // First time token refresh? Go grab the CSRF token.
//             if (!csrfTokenStr) await fetchCsrfToken();

//             // Prevent infinite loop
//             const refreshRes = await fetch(`${BASE}/api/auth/refresh-token`, {
//               method: 'POST',
//               headers: {
//                 'Content-Type': 'application/json',
//                 ...(csrfTokenStr ? { 'x-csrf-token': csrfTokenStr } : {})
//               },
//               credentials: 'include',
//               body: JSON.stringify({}) // Explicitly send empty body to avoid 400 in some parsers
//             })
//             if (refreshRes.ok) {
//               const refreshData = await refreshRes.json()
//               if (refreshData.token) {
//                 setToken(refreshData.token)
//                 // Retry original request with new token
//                 headers['Authorization'] = `Bearer ${refreshData.token}`
//                 // If the initial request used fallbackUrl, retrying primaryUrl is safer since the backend is up.
//                 const retry = await doFetch(primaryUrl)
//                 res = retry.res
//                 data = retry.data
//                 if (res.ok) return data // success after retry
//               }
//             }
//           } catch (e) {
//             // Refresh failed, proceed to error handling (logout)
//           }
//         }

//         // If still 401 after retry (or if we didn't retry)
//         // Check res.status again in case retry overwrote it
//         if (res.status === 401) {
//           setToken(null)
//           // Avoid aggressive redirect for now; let the AuthContext/Guard handle state transitions
//         }
//       }

//       // Re-check ok status after potential retry
//       if (!res.ok) {
//         // Do not toast for 401s (handled by redirect/state clear) or auth messages
//         if (res.status !== 401 && !/invalid token|unauthorized|session invalidated/i.test(message)) {
//           toast.error(message)
//         }
//         const error = new Error(message)
//         error.status = res.status
//         error.data = data
//         throw error
//       }
//       return data
//     }
//     return data
//   } catch (err) {
//     if (!err.status) {
//       // toast.error(err.message || 'Network error')
//     }
//     throw err
//   }
// }

// export function logout() {
//   return authFetch('/api/auth/logout', { method: 'POST' })
//     .catch(() => ({ ok: false }))
//     .finally(() => {
//       setToken(null)
//       if (typeof window !== 'undefined') {
//         window.location.href = '/login'
//       }
//     })
// }

// // Explicit refresh (call on app boot).
// // IMPORTANT: The refresh-token endpoint requires a CSRF token (double-submit pattern).
// // We must call /api/auth/csrf first to get the token AND set the _csrf cookie,
// // then send the token value in the x-csrf-token header alongside the refreshToken cookie.
// export async function refreshToken() {
//   // Fetch CSRF token (sets cookie + returns JSON body token for the header)
//   await fetchCsrfToken()

//   const r = await fetch(`${BASE}/api/auth/refresh-token`, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       ...(csrfTokenStr ? { 'x-csrf-token': csrfTokenStr } : {}),
//     },
//     credentials: 'include', // sends both _csrf cookie and refreshToken cookie
//     body: JSON.stringify({}),
//   })

//   const data = await r.json().catch(() => ({}))
//   if (r.ok && data.token) {
//     setToken(data.token)
//     return { token: data.token, user: data.user }
//   }
//   const err = new Error(data.error || 'Refresh failed')
//   err.status = r.status
//   throw err
// }

// // Auth endpoints
// export function login(email, password, hospitalSlug) {
//   return authFetch('/api/auth/login', {
//     method: 'POST',
//     body: JSON.stringify({ email, password, hospitalSlug }),
//   })
// }

// export function register(name, email, password, hospitalSlug) {
//   return authFetch('/api/auth/register', {
//     method: 'POST',
//     body: JSON.stringify({ name, email, password, hospitalSlug }),
//   })
// }

// export function forgotPassword(email) {
//   return fetch(`${BASE}/api/auth/forgot-password`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ email })
//   }).then(async (res) => {
//     const data = await res.json().catch(() => ({}))
//     if (!res.ok) {
//       const message = data.error || 'Request failed'
//       toast.error(message)
//       const error = new Error(message)
//       error.status = res.status
//       error.data = data
//       throw error
//     }
//     return data
//   })
// }

// export function resetPassword(email, token, password) {
//   return fetch(`${BASE}/api/auth/reset-password`, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ email, token, password })
//   }).then(async (res) => {
//     const data = await res.json().catch(() => ({}))
//     if (!res.ok) {
//       const message = data.error || 'Request failed'
//       toast.error(message)
//       const error = new Error(message)
//       error.status = res.status
//       error.data = data
//       throw error
//     }
//     // If a token is returned, set it like a login
//     if (data.token) {
//       setToken(data.token)
//     }
//     return data
//   })
// }

// export function me() {
//   return authFetch('/api/auth/me')
// }

// export function updateMe(payload) {
//   return authFetch('/api/auth/me', { method: 'PUT', body: JSON.stringify(payload) })
// }

// export function changePassword(currentPassword, newPassword) {
//   return authFetch('/api/auth/change-password', {
//     method: 'PUT',
//     body: JSON.stringify({ currentPassword, newPassword }),
//   })
// }

// // Data endpoints
// export function getSummary() {
//   return authFetch('/api/summary')
// }

// export function getWeeklySales() {
//   return authFetch('/api/sales/weekly')
// }

// export function getDailySales() {
//   return authFetch('/api/sales/daily')
// }

// export function getInventory() {
//   return authFetch('/api/inventory')
// }

// export function getPurchases() {
//   return authFetch('/api/purchases')
// }

// // Medicines
// export function listMedicines(q) {
//   const qs = q ? `?q=${encodeURIComponent(q)}` : ''
//   return authFetch(`/api/medicines${qs}`)
// }
// export function createMedicine(payload) {
//   return authFetch('/api/medicines', { method: 'POST', body: JSON.stringify(payload) })
// }
// export function updateMedicine(id, payload) {
//   return authFetch(`/api/medicines/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
// }
// export function deleteMedicine(id) {
//   return authFetch(`/api/medicines/${id}`, { method: 'DELETE' })
// }

// // Suppliers
// export function listSuppliers(q) {
//   const qs = q ? `?q=${encodeURIComponent(q)}` : ''
//   return authFetch(`/api/suppliers${qs}`)
// }
// export function createSupplier(payload) {
//   return authFetch('/api/suppliers', { method: 'POST', body: JSON.stringify(payload) })
// }
// export function updateSupplier(id, payload) {
//   return authFetch(`/api/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
// }
// export function deleteSupplier(id) {
//   return authFetch(`/api/suppliers/${id}`, { method: 'DELETE' })
// }

// // Purchases
// export function listPurchases() {
//   return authFetch('/api/purchases')
// }
// export function createPurchase(payload) {
//   return authFetch('/api/purchases', { method: 'POST', body: JSON.stringify(payload) })
// }

// // Invoices
// export function listInvoices() {
//   return authFetch('/api/invoices')
// }
// export function listPlanReceipts() {
//   return authFetch('/api/plan-receipts')
// }
// export function getInvoice(id) {
//   return authFetch(`/api/invoices/${id}`)
// }
// export function createInvoice(payload) {
//   return authFetch('/api/invoices', { method: 'POST', body: JSON.stringify(payload) })
// }
// export function listMyInvoices() {
//   return authFetch('/api/invoices/my')
// }
// export function hideInvoice(id) {
//   return authFetch(`/api/invoices/${id}/hide`, { method: 'PATCH' })
// }
// export function createMyInvoice(items) {
//   return authFetch('/api/invoices/my', { method: 'POST', body: JSON.stringify({ items }) })
// }
// export function getInvoicePdf(id) {
//   return fetch(`${API_BASE}/api/invoices/${id}/pdf`, {
//     headers: {
//       ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
//     }
//   }).then(res => {
//     if (!res.ok) throw new Error('Failed to fetch PDF')
//     return res.blob()
//   })
// }
// // Payments (Razorpay link creation + check)
// export function createPaymentLink(payload) {
//   return authFetch('/api/payments/razorpay/create-link', { method: 'POST', body: JSON.stringify(payload) })
// }
// export function checkPaymentLink(linkId) {
//   return authFetch(`/api/payments/razorpay/check/${linkId}`)
// }
// // Razorpay Checkout order + verify endpoints
// export function createRazorpayOrder(paymentRequestId) {
//   return authFetch('/api/payments/razorpay/create-order', { method: 'POST', body: JSON.stringify({ paymentRequestId }) })
// }
// export function verifyRazorpayPayment(payload) {
//   return authFetch('/api/payments/razorpay/verify-payment', { method: 'POST', body: JSON.stringify(payload) })
// }

// // Admin debug helper for Razorpay (recent paymentRequests & invoices)
// export function razorpayDebug() { return authFetch('/api/payments/razorpay/debug') }

// // Reports
// export function lowStock(threshold = 10) {
//   return authFetch(`/api/reports/low-stock?threshold=${threshold}`)
// }
// export function expirySoon(days = 30) {
//   return authFetch(`/api/reports/expiry?days=${days}`)
// }
// export function salesSummary() {
//   return authFetch('/api/reports/sales-summary')
// }
// export function salesMonthly() {
//   return authFetch('/api/reports/sales-monthly')
// }
// export function stockFull() {
//   return authFetch('/api/reports/stock-full')
// }
// export function expirySoonExact(days = 4) {
//   return authFetch(`/api/reports/expiry-soon?days=${days}`)
// }

// // Dashboard endpoints
// export function dashboardSummary() {
//   return authFetch('/api/reports/dashboard-summary')
// }

// export function salesLast7() {
//   return authFetch('/api/reports/sales-last-7')
// }

// // Doctor dashboard metrics
// export function doctorDashboard() {
//   return authFetch('/api/reports/doctor-dashboard')
// }

// // Appointments & Availability
// export function listDoctors() { return authFetch('/api/doctors') }
// export function createDoctor(payload) { return authFetch('/api/doctors', { method: 'POST', body: JSON.stringify(payload) }) }
// export function updateDoctor(id, payload) { return authFetch(`/api/doctors/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) }
// export function deleteDoctor(id, opts = {}) {
//   const qs = opts && opts.hard ? '?hard=true' : ''
//   return authFetch(`/api/doctors/${id}${qs}`, { method: 'DELETE' })
// }

// export function getAvailability(doctorId) {
//   return authFetch(`/api/availability/${doctorId}`)
// }

// export function setAvailability(doctorId, payload) {
//   return authFetch(`/api/availability/${doctorId}`, { method: 'PUT', body: JSON.stringify(payload) })
// }

// export function availabilityDashboard() {
//   return authFetch('/api/availability')
// }

// export function listAppointments(params = {}) {
//   const qs = new URLSearchParams(params).toString()
//   return authFetch(`/api/appointments${qs ? `?${qs}` : ''}`)
// }

// export function listPatientsWithAppointments(params = {}) {
//   const qs = new URLSearchParams(params).toString()
//   return authFetch(`/api/appointments/patients${qs ? `?${qs}` : ''}`)
// }

// export function listAppointmentsByPatient(patientId) {
//   const qs = new URLSearchParams({ patientId }).toString()
//   return authFetch(`/api/appointments/by-patient?${qs}`)
// }

// export function listDoctorPatients() {
//   return authFetch('/api/appointments/doctor-patients')
// }

// export function getSlots(doctorId, date) {
//   const qs = new URLSearchParams({ doctorId, date }).toString()
//   return authFetch(`/api/appointments/slots?${qs}`)
// }

// export function getAppointment(id) { return authFetch(`/api/appointments/${id}`) }

// export function createAppointment(payload) {
//   // Accept either plain object or FormData. If object, send JSON; if FormData, send multipart.
//   if ((typeof FormData !== 'undefined') && (payload instanceof FormData)) {
//     return authFetch('/api/appointments', { method: 'POST', body: payload })
//   }
//   return authFetch('/api/appointments', { method: 'POST', body: JSON.stringify(payload) })
// }

// export function updateAppointment(id, payload) {
//   return authFetch(`/api/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
// }

// export function cancelAppointment(id) {
//   return authFetch(`/api/appointments/${id}`, { method: 'DELETE' })
// }

// export function getMyAppointments() {
//   return authFetch('/api/appointments/mine')
// }

// export function hideAppointment(id) {
//   return authFetch(`/api/appointments/hide/${id}`, { method: 'PATCH' })
// }

// // Staff
// export function listStaff() {
//   return authFetch('/api/staff');
// }
// export function createStaff(payload) {
//   return authFetch('/api/staff', { method: 'POST', body: JSON.stringify(payload) });
// }
// export function updateStaff(id, payload) {
//   return authFetch(`/api/staff/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
// }
// export function deleteStaff(id) {
//   return authFetch(`/api/staff/${id}`, { method: 'DELETE' });
// }

// // Wards
// export function listWards() {
//   return authFetch('/api/wards');
// }
// export function createWard(payload) {
//   return authFetch('/api/wards', { method: 'POST', body: JSON.stringify(payload) });
// }
// export function listBeds(wardId) {
//   return authFetch(`/api/wards/${wardId}/beds`);
// }
// export function createBed(wardId, payload) {
//   return authFetch(`/api/wards/${wardId}/beds`, { method: 'POST', body: JSON.stringify(payload) });
// }
// export function createBedsBulk(wardId, beds) {
//   return authFetch(`/api/wards/${wardId}/beds/bulk`, { method: 'POST', body: JSON.stringify({ beds }) });
// }
// export function allocateBed(wardId, payload) {
//   return authFetch(`/api/wards/${wardId}/allocate`, { method: 'POST', body: JSON.stringify(payload) });
// }

// export function getWardHistory(wardId) {
//   return authFetch(`/api/wards/${wardId}/history`);
// }

// // Patients
// export function listPatients() {
//   return authFetch('/api/patients');
// }
// export function getPatient(id) {
//   return authFetch(`/api/patients/${id}`);
// }
// export function createPatient(payload) {
//   return authFetch('/api/patients', { method: 'POST', body: JSON.stringify(payload) });
// }
// export function updatePatient(id, payload) {
//   return authFetch(`/api/patients/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
// }
// export function deletePatient(id) {
//   return authFetch(`/api/patients/${id}`, { method: 'DELETE' });
// }
// export function uploadPatientReport(id, formData) {
//   return fetch(`${BASE}/api/patients/${id}/reports`, {
//     method: 'POST',
//     body: formData,
//     headers: {
//       ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
//     },
//   }).then(async (res) => {
//     const data = await res.json().catch(() => ({}));
//     if (!res.ok) {
//       const message = data.error || 'Request failed';
//       toast.error(message);
//       const error = new Error(message);
//       error.status = res.status;
//       error.data = data;
//       throw error;
//     }
//     return data;
//   });
// }
// // Patient self endpoints
// export function getMyPatient() {
//   return authFetch('/api/patients/me');
// }
// export function listMyReports() {
//   return authFetch('/api/patients/me/reports');
// }
// export function uploadMyReport(formData) {
//   return fetch(`${BASE}/api/patients/me/reports`, {
//     method: 'POST',
//     body: formData,
//     headers: {
//       ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
//     },
//   }).then(async (res) => {
//     const data = await res.json().catch(() => ({}))
//     if (!res.ok) { throw new Error(data.error || 'Upload failed') }
//     return data
//   })
// }
// export function updateMyPatient(payload) {
//   return authFetch('/api/patients/me', { method: 'PUT', body: JSON.stringify(payload) })
// }
// export function uploadMyAvatar(formData) {
//   return fetch(`${BASE}/api/patients/me/avatar`, {
//     method: 'POST',
//     body: formData,
//     headers: {
//       ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
//     }
//   }).then(async (res) => {
//     const data = await res.json().catch(() => ({}));
//     if (!res.ok) {
//       const message = data.error || 'Upload failed';
//       toast.error(message);
//       const err = new Error(message);
//       err.status = res.status;
//       err.data = data;
//       throw err;
//     }
//     return data;
//   })
// }
// export function uploadMyReportsMulti(formData) {
//   return fetch(`${BASE}/api/patients/me/reports/multi`, {
//     method: 'POST',
//     body: formData,
//     headers: {
//       ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
//     }
//   }).then(async (res) => {
//     const data = await res.json().catch(() => ({}));
//     if (!res.ok) {
//       const message = data.error || 'Upload failed';
//       toast.error(message);
//       const err = new Error(message);
//       err.status = res.status;
//       err.data = data;
//       throw err;
//     }
//     return data;
//   })
// }
// export function deleteMyReport(reportId) {
//   return authFetch(`/api/patients/me/reports/${reportId}`, { method: 'DELETE' })
// }
// export function assignBedToPatient(patientId, bedId) {
//   return authFetch(`/api/patients/${patientId}/assign-bed`, { method: 'POST', body: JSON.stringify({ bedId }) });
// }
// export function dischargePatient(id, payload) {
//   return authFetch(`/api/patients/${id}/discharge`, { method: 'POST', body: JSON.stringify(payload) });
// }

// // Prescriptions
// export function createPrescription(payload) {
//   return authFetch('/api/prescriptions', { method: 'POST', body: JSON.stringify(payload) });
// }
// export function listDoctorPrescriptions() {
//   return authFetch('/api/prescriptions/doctor')
// }
// export function getPrescriptionsForPatient(patientId) {
//   return authFetch(`/api/prescriptions/patient/${patientId}`);
// }
// export function getMyPrescriptions() {
//   return authFetch('/api/prescriptions/mine');
// }

// export function createPaymentFromPrescription(id) {
//   return authFetch(`/api/prescriptions/${id}/create-payment`, { method: 'POST' })
// }
// export function hidePrescription(id) {
//   return authFetch(`/api/prescriptions/${id}/hide`, { method: 'PATCH' })
// }
// export function listPrescriptions() {
//   return authFetch('/api/prescriptions');
// }
// export function updatePrescriptionStatus(id, status) {
//   return authFetch(`/api/prescriptions/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
// }
// export function issuePrescription(id) {
//   return authFetch(`/api/prescriptions/${id}/issue`, { method: 'POST' });
// }
// export function emailPrescription(id, payload) {
//   return authFetch(`/api/prescriptions/${id}/email`, { method: 'POST', body: JSON.stringify(payload || {}) });
// }

// // Autogenerate prescription draft (uses auth token)
// export function autogenPrescription(payload) {
//   return authFetch('/api/prescriptions/autogen', { method: 'POST', body: JSON.stringify(payload || {}) })
// }

// export function updatePrescription(id, payload) {
//   return authFetch(`/api/prescriptions/${id}`, { method: 'PUT', body: JSON.stringify(payload || {}) })
// }

// // Shifts
// export function listShifts() {
//   return authFetch('/api/shifts');
// }
// export function createShift(payload) {
//   return authFetch('/api/shifts', { method: 'POST', body: JSON.stringify(payload) });
// }

// // Queue (token system)
// export function listQueue(params) {
//   const qs = new URLSearchParams(params).toString();
//   return authFetch(`/api/queue${qs ? `?${qs}` : ''}`);
// }
// export function postQueueMessage(id, payload) {
//   return authFetch(`/api/queue/${id}/message`, { method: 'POST', body: JSON.stringify(payload) })
// }
// export function setDoctorPresence(doctorId, payload) {
//   return authFetch(`/api/doctors/${doctorId}/presence`, { method: 'PUT', body: JSON.stringify(payload) })
// }
// export function issueQueueToken(payload) {
//   return authFetch('/api/queue', { method: 'POST', body: JSON.stringify(payload) });
// }
// export function updateQueueToken(id, payload) {
//   return authFetch(`/api/queue/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
// }
// export function callNextToken(payload) {
//   return authFetch('/api/queue/call-next', { method: 'POST', body: JSON.stringify(payload) });
// }

// // Patient-facing queue helpers
// export function getMyQueue(params = {}) {
//   const qs = new URLSearchParams(params).toString()
//   return authFetch(`/api/queue/my${qs ? `?${qs}` : ''}`)
// }
// export function joinQueue(payload) {
//   return authFetch('/api/queue/join', { method: 'POST', body: JSON.stringify(payload) })
// }
// export function payQueueToken(id, payload) {
//   return authFetch(`/api/queue/${id}/pay`, { method: 'POST', body: JSON.stringify(payload) })
// }

// // Attendance
// export function listAttendance(params) {
//   const qs = new URLSearchParams(params).toString();
//   return authFetch(`/api/attendance${qs ? `?${qs}` : ''}`);
// }
// export function markAttendance(payload) {
//   return authFetch('/api/attendance', { method: 'POST', body: JSON.stringify(payload) });
// }

// // Doctor Attendance (self-service)
// export function listDoctorAttendance(params) {
//   const qs = new URLSearchParams(params || {}).toString();
//   return authFetch(`/api/doctor-attendance${qs ? `?${qs}` : ''}`);
// }
// export function markDoctorAttendance(payload) {
//   return authFetch('/api/doctor-attendance', { method: 'POST', body: JSON.stringify(payload) });
// }

// // Leaves
// export function listLeaves(params) {
//   const qs = new URLSearchParams(params).toString();
//   return authFetch(`/api/leaves${qs ? `?${qs}` : ''}`);
// }
// export function createLeave(payload) {
//   return authFetch('/api/leaves', { method: 'POST', body: JSON.stringify(payload) });
// }
// export function updateLeave(id, payload) {
//   return authFetch(`/api/leaves/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
// }

// // Prescription Templates
// export function listPrescriptionTemplates() {
//   return authFetch('/api/prescription-templates');
// }
// export function createPrescriptionTemplate(payload) {
//   return authFetch('/api/prescription-templates', { method: 'POST', body: JSON.stringify(payload) });
// }
// export function updatePrescriptionTemplate(id, payload) {
//   return authFetch(`/api/prescription-templates/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
// }
// export function deletePrescriptionTemplate(id) {
//   return authFetch(`/api/prescription-templates/${id}`, { method: 'DELETE' });
// }

// // Public
// export function listPublicDoctors() {
//   return fetch(`${BASE}/public/doctors`).then(r => r.json());
// }
// // FAQs
// export function listFaqs(role) {
//   const qs = role ? `?role=${encodeURIComponent(role)}` : ''
//   return fetch(`${BASE}/api/faqs${qs}`).then(async res => {
//     if (!res.ok) throw new Error('Failed to list FAQs')
//     return res.json()
//   })
// }
// export function createFaq(payload) { return authFetch('/api/faqs', { method: 'POST', body: JSON.stringify(payload) }) }
// export function updateFaq(id, payload) { return authFetch(`/api/faqs/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) }
// export function deleteFaq(id) { return authFetch(`/api/faqs/${id}`, { method: 'DELETE' }) }
// export function submitDoctorApplication(payload) {
//   return fetch(`${BASE}/public/doctor-apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(async (res) => {
//     const data = await res.json().catch(() => ({}))
//     if (!res.ok) { throw new Error(data.error || 'Request failed') }
//     return data
//   })
// }

// export function getPublicTenant(slug) {
//   return fetch(`${BASE}/public/tenant/${encodeURIComponent(slug)}`).then(async (res) => {
//     if (!res.ok) throw await res.json().catch(() => ({ error: 'Fail' }))
//     return res.json()
//   })
// }

// export function getPublicHospitals() {
//   return fetch(`${BASE}/public/hospitals`).then(async (res) => {
//     if (!res.ok) throw await res.json().catch(() => ({ error: 'Fail' }))
//     return res.json()
//   })
// }

// // Contact / Queries
// export function submitContactQuery(payload) {
//   return fetch(`${BASE}/public/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(async (res) => {
//     const data = await res.json().catch(() => ({}))
//     if (!res.ok) { throw new Error(data.error || 'Request failed') }
//     return data
//   })
// }
// export function listQueries(params = {}) {
//   const qs = new URLSearchParams(params).toString()
//   return authFetch(`/api/queries${qs ? `?${qs}` : ''}`)
// }
// export function updateQueryStatus(id, status) {
//   return authFetch(`/api/queries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
// }

// // Prescription admin authorization
// export function approvePrescription(id) {
//   return authFetch(`/api/prescriptions/${id}/approve`, { method: 'POST' });
// }
// export function rejectPrescription(id) {
//   return authFetch(`/api/prescriptions/${id}/reject`, { method: 'POST' });
// }

// // Doctor Applications (admin)
// export function listDoctorApplications() {
//   return authFetch('/api/doctor-applications');
// }
// export function approveDoctorApplication(id) {
//   return authFetch(`/api/doctor-applications/${id}/approve`, { method: 'POST' });
// }
// export function rejectDoctorApplication(id) {
//   return authFetch(`/api/doctor-applications/${id}/reject`, { method: 'POST' });
// }

// // Tenant helpers
// export async function getMyTenant() {
//   try {
//     return await authFetch('/api/tenants/me')
//   } catch (err) {
//     // If tenant not found for current user, return a neutral shape instead of throwing
//     if (err && err.status === 404) {
//       return { tenant: null }
//     }
//     throw err
//   }
// }
// // Create a subadmin under a tenant
// export function createSubadmin(tenantId, payload) {
//   return authFetch(`/api/tenants/${tenantId}/subadmins`, { method: 'POST', body: JSON.stringify(payload) })
// }

// // List subadmins for a tenant (optional search q)
// export function listSubadmins(tenantId, q) {
//   const url = `/api/tenants/${tenantId}/subadmins${q ? `?q=${encodeURIComponent(q)}` : ''}`
//   return authFetch(url)
// }

// // Delete a subadmin
// export function deleteSubadmin(tenantId, subadminId) {
//   return authFetch(`/api/tenants/${tenantId}/subadmins/${subadminId}`, { method: 'DELETE' })
// }



// Prefer explicit backend URL when configured; otherwise use same-origin relative path.
const configuredBase = (typeof import.meta !== 'undefined' && import.meta.env && typeof import.meta.env.VITE_API_URL !== 'undefined')
  ? (import.meta.env.VITE_API_URL || '')
  : ''

// On localhost, we prefer relative paths to leverage Vite's dev proxy (vite.config.js).
// This avoids CORS/Cookie issues between 5173 and 4000.
let BASE = ''
if (typeof window !== 'undefined') {
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    BASE = configuredBase || getGatewayFallbackBase() || ''
  }
}

export const API_BASE = BASE

if (typeof window !== 'undefined' && window.console && window.location && !import.meta.env.PROD) {
  console.debug('[api] API base =', BASE || '(relative)', 'window.origin=', window.location.origin)
}

let authToken = null
let csrfTokenStr = null
// No longer using sessionStorage/localStorage for tokens.
// Token is held in memory.

let unauthCallback = null
export function registerUnauthorizedCallback(cb) {
  unauthCallback = cb
}

export function setToken(token) {
  authToken = token
  // No persistence to storage
}

export function getAuthToken() {
  return authToken
}

export async function getPlanReceiptPdf(id) {
  const path = `/api/plan-receipts/${id}/pdf`
  let currentToken = getAuthToken()
  
  async function performFetch(token, baseUrl = API_BASE) {
    if (!token && !import.meta.env.PROD) console.warn('[api] No token for getPlanReceiptPdf performFetch');
    return fetch(`${baseUrl}${path}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include'
    })
  }

  let res = await performFetch(currentToken)
  
  // If dev server returned 404 (proxy not running), try local fallback
  const isDevLocal = (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost' && window.location.port === '5173')
  if (res.status === 404 && !API_BASE && isDevLocal) {
    const fallbackHost = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ? import.meta.env.VITE_API_URL : 'http://127.0.0.1:4000'
    try {
      res = await performFetch(currentToken, fallbackHost)
    } catch (e) { /* ignore fallback fail */ }
  }

  // If gateway failure, try direct backend fallback
  if ([502, 503, 504].includes(res.status) && !API_BASE) {
    const gw = getGatewayFallbackBase()
    if (gw) {
      try {
        res = await performFetch(currentToken, gw)
      } catch (e) { /* ignore fallback fail */ }
    }
  }

  // If 401, try to refresh
  if (res.status === 401) {
    try {
      const refreshResult = await refreshToken()
      if (refreshResult && refreshResult.token) {
        res = await performFetch(refreshResult.token)
      }
    } catch (e) {
      // Refresh failed
    }
  }

  if (!res.ok) {
    console.error('[api] getPlanReceiptPdf failed', { status: res.status, id })
    throw new Error('Failed to fetch PDF — ' + res.status)
  }
  return res.blob()
}


// Function to fetch CSRF token on boot or before refresh
export async function fetchCsrfToken() {
  try {
    const res = await fetch(`${BASE}/api/auth/csrf`, {
      method: 'GET',
      credentials: 'include' // Important: ensures the _csrf cookie is actually saved by the browser
    })
    if (res.ok) {
      const data = await res.json()
      if (data.csrfToken) {
        csrfTokenStr = data.csrfToken
      }
    }
  } catch (err) {
    console.error('Failed to fetch CSRF token', err)
  }
}


import { toast } from 'react-toastify'

function cleanParams(params) {
  if (!params || typeof params !== 'object') return params;
  const cleaned = {};
  for (const key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      if (['queryKey', 'pageParam', 'signal', 'meta', 'client'].includes(key)) {
        continue;
      }
      cleaned[key] = params[key];
    }
  }
  return cleaned;
}

function getGatewayFallbackBase() {
  if (typeof window === 'undefined') return ''
  const host = window.location.hostname || ''
  // Only use gateway fallback when frontend is served from Vercel and base is relative.
  if (!host.endsWith('.vercel.app')) return ''
  return (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL)
    ? import.meta.env.VITE_API_URL
    : 'https://hms-backend-jwe6.onrender.com'
}

let refreshPromise = null

async function runSingleRefresh() {
  if (refreshPromise) {
    if (!import.meta.env.PROD) console.debug('[api] Awaiting existing token refresh flight...');
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      if (!import.meta.env.PROD) console.debug('[api] Initiating single-flight token refresh...');
      // Try same-origin refresh first (cookie-based), then direct backend fallback.
      const refreshCandidates = []
      const primaryRefresh = `${BASE}/api/auth/refresh-token`
      refreshCandidates.push(primaryRefresh)
      const fallbackBase = getGatewayFallbackBase()
      if (fallbackBase) {
        const fallbackRefresh = `${fallbackBase}/api/auth/refresh-token`
        if (!refreshCandidates.includes(fallbackRefresh)) refreshCandidates.push(fallbackRefresh)
      }

      let refreshedToken = null
      for (const refreshUrl of refreshCandidates) {
        const refreshRes = await fetch(refreshUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfTokenStr ? { 'x-csrf-token': csrfTokenStr } : {})
          },
          credentials: 'include',
          body: JSON.stringify({})
        })
        if (!refreshRes.ok) continue
        const refreshData = await refreshRes.json().catch(() => ({}))
        if (refreshData?.token) {
          refreshedToken = refreshData.token
          break
        }
      }
      return refreshedToken
    } catch (e) {
      console.error('[api] Refresh failed:', e)
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export async function authFetch(path, options = {}) {
  // If body is FormData, do not set Content-Type (browser will set multipart boundary)
  const isFormData = options && options.body && (typeof FormData !== 'undefined') && (options.body instanceof FormData)
  const headers = {
    ...(options.headers || {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  }
  if (!isFormData) headers['Content-Type'] = 'application/json'

  // Helper to perform fetch and handle JSON parsing
  async function doFetch(fullUrl) {
    const res = await fetch(fullUrl, { ...options, headers, credentials: 'include' })
    const data = await res.json().catch(() => ({}))
    return { res, data }
  }

  // Primary URL (relative when BASE is '')
  const primaryUrl = `${BASE}${path}`

  try {
    if (!import.meta.env.PROD) {
      console.debug('[api] authFetch primary request ->', primaryUrl)
    }
    let activeUrl = primaryUrl
    let { res, data } = await doFetch(activeUrl)
    if (!import.meta.env.PROD) {
      console.debug('[api] authFetch primary response', { url: primaryUrl, status: res.status })
    }

    // If dev server returned 404 (proxy not running), try fallback backend
    const isDevLocal = (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost' && window.location.port === '5173')
    if (res.status === 404 && !BASE && isDevLocal) {
      const fallbackHost = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ? import.meta.env.VITE_API_URL : 'http://127.0.0.1:4000'
      const fallbackUrl = `${fallbackHost}${path}`
      if (!import.meta.env.PROD) {
        console.debug('[api] authFetch attempting fallback ->', fallbackUrl)
      }
      try {
        ; ({ res, data } = await doFetch(fallbackUrl))
        if (!import.meta.env.PROD) {
          console.debug('[api] authFetch fallback response', { url: fallbackUrl, status: res.status })
        }
      } catch (e) {
        if (!import.meta.env.PROD) {
          console.debug('[api] authFetch fallback failed', e)
        }
        // fallback fetch failed — continue to error handling below
      }
    }

    // If Vercel rewrite gateway is failing, retry directly against backend origin.
    if ([502, 503, 504].includes(res.status) && !BASE) {
      const gatewayFallback = getGatewayFallbackBase()
      if (gatewayFallback) {
        const fallbackUrl = `${gatewayFallback}${path}`
        if (!import.meta.env.PROD) {
          console.debug('[api] authFetch gateway fallback ->', fallbackUrl)
        }
        try {
          activeUrl = fallbackUrl
            ; ({ res, data } = await doFetch(activeUrl))
        } catch (e) {
          if (!import.meta.env.PROD) {
            console.debug('[api] authFetch gateway fallback failed', e)
          }
        }
      }
    }

    if (!res.ok) {
      const message = data.error || 'Request failed'
      if (res.status === 401) {
        // Try to refresh token if we receive 401
        if (path !== '/api/auth/refresh-token' && path !== '/api/auth/login' && path !== '/api/auth/logout') {
          try {
            const refreshedToken = await runSingleRefresh()

            if (refreshedToken) {
              setToken(refreshedToken)
              headers['Authorization'] = `Bearer ${refreshedToken}`

              // Retry against the URL that last failed.
              let retry = await doFetch(activeUrl)
              res = retry.res
              data = retry.data

              // If gateway URL still fails, try direct backend fallback once.
              if (!res.ok && [502, 503, 504].includes(res.status) && activeUrl === primaryUrl) {
                const gw = getGatewayFallbackBase()
                if (gw) {
                  activeUrl = `${gw}${path}`
                  retry = await doFetch(activeUrl)
                  res = retry.res
                  data = retry.data
                }
              }

              if (res.ok) return data
            }
          } catch (e) {
            // Refresh failed, proceed to error handling (logout)
          }
        }

        // If still 401 after retry (or if we didn't retry)
        // Check res.status again in case retry overwrote it
        if (res.status === 401) {
          setToken(null)
          if (unauthCallback) {
            unauthCallback()
          }
          // Avoid aggressive redirect for now; let the AuthContext/Guard handle state transitions
        }
      }

      // Re-check ok status after potential retry
      if (!res.ok) {
        // Do not toast for 401s (handled by redirect/state clear) or auth messages
        if (res.status !== 401 && !/invalid token|unauthorized|session invalidated/i.test(message)) {
          toast.error(message)
        }
        const error = new Error(message)
        error.status = res.status
        error.data = data
        throw error
      }
      return data
    }
    return data
  } catch (err) {
    if (!err.status) {
      // toast.error(err.message || 'Network error')
    }
    throw err
  }
}

export function logout() {
  return authFetch('/api/auth/logout', { method: 'POST' })
    .catch(() => ({ ok: false }))
    .finally(() => {
      setToken(null)
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    })
}

// Explicit refresh (call on app boot).
// Note: /refresh-token no longer requires CSRF (the httpOnly refreshToken cookie
// is itself CSRF-safe since attackers can't read it; we removed the double-submit
// requirement to avoid the 500→403 cascade caused by /csrf failing on cold start).
export async function refreshToken() {
  const r = await fetch(`${BASE}/api/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // sends the httpOnly refreshToken cookie
    body: JSON.stringify({}),
  })

  const data = await r.json().catch(() => ({}))
  if (r.ok && data.token) {
    setToken(data.token)
    return { token: data.token, user: data.user }
  }
  const err = new Error(data.error || 'Refresh failed')
  err.status = r.status
  throw err
}

// Auth endpoints
export function login(email, password, hospitalSlug) {
  return authFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, hospitalSlug }),
  })
}

export function register(name, email, password, hospitalSlug) {
  return authFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, hospitalSlug }),
  })
}

export function forgotPassword(email) {
  return fetch(`${BASE}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = data.error || 'Request failed'
      toast.error(message)
      const error = new Error(message)
      error.status = res.status
      error.data = data
      throw error
    }
    return data
  })
}

export function resetPassword(email, token, password) {
  return fetch(`${BASE}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token, password })
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = data.error || 'Request failed'
      toast.error(message)
      const error = new Error(message)
      error.status = res.status
      error.data = data
      throw error
    }
    // If a token is returned, set it like a login
    if (data.token) {
      setToken(data.token)
    }
    return data
  })
}

export function me() {
  return authFetch('/api/auth/me')
}

export function updateMe(payload) {
  return authFetch('/api/auth/me', { method: 'PUT', body: JSON.stringify(payload) })
}

export function changePassword(currentPassword, newPassword) {
  return authFetch('/api/auth/change-password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

// Data endpoints
export function getSummary() {
  return authFetch('/api/summary')
}

export function getWeeklySales() {
  return authFetch('/api/sales/weekly')
}

export function getDailySales() {
  return authFetch('/api/sales/daily')
}

export function getInventory() {
  return authFetch('/api/inventory')
}

export function getPurchases() {
  return authFetch('/api/purchases')
}

// Medicines
export function listMedicines(params = {}) {
  const qs = new URLSearchParams(cleanParams(params)).toString()
  return authFetch(`/api/medicines${qs ? `?${qs}` : ''}`)
}
export function createMedicine(payload) {
  return authFetch('/api/medicines', { method: 'POST', body: JSON.stringify(payload) })
}
export function updateMedicine(id, payload) {
  return authFetch(`/api/medicines/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}
export function deleteMedicine(id) {
  return authFetch(`/api/medicines/${id}`, { method: 'DELETE' })
}

// Suppliers
export function listSuppliers(q) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : ''
  return authFetch(`/api/suppliers${qs}`)
}
export function createSupplier(payload) {
  return authFetch('/api/suppliers', { method: 'POST', body: JSON.stringify(payload) })
}
export function updateSupplier(id, payload) {
  return authFetch(`/api/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}
export function deleteSupplier(id) {
  return authFetch(`/api/suppliers/${id}`, { method: 'DELETE' })
}

// Purchases
export function listPurchases() {
  return authFetch('/api/purchases')
}
export function createPurchase(payload) {
  return authFetch('/api/purchases', { method: 'POST', body: JSON.stringify(payload) })
}

// Invoices
export function listInvoices(params = {}) {
  const qs = new URLSearchParams(cleanParams(params)).toString()
  return authFetch(`/api/invoices${qs ? `?${qs}` : ''}`)
}
export function listPlanReceipts() {
  return authFetch('/api/plan-receipts')
}
export function getInvoice(id) {
  return authFetch(`/api/invoices/${id}`)
}
export function createInvoice(payload) {
  return authFetch('/api/invoices', { method: 'POST', body: JSON.stringify(payload) })
}
export function listMyInvoices() {
  return authFetch('/api/invoices/my')
}
export function hideInvoice(id) {
  return authFetch(`/api/invoices/${id}/hide`, { method: 'PATCH' })
}
export function createMyInvoice(items) {
  return authFetch('/api/invoices/my', { method: 'POST', body: JSON.stringify({ items }) })
}
export function getInvoicePdf(id) {
  return fetch(`${API_BASE}/api/invoices/${id}/pdf`, {
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    }
  }).then(res => {
    if (!res.ok) throw new Error('Failed to fetch PDF')
    return res.blob()
  })
}
// Payments (Razorpay link creation + check)
export function createPaymentLink(payload) {
  return authFetch('/api/payments/razorpay/create-link', { method: 'POST', body: JSON.stringify(payload) })
}
export function checkPaymentLink(linkId) {
  return authFetch(`/api/payments/razorpay/check/${linkId}`)
}
// Razorpay Checkout order + verify endpoints
export function createRazorpayOrder(paymentRequestId) {
  return authFetch('/api/payments/razorpay/create-order', { method: 'POST', body: JSON.stringify({ paymentRequestId }) })
}
export function verifyRazorpayPayment(payload) {
  return authFetch('/api/payments/razorpay/verify-payment', { method: 'POST', body: JSON.stringify(payload) })
}

// Reports
export function lowStock(threshold = 10) {
  return authFetch(`/api/reports/low-stock?threshold=${threshold}`)
}
export function expirySoon(days = 30) {
  return authFetch(`/api/reports/expiry?days=${days}`)
}
export function salesSummary() {
  return authFetch('/api/reports/sales-summary')
}
export function salesMonthly(params = '') {
  const cleaned = cleanParams(params)
  const qs = typeof cleaned === 'string' ? cleaned : new URLSearchParams(cleaned).toString()
  return authFetch(`/api/reports/sales-monthly${qs ? (qs.startsWith('?') ? qs : '?' + qs) : ''}`)
}
export function stockFull() {
  return authFetch('/api/reports/stock-full')
}
export function expirySoonExact(days = 4) {
  return authFetch(`/api/reports/expiry-soon?days=${days}`)
}

// Dashboard endpoints
export function dashboardSummary() {
  return authFetch('/api/reports/dashboard-summary')
}

export function salesLast7() {
  return authFetch('/api/reports/sales-last-7')
}

// Doctor dashboard metrics
export function doctorDashboard() {
  return authFetch('/api/reports/doctor-dashboard')
}

// Appointments & Availability
export function listDoctors(params = {}) {
  const qs = new URLSearchParams(cleanParams(params)).toString()
  return authFetch(`/api/doctors${qs ? `?${qs}` : ''}`)
}
export function createDoctor(payload) { return authFetch('/api/doctors', { method: 'POST', body: JSON.stringify(payload) }) }
export function updateDoctor(id, payload) { return authFetch(`/api/doctors/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) }
export function deleteDoctor(id, opts = {}) {
  const qs = opts && opts.hard ? '?hard=true' : ''
  return authFetch(`/api/doctors/${id}${qs}`, { method: 'DELETE' })
}

export function getAvailability(doctorId) {
  return authFetch(`/api/availability/${doctorId}`)
}

export function setAvailability(doctorId, payload) {
  return authFetch(`/api/availability/${doctorId}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function availabilityDashboard() {
  return authFetch('/api/availability')
}

export function listAppointments(params = {}) {
  const qs = new URLSearchParams(cleanParams(params)).toString()
  return authFetch(`/api/appointments${qs ? `?${qs}` : ''}`)
}

export function listPatientsWithAppointments(params = {}) {
  const qs = new URLSearchParams(cleanParams(params)).toString()
  return authFetch(`/api/appointments/patients${qs ? `?${qs}` : ''}`)
}

export function listAppointmentsByPatient(patientId) {
  const qs = new URLSearchParams({ patientId }).toString()
  return authFetch(`/api/appointments/by-patient?${qs}`)
}

export function listDoctorPatients() {
  return authFetch('/api/appointments/doctor-patients')
}

export function getSlots(doctorId, date) {
  const qs = new URLSearchParams({ doctorId, date }).toString()
  return authFetch(`/api/appointments/slots?${qs}`)
}

export function getSlotsAndQueue(doctorId, date) {
  const qs = new URLSearchParams({ doctorId, date }).toString()
  return authFetch(`/api/appointments/slots-and-queue?${qs}`)
}

export function getAppointment(id) { return authFetch(`/api/appointments/${id}`) }

export function createAppointment(payload) {
  // Accept either plain object or FormData. If object, send JSON; if FormData, send multipart.
  if ((typeof FormData !== 'undefined') && (payload instanceof FormData)) {
    return authFetch('/api/appointments', { method: 'POST', body: payload })
  }
  return authFetch('/api/appointments', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateAppointment(id, payload) {
  return authFetch(`/api/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function cancelAppointment(id) {
  return authFetch(`/api/appointments/${id}`, { method: 'DELETE' })
}

export function getMyAppointments() {
  return authFetch('/api/appointments/mine')
}

export function hideAppointment(id) {
  return authFetch(`/api/appointments/hide/${id}`, { method: 'PATCH' })
}

// Staff
export function listStaff(params = {}) {
  const qs = new URLSearchParams(cleanParams(params)).toString();
  return authFetch(`/api/staff${qs ? `?${qs}` : ''}`);
}
export function createStaff(payload) {
  return authFetch('/api/staff', { method: 'POST', body: JSON.stringify(payload) });
}
export function updateStaff(id, payload) {
  return authFetch(`/api/staff/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export function deleteStaff(id) {
  return authFetch(`/api/staff/${id}`, { method: 'DELETE' });
}

// Wards
export function listWards() {
  return authFetch('/api/wards');
}
export function createWard(payload) {
  return authFetch('/api/wards', { method: 'POST', body: JSON.stringify(payload) });
}
export function listBeds(wardId) {
  return authFetch(`/api/wards/${wardId}/beds`);
}
export function createBed(wardId, payload) {
  return authFetch(`/api/wards/${wardId}/beds`, { method: 'POST', body: JSON.stringify(payload) });
}
export function createBedsBulk(wardId, beds) {
  return authFetch(`/api/wards/${wardId}/beds/bulk`, { method: 'POST', body: JSON.stringify({ beds }) });
}
export function allocateBed(wardId, payload) {
  return authFetch(`/api/wards/${wardId}/allocate`, { method: 'POST', body: JSON.stringify(payload) });
}

export function getWardHistory(wardId) {
  return authFetch(`/api/wards/${wardId}/history`);
}

// Patients
export function listPatients(params = {}) {
  const qs = new URLSearchParams(cleanParams(params)).toString();
  return authFetch(`/api/patients${qs ? `?${qs}` : ''}`);
}
export function getPatient(id) {
  return authFetch(`/api/patients/${id}`);
}
export function getPatientProfile(id) {
  return authFetch(`/api/patients/${id}/profile`);
}
export function createPatient(payload) {
  return authFetch('/api/patients', { method: 'POST', body: JSON.stringify(payload) });
}
export function updatePatient(id, payload) {
  return authFetch(`/api/patients/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export function deletePatient(id) {
  return authFetch(`/api/patients/${id}`, { method: 'DELETE' });
}
export function uploadPatientReport(id, formData) {
  return fetch(`${BASE}/api/patients/${id}/reports`, {
    method: 'POST',
    body: formData,
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error || 'Request failed';
      toast.error(message);
      const error = new Error(message);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  });
}
// Patient self endpoints
export function getMyPatient() {
  return authFetch('/api/patients/me');
}
export function listMyReports() {
  return authFetch('/api/patients/me/reports');
}
export function uploadMyReport(formData) {
  return fetch(`${BASE}/api/patients/me/reports`, {
    method: 'POST',
    body: formData,
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { throw new Error(data.error || 'Upload failed') }
    return data
  })
}
export function updateMyPatient(payload) {
  return authFetch('/api/patients/me', { method: 'PUT', body: JSON.stringify(payload) })
}
export function uploadMyAvatar(formData) {
  return fetch(`${BASE}/api/patients/me/avatar`, {
    method: 'POST',
    body: formData,
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    }
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error || 'Upload failed';
      toast.error(message);
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  })
}
export function uploadMyReportsMulti(formData) {
  return fetch(`${BASE}/api/patients/me/reports/multi`, {
    method: 'POST',
    body: formData,
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    }
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data.error || 'Upload failed';
      toast.error(message);
      const err = new Error(message);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  })
}
export function deleteMyReport(reportId) {
  return authFetch(`/api/patients/me/reports/${reportId}`, { method: 'DELETE' })
}
export function assignBedToPatient(patientId, bedId) {
  return authFetch(`/api/patients/${patientId}/assign-bed`, { method: 'POST', body: JSON.stringify({ bedId }) });
}
export function dischargePatient(id, payload) {
  return authFetch(`/api/patients/${id}/discharge`, { method: 'POST', body: JSON.stringify(payload) });
}

// Prescriptions
export function createPrescription(payload) {
  return authFetch('/api/prescriptions', { method: 'POST', body: JSON.stringify(payload) });
}
export function listDoctorPrescriptions() {
  return authFetch('/api/prescriptions/doctor')
}
export function getPrescriptionsForPatient(patientId) {
  return authFetch(`/api/prescriptions/patient/${patientId}`);
}
export function getMyPrescriptions() {
  return authFetch('/api/prescriptions/mine');
}
export function getPrescription(id) {
  return authFetch(`/api/prescriptions/${id}`);
}

export function createPaymentFromPrescription(id) {
  return authFetch(`/api/prescriptions/${id}/create-payment`, { method: 'POST' })
}
export function hidePrescription(id) {
  return authFetch(`/api/prescriptions/${id}/hide`, { method: 'PATCH' })
}
export function listPrescriptions() {
  return authFetch('/api/prescriptions');
}
export function updatePrescriptionStatus(id, status) {
  return authFetch(`/api/prescriptions/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
}
export function issuePrescription(id) {
  return authFetch(`/api/prescriptions/${id}/issue`, { method: 'POST' });
}
export function emailPrescription(id, payload) {
  return authFetch(`/api/prescriptions/${id}/email`, { method: 'POST', body: JSON.stringify(payload || {}) });
}

// Autogenerate prescription draft (uses auth token)
export function autogenPrescription(payload) {
  return authFetch('/api/prescriptions/autogen', { method: 'POST', body: JSON.stringify(payload || {}) })
}

export function updatePrescription(id, payload) {
  return authFetch(`/api/prescriptions/${id}`, { method: 'PUT', body: JSON.stringify(payload || {}) })
}

// Shifts
export function listShifts() {
  return authFetch('/api/shifts');
}
export function createShift(payload) {
  return authFetch('/api/shifts', { method: 'POST', body: JSON.stringify(payload) });
}
export function updateShift(id, payload) {
  return authFetch(`/api/shifts/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export function deleteShift(id) {
  return authFetch(`/api/shifts/${id}`, { method: 'DELETE' });
}

// Queue (token system)
export function listQueue(params) {
  const qs = new URLSearchParams(cleanParams(params)).toString();
  return authFetch(`/api/queue${qs ? `?${qs}` : ''}`);
}
export function postQueueMessage(id, payload) {
  return authFetch(`/api/queue/${id}/message`, { method: 'POST', body: JSON.stringify(payload) })
}
export function setDoctorPresence(doctorId, payload) {
  return authFetch(`/api/doctors/${doctorId}/presence`, { method: 'PUT', body: JSON.stringify(payload) })
}
export function issueQueueToken(payload) {
  return authFetch('/api/queue', { method: 'POST', body: JSON.stringify(payload) });
}
export function updateQueueToken(id, payload) {
  return authFetch(`/api/queue/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}
export function callNextToken(payload) {
  return authFetch('/api/queue/call-next', { method: 'POST', body: JSON.stringify(payload) });
}

// Patient-facing queue helpers
export function getMyQueue(params = {}) {
  const qs = new URLSearchParams(cleanParams(params)).toString()
  return authFetch(`/api/queue/my${qs ? `?${qs}` : ''}`)
}
export function joinQueue(payload) {
  return authFetch('/api/queue/join', { method: 'POST', body: JSON.stringify(payload) })
}
export function payQueueToken(id, payload) {
  return authFetch(`/api/queue/${id}/pay`, { method: 'POST', body: JSON.stringify(payload) })
}

// Attendance
export function listAttendance(params) {
  const qs = new URLSearchParams(cleanParams(params)).toString();
  return authFetch(`/api/attendance${qs ? `?${qs}` : ''}`);
}
export function markAttendance(payload) {
  return authFetch('/api/attendance', { method: 'POST', body: JSON.stringify(payload) });
}

// Doctor Attendance (self-service)
export function listDoctorAttendance(params) {
  const qs = new URLSearchParams(cleanParams(params || {})).toString();
  return authFetch(`/api/doctor-attendance${qs ? `?${qs}` : ''}`);
}
export function markDoctorAttendance(payload) {
  return authFetch('/api/doctor-attendance', { method: 'POST', body: JSON.stringify(payload) });
}

// Leaves
export function listLeaves(params) {
  const qs = new URLSearchParams(cleanParams(params)).toString();
  return authFetch(`/api/leaves${qs ? `?${qs}` : ''}`);
}
export function createLeave(payload) {
  return authFetch('/api/leaves', { method: 'POST', body: JSON.stringify(payload) });
}
export function updateLeave(id, payload) {
  return authFetch(`/api/leaves/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

// Prescription Templates
export function listPrescriptionTemplates() {
  return authFetch('/api/prescription-templates');
}
export function createPrescriptionTemplate(payload) {
  return authFetch('/api/prescription-templates', { method: 'POST', body: JSON.stringify(payload) });
}
export function updatePrescriptionTemplate(id, payload) {
  return authFetch(`/api/prescription-templates/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}
export function deletePrescriptionTemplate(id) {
  return authFetch(`/api/prescription-templates/${id}`, { method: 'DELETE' });
}

// Public
export function listPublicDoctors(slug) {
  // Pass hospitalSlug so backend can identify the right tenant
  const qs = slug ? `?slug=${encodeURIComponent(slug)}` : ''
  return fetch(`${BASE}/public/doctors${qs}`).then(r => r.json());
}
// FAQs
export function listFaqs(role) {
  const qs = role ? `?role=${encodeURIComponent(role)}` : ''
  return fetch(`${BASE}/api/faqs${qs}`).then(async res => {
    if (!res.ok) throw new Error('Failed to list FAQs')
    return res.json()
  })
}
export function createFaq(payload) { return authFetch('/api/faqs', { method: 'POST', body: JSON.stringify(payload) }) }
export function updateFaq(id, payload) { return authFetch(`/api/faqs/${id}`, { method: 'PUT', body: JSON.stringify(payload) }) }
export function deleteFaq(id) { return authFetch(`/api/faqs/${id}`, { method: 'DELETE' }) }
export function submitDoctorApplication(payload) {
  return fetch(`${BASE}/public/doctor-apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(async (res) => {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { throw new Error(data.error || 'Request failed') }
    return data
  })
}

export function getPublicTenant(slug) {
  return fetch(`${BASE}/public/tenant/${encodeURIComponent(slug)}`).then(async (res) => {
    if (!res.ok) throw await res.json().catch(() => ({ error: 'Fail' }))
    return res.json()
  })
}

export function getPublicHospitals() {
  return fetch(`${BASE}/public/hospitals`).then(async (res) => {
    if (!res.ok) throw await res.json().catch(() => ({ error: 'Fail' }))
    return res.json()
  })
}

// Contact / Queries
export function submitContactQuery(payload) {
  return fetch(`${BASE}/public/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(async (res) => {
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { throw new Error(data.error || 'Request failed') }
    return data
  })
}
export function listQueries(params = {}) {
  const qs = new URLSearchParams(cleanParams(params)).toString()
  return authFetch(`/api/queries${qs ? `?${qs}` : ''}`)
}
export function updateQueryStatus(id, status) {
  return authFetch(`/api/queries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

// Prescription admin authorization
export function approvePrescription(id) {
  return authFetch(`/api/prescriptions/${id}/approve`, { method: 'POST' });
}
export function rejectPrescription(id) {
  return authFetch(`/api/prescriptions/${id}/reject`, { method: 'POST' });
}

// Doctor Applications (admin)
export function listDoctorApplications() {
  return authFetch('/api/doctor-applications');
}
export function approveDoctorApplication(id) {
  return authFetch(`/api/doctor-applications/${id}/approve`, { method: 'POST' });
}
export function rejectDoctorApplication(id) {
  return authFetch(`/api/doctor-applications/${id}/reject`, { method: 'POST' });
}

// Tenant helpers
export async function getMyTenant() {
  try {
    return await authFetch('/api/tenants/me')
  } catch (err) {
    // If tenant not found for current user, return a neutral shape instead of throwing
    if (err && err.status === 404) {
      return { tenant: null }
    }
    throw err
  }
}
// Create a subadmin under a tenant
export function createSubadmin(tenantId, payload) {
  return authFetch(`/api/tenants/${tenantId}/subadmins`, { method: 'POST', body: JSON.stringify(payload) })
}

// List subadmins for a tenant (optional search q)
export function listSubadmins(tenantId, q) {
  const url = `/api/tenants/${tenantId}/subadmins${q ? `?q=${encodeURIComponent(q)}` : ''}`
  return authFetch(url)
}

// Delete a subadmin
export function deleteSubadmin(tenantId, subadminId) {
  return authFetch(`/api/tenants/${tenantId}/subadmins/${subadminId}`, { method: 'DELETE' })
}

// Update a subadmin (name, phone, designation, features)
export function updateSubadmin(tenantId, subadminId, payload) {
  return authFetch(`/api/tenants/${tenantId}/subadmins/${subadminId}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

// Resend login credentials email to a subadmin
export function resendSubadminCredentials(tenantId, subadminId) {
  return authFetch(`/api/tenants/${tenantId}/subadmins/${subadminId}/resend-credentials`, { method: 'POST' })
}
