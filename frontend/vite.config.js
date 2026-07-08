/* global process */
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(),],
  server: {
    // Allow configuring backend URL via env var `BACKEND_URL` to avoid hard-coded port mismatches.
    proxy: (() => {
      // Default backend for local dev. Backend server listens on PORT env or 4000 by default.
      // If your backend runs on a different port, set `BACKEND_URL` or `VITE_API_URL` when running `npm run dev`.
      const backend = process.env.BACKEND_URL || process.env.VITE_API_URL || 'http://127.0.0.1:4000'
      return {
        '/api': { target: backend, changeOrigin: true },
        '/public': { target: backend, changeOrigin: true },
        '/uploads': { target: backend, changeOrigin: true },
      }
    })(),
  },
})
