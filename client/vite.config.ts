/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['e2e/**', 'node_modules/**'],
    setupFiles: './src/test/setup.ts',
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Code splitting: separa vendors pesados en chunks
        // para mejorar caching del navegador y TTFB.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
          if (id.includes('rxdb') || id.includes('dexie')) return 'vendor-rxdb'
          if (id.includes('chart.js') || id.includes('react-chartjs-2')) return 'vendor-charts'
          if (id.includes('tesseract.js')) return 'vendor-tesseract'
          if (id.includes('socket.io-client')) return 'vendor-socketio'
          if (id.includes('animejs')) return 'vendor-anime'
          if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf'
          if (id.includes('xlsx')) return 'vendor-xlsx'
          if (id.includes('html5-qrcode')) return 'vendor-qrcode'
          if (id.includes('@sentry')) return 'vendor-sentry'
          if (id.includes('@tauri-apps')) return 'vendor-tauri'
          if (id.includes('@capacitor')) return 'vendor-capacitor'
          return 'vendor-misc'
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/localhost:3000\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'stockmaster-api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'stockmaster-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 604800 },
            },
          },
        ],
      },
      includeAssets: ['favicon.svg', 'icon-192x192.png', 'icon-512x512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'StockMasterPro — Sistema POS Venezuela',
        short_name: 'StockMasterPro',
        description: 'StockMasterPro POS: offline-first, inventario, ventas, clientes y proveedores con tasa BCV.',
        theme_color: '#0a0a0d',
        background_color: '#0a0a0d',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['business', 'finance', 'retail'],
        screenshots: [
          {
            src: 'screenshot-desktop.png',
            sizes: '1920x1080',
            type: 'image/png',
            form_factor: 'wide',
          },
          {
            src: 'screenshot-mobile.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
          },
        ],
        icons: [
          { src: 'icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})

