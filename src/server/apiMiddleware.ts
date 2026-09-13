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
      let profession = query.profession as string
      let gender = query.gender as string

      if (!layer || !year) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Missing layer or year parameter' }))
        return
      }

      let target_layer: ParsedDataLayer | undefined = registry.layers[layer]
      if (!target_layer && layer.includes('.')) {
        let parent_id = layer.split('.')[0]
        let parent = registry.layers[parent_id]
        if (parent && parent.sub_layers)
          target_layer = parent.sub_layers.find((arg0_sub) => arg0_sub.id === layer)
      }
      let cache_key: string

      if (target_layer && target_layer.variable_selectors) {
        let prof = profession || 'agriculture'
        let gen = gender || 't'
        cache_key = `${layer}:${prof}:${gen}:${year}`
      } else {
        cache_key = `${layer}:${year}`
      }

      let file_path = registry.file_cache.get(cache_key)

      //Fallback lookup: try basic layer:year or layer:agriculture:t:year
      if (!file_path && cache_key !== `${layer}:${year}`) {
        file_path = registry.file_cache.get(`${layer}:${year}`)
      }
      if (!file_path) {
        file_path = registry.file_cache.get(`${layer}:agriculture:t:${year}`)
      }

      if (!file_path || !fs.existsSync(file_path)) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            cache_key,
            error: `GeoPNG raster file not found for layer: ${layer}, year: ${year}`,
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

    //Route 5: POST /api/export/video
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
