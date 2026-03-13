// configures Vite to work with React and sets up a development server with proxy settings for API and image requests. The server will listen on all network interfaces (host: true) and use port 5173. Requests to '/api' will be proxied to 'http://
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/images': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  }
})
