import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { createApiMiddleware } from './core/server/api_middleware.ts'

function dataviewBackendPlugin(): Plugin {
  return {
    name: 'dataview-backend',
    configureServer(server) {
      server.middlewares.use(
        createApiMiddleware({
          configDir: path.resolve(import.meta.dirname, './config'),
          exportsDir: path.resolve(import.meta.dirname, './exports'),
        })
      )
    },
    configurePreviewServer(server) {
      server.middlewares.use(
        createApiMiddleware({
          configDir: path.resolve(import.meta.dirname, './config'),
          exportsDir: path.resolve(import.meta.dirname, './exports'),
        })
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), dataviewBackendPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './core'),
      '@core': path.resolve(import.meta.dirname, './core'),
      '@common': path.resolve(import.meta.dirname, './common'),
      '@config': path.resolve(import.meta.dirname, './common'),
      'config': path.resolve(import.meta.dirname, './common'),
      '@framework': path.resolve(import.meta.dirname, './core/framework'),
      '@server': path.resolve(import.meta.dirname, './core/server'),
      '@ui': path.resolve(import.meta.dirname, './core/ui'),
      '@localisation': path.resolve(import.meta.dirname, './localisation'),
    },
  },
})

