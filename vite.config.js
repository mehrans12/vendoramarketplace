import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: [
      'vendoramarketplace-production.up.railway.app',
      '.up.railway.app',
      'localhost',
      '127.0.0.1'
    ],
    host: '0.0.0.0'
  },
  server: {
    allowedHosts: [
      'vendoramarketplace-production.up.railway.app',
      '.up.railway.app',
      'localhost',
      '127.0.0.1'
    ],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001/vendora-marketplace/us-central1/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'react-vendor';
            }
            if (id.includes('firebase')) {
              return 'firebase-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'ui-vendor';
            }
            return 'vendor';
          }
        }
      }
    }
  }
})
