import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'Les Rouleaux de Lime',
        short_name: 'Rouleaux',
        description: 'Gestion de restaurant',
        theme_color: '#FFF8E7',
        background_color: '#FFF8E7',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'https://placehold.co/192x192/0B7A75/FFF/png?text=R',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'https://placehold.co/512x512/0B7A75/FFF/png?text=R',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ],
        screenshots: [
          {
            src: 'https://placehold.co/540x720/FFF8E7/0B7A75/png?text=App+Mobile',
            sizes: '540x720',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Application mobile'
          },
          {
            src: 'https://placehold.co/1280x720/FFF8E7/0B7A75/png?text=App+Desktop',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Application de bureau'
          }
        ]
      }
    })
  ]
})