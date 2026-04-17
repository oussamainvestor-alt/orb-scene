import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to all interfaces so the app is reachable over SSH port forwarding
    // or from another machine on the network (when allowed by firewall).
    host: true,
    port: 5173,
    // Allow ngrok / other tunnel hostnames (avoids "Blocked request" from Vite).
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
  },
})
