import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const pagesBase = '/melody-forge/'

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? pagesBase : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    testTimeout: 10_000,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      reporter: ['text', 'html'],
    },
  },
}))
