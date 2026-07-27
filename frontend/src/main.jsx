import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import './index.css'
import './print.css'
import 'react-toastify/dist/ReactToastify.css'
import { router } from './router'
import { AuthProvider } from './context/AuthContext'
import { ToastContainer } from 'react-toastify'
import ErrorBoundary from './components/common/ErrorBoundary'
import {GoogleOAuthProvider} from "@react-oauth/google"
import './i18n'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        // 403 -> do not retry
        // 401 -> do not retry
        // 500 -> do not retry
        if (error?.status === 403 || error?.status === 401 || error?.status === 500) {
          return false
        }
        return false // Never continuously retry failed requests
      },
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
  },
})

const persister = createSyncStoragePersister({
  storage: window.localStorage,
})

persistQueryClient({
  queryClient,
  persister,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
})

// console.log("GOOGLE_CLIENT_ID:", import.meta.env.VITE_GOOGLE_CLIENT_ID);
// console.log("GOOGLE_CLIENT_SECRET:", import.meta.env.VITE_GOOGLE_CLIENT_SECRET);
createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} future={{ v7_startTransition: true }} />
          <ToastContainer position="top-right" autoClose={4000} newestOnTop closeOnClick pauseOnFocusLoss={false} theme="colored" />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </GoogleOAuthProvider>
)
