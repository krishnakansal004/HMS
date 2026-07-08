import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import './index.css'
import Layout from './components/Layout'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Billing = lazy(() => import('./pages/Billing'))
const Purchases = lazy(() => import('./pages/Purchases'))
const Reports = lazy(() => import('./pages/Reports'))

const Loading = () => (
  <div className="flex items-center justify-center h-screen bg-slate-50/50">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
)

function App() {
  return (
    <Layout>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/purchases" element={<Purchases />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

export default App
