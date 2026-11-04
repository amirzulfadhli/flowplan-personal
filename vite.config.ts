import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  server: {
    host: '127.0.0.1',
    port: mode === 'desktop' ? 1420 : 5173,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  build: { outDir: mode === 'desktop' ? 'dist-desktop' : 'dist' },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      disable: mode === 'desktop',
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'FlowPlan Personal',
        short_name: 'FlowPlan',
        description: 'Your personal, local-first project workspace',
        theme_color: '#5568d9',
        background_color: '#f6f7fa',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'], navigateFallback: 'index.html' },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
}))
