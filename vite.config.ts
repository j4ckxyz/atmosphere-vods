import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Atmosphere VODs',
        short_name: 'Atmosphere VODs',
        description:
          'A minimalist glassy video browser for ATmosphereConf 2026 talks.',
        theme_color: '#0a1020',
        background_color: '#060a14',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/plc\.directory\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'plc-directory',
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 16,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
          {
            urlPattern:
              /^https:\/\/[^/]+\/xrpc\/com\.atproto\.repo\.listRecords.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'list-records',
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 24,
                maxAgeSeconds: 60 * 15,
              },
            },
          },
          {
            urlPattern:
              /^https:\/\/public\.api\.bsky\.app\/xrpc\/app\.bsky\.actor\.getProfile.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'bsky-profiles',
              networkTimeoutSeconds: 6,
              expiration: {
                maxEntries: 160,
                maxAgeSeconds: 60 * 60,
              },
            },
          },
          {
            urlPattern:
              /^https:\/\/vod-beta\.stream\.place\/xrpc\/place\.stream\.playback\.getVideoPlaylist.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'playlists',
              networkTimeoutSeconds: 6,
              expiration: {
                maxEntries: 48,
                maxAgeSeconds: 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
})
