import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'
import JSON5 from 'json5'
import { createApiMiddleware } from './core/server/api_middleware.ts'
import { loadAndParseLayers } from './core/server/layer_parser.ts'

function dataviewBackendPlugin(): Plugin {
  return {
    name: 'dataview-backend',
    configureServer(server) {
      server.middlewares.use(
        createApiMiddleware({
          configDir: path.resolve(import.meta.dirname, './common'),
          exportsDir: path.resolve(import.meta.dirname, './exports'),
        })
      )
    },
    configurePreviewServer(server) {
      server.middlewares.use(
        createApiMiddleware({
          configDir: path.resolve(import.meta.dirname, './common'),
          exportsDir: path.resolve(import.meta.dirname, './exports'),
        })
      )
    },
    handleHotUpdate({ file, server }) {
      let normalized_file = file.replace(/\\/g, '/')

      //Check ignored patterns that should never trigger HMR or reload
      if (
        normalized_file.includes('/data/') ||
        normalized_file.includes('/exports/') ||
        normalized_file.includes('/.agents/') ||
        normalized_file.includes('/docs/') ||
        normalized_file.includes('/tests/')
      ) {
        return []
      }

      //Handle common/ and localisation/ hot updates
      if (normalized_file.includes('/common/') || normalized_file.includes('/localisation/')) {
        let hot_channel = server.hot || (server as any).ws

        //1. Layers update: common/layers/ (including filepath_defines.json5 and individual layer configs)
        if (normalized_file.includes('/common/layers/')) {
          try {
            let config_dir = path.resolve(import.meta.dirname, './common')
            let registry = loadAndParseLayers(config_dir)
            if (hot_channel) {
              hot_channel.send({
                type: 'custom',
                event: 'dataview:layers-update',
                data: {
                  layers: registry.layers,
                  total: Object.keys(registry.layers).length,
                },
              })
            }
          } catch (arg0_err) {
            console.error('[HMR] Error reloading layers:', arg0_err)
          }
          return []
        }

        //2. Localisation update: localisation/*.json5
        if (normalized_file.includes('/localisation/') && normalized_file.endsWith('.json5')) {
          try {
            let raw_content = fs.readFileSync(file, 'utf-8')
            let parsed_dict = JSON5.parse(raw_content)
            let base_name = path.basename(file, '.json5')
            let normalized_base = base_name.toLowerCase()
            let locale_key = (normalized_base === 'en_gb' || normalized_base === 'en-gb') ? 'en-GB' : normalized_base

            if (hot_channel) {
              hot_channel.send({
                type: 'custom',
                event: 'dataview:config-update',
                data: {
                  category: 'localisation',
                  data: parsed_dict,
                  dictionary: parsed_dict,
                  file: normalized_file,
                  locale: locale_key,
                },
              })
            }
          } catch (arg0_err) {
            console.error('[HMR] Error reloading localisation:', arg0_err)
          }
          return []
        }

        //3. Other common configs: panes/info, panes/mapmodes, panes/alerts, timeline/landmarks, theme/theme, map/map, permissions/permissions, optimisation/optimisation
        if (normalized_file.endsWith('.json5')) {
          try {
            let raw_content = fs.readFileSync(file, 'utf-8')
            let parsed_data = JSON5.parse(raw_content)
            let base_name = path.basename(file, '.json5')

            if (hot_channel) {
              hot_channel.send({
                type: 'custom',
                event: 'dataview:config-update',
                data: {
                  category: base_name,
                  data: parsed_data,
                  file: normalized_file,
                },
              })
            }
          } catch (arg0_err) {
            console.error(`[HMR] Error reloading config ${file}:`, arg0_err)
          }
          return []
        }

        //For other files in common, prevent full-page reload
        return []
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 15000,
    strictPort: true,
    host: true,
    allowedHosts: true,
    watch: {
      ignored: [
        '**/data/**',
        '**/exports/**',
        '**/.agents/**',
        '**/docs/**',
        '**/tests/**',
      ],
    },
  },
  preview: {
    port: 15000,
    strictPort: true,
    host: true,
    allowedHosts: true,
  },
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

