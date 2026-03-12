import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: 'Reading Manager',
        short_name: 'ReadingManager',
        description: 'A premium app to manage currently reading books, notes, and mind maps offline.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192x192.png', // We'll add a dummy one or let it fail gently on 404 for now
            sizes: '192x192',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
