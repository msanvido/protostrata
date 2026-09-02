import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/health': 'http://127.0.0.1:8000',
      '/proceedings': 'http://127.0.0.1:8000',
      '/projects': 'http://127.0.0.1:8000',
      '/obligations': 'http://127.0.0.1:8000',
      '/analyze': 'http://127.0.0.1:8000',
      '/actions': 'http://127.0.0.1:8000',
      '/expert_review': 'http://127.0.0.1:8000',
      '/audit': 'http://127.0.0.1:8000',
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  }
})
