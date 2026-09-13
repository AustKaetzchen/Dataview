import fs from 'fs'
import path from 'path'
import url from 'url'
import type { IncomingMessage, ServerResponse } from 'http'
import JSON5 from 'json5'
import { loadAndParseLayers, type LayerRegistryCache, type ParsedDataLayer } from './layerParser.ts'

export interface ApiMiddlewareOptions {
  configDir: string
  exportsDir: string
}

/**
 * Creates Connect/Express compatible HTTP middleware for Vite backend routes.
 *
 * @param {ApiMiddlewareOptions} arg0_options
 *
 * @returns {(req: IncomingMessage, res: ServerResponse, next: () => void) => void}
 */
export const createApiMiddleware = function (arg0_options: ApiMiddlewareOptions) {
  //Convert from parameters
  let options = arg0_options

  //Declare local instance variables
  let breakdown_cache = new Map<string, any>()
  let config_dir = path.resolve(options.configDir)
  let exports_dir = path.resolve(options.exportsDir)
  let permissions_path = path.join(config_dir, 'permissions.json5')
  let registry: LayerRegistryCache

  //Function body
  //Initialise registry
  try {
    registry = loadAndParseLayers(config_dir)
  } catch (arg0_err) {
    console.error('[ApiMiddleware] Error initialising layer registry:', arg0_err)
    registry = {
      file_cache: new Map(),
      layers: {},
      resolved_roots: {},
    }
  }

  //Ensure exports directory exists
  if (!fs.existsSync(exports_dir))
    fs.mkdirSync(exports_dir, { recursive: true })

  //Return statement
  return function (req: IncomingMessage, res: ServerResponse, next: () => void) {
    let parsed_url = url.parse(req.url || '', true)
    let pathname = parsed_url.pathname || ''
    let query = parsed_url.query

    //Route 1: GET /api/layers
    if (pathname === '/layers' || pathname === '/api/layers') {
      try {
        registry = loadAndParseLayers(config_dir)
      } catch (arg0_err) {
        console.error('[ApiMiddleware] Error reloading layer registry:', arg0_err)
      }
      res.setHeader('Content-Type', 'application/json')
      res.statusCode = 200
      res.end(JSON.stringify({ layers: registry.layers, total: Object.keys(registry.layers).length }))
      return
    }

    //Route 2: GET /api/permissions
    if (pathname === '/permissions' || pathname === '/api/permissions') {
      res.setHeader('Content-Type', 'application/json')
      if (fs.existsSync(permissions_path)) {
        try {
          let raw = fs.readFileSync(permissions_path, 'utf-8')
          let parsed = JSON5.parse(raw)
          res.statusCode = 200
          res.end(JSON.stringify(parsed))
          return
        } catch (arg0_e) {
          console.error('[ApiMiddleware] Failed to parse permissions.json5:', arg0_e)
        }
      }
      res.statusCode = 200
      res.end(JSON.stringify({ roles: {}, default_role: 'default' }))
      return
    }

    //Route 3: GET /api/raster/bounding
    if (pathname === '/raster/bounding' || pathname === '/api/raster/bounding') {
      let layer_id = query.layer as string
      let raw_year = parseFloat(query.year as string)

      if (!layer_id || Number.isNaN(raw_year)) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Missing or invalid layer or year parameter' }))
        return
      }

      //Find target layer
      let target_layer: ParsedDataLayer | undefined = registry.layers[layer_id]
      if (!target_layer && layer_id.includes('.')) {
        let parent_id = layer_id.split('.')[0]
        let parent_layer = registry.layers[parent_id]
        if (parent_layer && parent_layer.sub_layers)
          target_layer = parent_layer.sub_layers.find((arg0_sub: ParsedDataLayer) => arg0_sub.id === layer_id)
      }

      if (!target_layer || !target_layer.available_years || target_layer.available_years.length === 0) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: `Layer ${layer_id} not found or has no available years` }))
        return
      }

      let years = target_layer.available_years
      let prev_year = years[0]
      let next_year = years[years.length - 1]
      let t = 0

      if (raw_year <= years[0]) {
        prev_year = years[0]
        next_year = years[0]
        t = 0
      } else if (raw_year >= years[years.length - 1]) {
        prev_year = years[years.length - 1]
        next_year = years[years.length - 1]
        t = 0
      } else {
        for (let i = 0; i < years.length - 1; i++) {
          if (raw_year >= years[i] && raw_year <= years[i + 1]) {
            prev_year = years[i]
            next_year = years[i + 1]
            if (next_year > prev_year)
              t = (raw_year - prev_year)/(next_year - prev_year)
            else
              t = 0
            break
          }
        }
      }

      res.setHeader('Content-Type', 'application/json')
      res.statusCode = 200
      res.end(
        JSON.stringify({
          layer: layer_id,
          next_year,
          prev_year,
          t,
          target_year: raw_year,
        })
      )
      return
    }

    //Route 4: GET /api/raster/file
    if (pathname === '/raster/file' || pathname === '/api/raster/file') {
      let layer = query.layer as string
      let year = query.year as string

      if (!layer || !year) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Missing layer or year parameter' }))
        return
      }

      let file_path: string | undefined = undefined
      let target_layer: ParsedDataLayer | undefined = registry.layers[layer]
      if (!target_layer && layer.includes('.')) {
        let parent_id = layer.split('.')[0]
        let parent = registry.layers[parent_id]
        if (parent && parent.sub_layers)
          target_layer = parent.sub_layers.find((arg0_sub) => arg0_sub.id === layer)
      }

      //Collect selector query parameters
      let selector_param_keys = Object.keys(query).filter(
        (arg0_k) => arg0_k !== 'layer' && arg0_k !== 'year' && typeof query[arg0_k] === 'string'
      ).sort()

      //Strategy 1: Canonical sorted key (e.g. layer:indicator=net_wealth:1950)
      if (selector_param_keys.length > 0) {
        let combo_str = selector_param_keys.map((arg0_k) => `${arg0_k}=${query[arg0_k]}`).join(':')
        file_path = registry.file_cache.get(`${layer}:${combo_str}:${year}`)
      }

      //Strategy 2: Values-only key (e.g. layer:net_wealth:1950)
      if (!file_path && selector_param_keys.length > 0) {
        let vals_str = selector_param_keys.map((arg0_k) => query[arg0_k]).join(':')
        file_path = registry.file_cache.get(`${layer}:${vals_str}:${year}`)
      }

      //Strategy 3: Legacy positional (e.g. layer:profession:gender:1950)
      if (!file_path && (query.profession || query.gender)) {
        let prof = (query.profession as string) || 'agriculture'
        let gen = (query.gender as string) || 't'
        file_path = registry.file_cache.get(`${layer}:${prof}:${gen}:${year}`)
      }

      //Strategy 4: Single parameter fallback
      if (!file_path && selector_param_keys.length === 1) {
        let val = query[selector_param_keys[0]] as string
        file_path = registry.file_cache.get(`${layer}:${val}:${year}`)
      }

      //Strategy 5: Default layer:year key
      if (!file_path) {
        file_path = registry.file_cache.get(`${layer}:${year}`)
      }

      //Strategy 6: Legacy default fallback
      if (!file_path) {
        file_path = registry.file_cache.get(`${layer}:agriculture:t:${year}`)
      }

      if (!file_path || !fs.existsSync(file_path)) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            error: `GeoPNG raster file not found for layer: ${layer}, year: ${year}`,
            query,
          })
        )
        return
      }

      try {
        let stats = fs.statSync(file_path)
        let etag = `"${layer}-${year}-${stats.mtimeMs}"`

        if (req.headers['if-none-match'] === etag) {
          res.statusCode = 304
          res.end()
          return
        }

        res.statusCode = 200
        res.setHeader('Content-Type', 'image/png')
        res.setHeader('Content-Length', stats.size)
        res.setHeader('ETag', etag)
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')

        let stream = fs.createReadStream(file_path)
        stream.pipe(res)
        return
      } catch (arg0_err) {
        console.error('[ApiMiddleware] Failed to stream raster file:', arg0_err)
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Internal server error streaming raster file' }))
        return
      }
    }

    //Route 5: GET /api/raster/breakdown
    if (pathname === '/raster/breakdown' || pathname === '/api/raster/breakdown') {
      let layer = (query.layer as string) || 'age_sex'
      let year = parseInt(query.year as string, 10) || 1950
      let raw_x = query.x !== undefined ? parseInt(query.x as string, 10) : undefined
      let raw_y = query.y !== undefined ? parseInt(query.y as string, 10) : undefined

      let cache_key = `${layer}:${year}:${raw_x ?? 'all'}:${raw_y ?? 'all'}`
      if (breakdown_cache.has(cache_key)) {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(breakdown_cache.get(cache_key)))
        return
      }

      if (layer === 'age_sex') {
        let age_ids = ['00', '01', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', '60', '65', '70', '75', '80']
        let female_map: Record<string, number> = {}
        let male_map: Record<string, number> = {}

        //Generate demographic transition cohort proportions based on historical year
        for (let i = 0; i < age_ids.length; i++) {
          let cid = age_ids[i]
          let base_taper = Math.exp(-i*0.088)
          if (year >= 1950 && i >= 4 && i <= 11)
            base_taper *= 1.22
          let m_val = Math.max(0.01, 100*base_taper*(1.025 - i*0.005))
          let f_val = Math.max(0.01, 100*base_taper*(0.975 + i*0.007))
          male_map[cid] = m_val
          female_map[cid] = f_val
        }

        let result = {
          female: female_map,
          layer,
          male: male_map,
          x: raw_x,
          y: raw_y,
          year,
        }
        breakdown_cache.set(cache_key, result)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(result))
        return
      }

      if (layer.includes('profession')) {
        let sectors_map: Record<string, number> = {}
        let is_pct = !layer.includes('total')

        if (is_pct) {
          if (year <= 1800) {
            sectors_map = {
              agriculture: 68.5,
              informal_labour: 8.2,
              manufacturing: 9.4,
              not_in_work: 5.0,
              services: 8.9,
            }
          } else if (year <= 1950) {
            let t = (year - 1800)/150
            sectors_map = {
              agriculture: 68.5*(1 - t) + 22.0*t,
              informal_labour: 8.2*(1 - t) + 12.5*t,
              manufacturing: 9.4*(1 - t) + 32.5*t,
              not_in_work: 5.0*(1 - t) + 7.0*t,
              services: 8.9*(1 - t) + 26.0*t,
            }
          } else {
            let t = Math.min(1, (year - 1950)/75)
            sectors_map = {
              agriculture: 22.0*(1 - t) + 4.5*t,
              informal_labour: 12.5*(1 - t) + 9.5*t,
              manufacturing: 32.5*(1 - t) + 18.0*t,
              not_in_work: 7.0*(1 - t) + 6.5*t,
              services: 26.0*(1 - t) + 61.5*t,
            }
          }
        } else {
          sectors_map = {
            agriculture: 250000,
            informal_labour: 120000,
            manufacturing: 280000,
            not_in_work: 50000,
            services: 300000,
          }
        }

        let result = {
          layer,
          sectors: sectors_map,
          x: raw_x,
          y: raw_y,
          year,
        }
        breakdown_cache.set(cache_key, result)
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(result))
        return
      }

      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: `Breakdown not supported for layer: ${layer}` }))
      return
    }

    //Route 6: POST /api/export/video
    if ((pathname === '/export/video' || pathname === '/api/export/video') && req.method === 'POST') {
      let body_chunks: Buffer[] = []
      req.on('data', (arg0_chunk) => {
        body_chunks.push(arg0_chunk)
      })

      req.on('end', () => {
        try {
          let raw_body = Buffer.concat(body_chunks).toString('utf-8')
          let payload = JSON.parse(raw_body)
          let filename = payload.filename || `export_${Date.now()}.mp4`
          let base64_data = payload.data as string

          if (!base64_data) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Missing video data in payload' }))
            return
          }

          let out_path = path.join(exports_dir, filename)
          let clean_base64 = base64_data.replace(/^data:[^;]+;base64,/, '')
          fs.writeFileSync(out_path, Buffer.from(clean_base64, 'base64'))

          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              filename,
              message: 'Video export successfully saved to exports directory.',
              path: out_path,
              success: true,
            })
          )
        } catch (arg0_e) {
          console.error('[ApiMiddleware] Failed to save video export:', arg0_e)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Failed to process video export payload' }))
        }
      })
      return
    }

    //Continue to next middleware
    next()
  }
}
