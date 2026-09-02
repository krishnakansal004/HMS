import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// HMS Frontend v2 — targets the live Postgres-backed API (19 route groups
// mounted in backend/src/app.js). See README.md for scope notes.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: { environment: 'jsdom' },
  server: {
    port: 5173,
    proxy: {
      // Same-origin in dev so the httpOnly refresh cookie and CORS behave
      // exactly like production. Point this at wherever `npm run dev` for
      // the backend is actually listening.
      '/api': {
        target: process.env.VITE_BACKEND_ORIGIN || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
