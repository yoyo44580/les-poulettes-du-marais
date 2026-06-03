import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const imageExtensions = new Set(['.avif', '.gif', '.jpg', '.jpeg', '.png', '.webp'])

function getPublicImageEntries() {
  const imagesDir = resolve(__dirname, 'public', 'images')

  if (!existsSync(imagesDir)) {
    return []
  }

  return readdirSync(imagesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => imageExtensions.has(name.slice(name.lastIndexOf('.')).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
    .map((name) => `/images/${encodeURIComponent(name)}`)
}

function publicImagesManifestPlugin() {
  return {
    name: 'public-images-manifest',
    configureServer(server) {
      server.middlewares.use('/images-manifest.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ images: getPublicImageEntries() }))
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'images-manifest.json',
        source: JSON.stringify({ images: getPublicImageEntries() }, null, 2),
      })
    },
  }
}

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        adminCommandesOeufs: resolve(__dirname, 'admin-commandes-oeufs.html'),
      },
    },
  },
  plugins: [
    react(),
    publicImagesManifestPlugin(),
    VitePWA({
      registerType: 'prompt',
      workbox: {
        importScripts: ['/push-handler.js'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'poulettes-pages',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 12,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
              precacheFallback: {
                fallbackURL: '/offline.html',
              },
            },
          },
        ],
      },
      manifest: false,
    }),
  ],
})
