import fs from 'fs'
import path from 'path'
import type { ServerResponse } from 'http'
import { UfDate } from '../lib/ufDate.ts'

export interface HistoricalBorderKeyframe {
  date: string
  label: string
  timestamp?: number
  year: number
}

export interface HistoricalBorderFeature {
  bbox?: [number, number, number, number]
  geometry: {
    coordinates: any
    type: 'Polygon' | 'MultiPolygon'
  }
  id: string
  properties: {
    area?: number
    caplat?: number
    caplong?: number
    capname?: string
    date?: string
    endDate?: string
    endYear?: number
    gwcode?: number
    id: string | number
    keyframes?: HistoricalBorderKeyframe[]
    name: string
    startDate?: string
    startYear?: number
    symbol?: Record<string, any>
    timestamp?: number
    [key: string]: any
  }
  type: 'Feature'
}

export interface HistoricalBordersResponse {
  count: number
  domain: [number, number]
  features: HistoricalBorderFeature[]
  source: 'cshapes' | 'naissance'
  year: number
}

interface NaissanceEntityRecord {
  class_name: string
  id: string
  keyframes: Map<number, [any, any, any]>
  max_ts: number
  min_ts: number
  name?: string
  sorted_timestamps: number[]
}

let cached_cshapes_data: any = null
let cached_cshapes_features: any[] = null as unknown as any[]
let cached_cshapes_keyframes_by_gwcode: Map<number, HistoricalBorderKeyframe[]> = new Map()
let cached_naissance_entities_by_path: Map<string, Map<string, NaissanceEntityRecord>> = new Map()
let detailed_borders_slices = [
  { domain: [-3500, 476], file: '0.476.1.1.naissance' },
  { domain: [476, 1356], file: '1.1356.1.1.naissance' },
  { domain: [1356, 1707], file: '2.1707.1.1.naissance' },
  { domain: [1707, 1815], file: '3.1815.1.1.naissance' },
  { domain: [1815, 1914], file: '4.1914.1.1.naissance' },
  { domain: [1914, 1936], file: '5.1936.1.1.naissance' },
  { domain: [1936, 1946], file: '6.1946.1.1.naissance' },
  { domain: [1946, 1991], file: '7.1991.1.1.naissance' },
  { domain: [1991, 2026], file: '8.2026.1.1.naissance' },
]
let in_memory_slice_lru: Map<string, HistoricalBorderFeature[]> = new Map()
let max_lru_entries = 50

/**
 * Computes a 2D bounding box [minLng, minLat, maxLng, maxLat] for a GeoJSON geometry.
 *
 * @param {any} arg0_geometry
 *
 * @returns {[number, number, number, number]}
 */
export const computeGeometryBBox = function (arg0_geometry: any): [number, number, number, number] {
  //Convert from parameters
  let geometry = arg0_geometry

  //Declare local instance variables
  let max_x = -Infinity
  let max_y = -Infinity
  let min_x = Infinity
  let min_y = Infinity
  let scan_coords: (arg0_coords: any) => void

  //Function body
  scan_coords = function (arg0_coords: any) {
    let coords = arg0_coords
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      let x = coords[0]
      let y = coords[1]
      if (x < min_x)
        min_x = x
      if (x > max_x)
        max_x = x
      if (y < min_y)
        min_y = y
      if (y > max_y)
        max_y = y
      return
    }
    for (let i = 0; i < coords.length; i++)
      scan_coords(coords[i])
  }

  if (geometry && geometry.coordinates)
    scan_coords(geometry.coordinates)

  //Return statement
  return [
    min_x === Infinity ? -180 : min_x,
    min_y === Infinity ? -90 : min_y,
    max_x === -Infinity ? 180 : max_x,
    max_y === -Infinity ? 90 : max_y,
  ]
}

/**
 * AtlasBordersService provides high-performance temporal slicing and streaming of historical GIS boundaries.
 */
export class AtlasBordersService {
  /**
   * Retrieves the absolute filesystem paths for atlas datasets.
   *
   * @returns {{ cacheDir: string, cshapesPath: string, detailedDir: string, naissancePath: string }}
   */
  static getDatasetPaths (): { cacheDir: string; cshapesPath: string; detailedDir: string; naissancePath: string } {
    //Declare local instance variables
    let base_dir = path.resolve(process.cwd(), 'data/atlas')
    let cache_dir = path.join(base_dir, 'cache')
    let cshapes_path = path.join(base_dir, 'CShapes-2.0.geojson')
    let detailed_dir = path.join(base_dir, 'detailed')
    let naissance_path = path.join(base_dir, 'atlas.naissance')

    //Function body
    if (!fs.existsSync(cache_dir))
      fs.mkdirSync(cache_dir, { recursive: true })

    //Return statement
    return {
      cacheDir: cache_dir,
      cshapesPath: cshapes_path,
      detailedDir: detailed_dir,
      naissancePath: naissance_path,
    }
  }

  /**
   * Loads and indexes CShapes-2.0.geojson in memory on first access.
   *
   * @returns {any[]}
   */
  static loadCShapes (): any[] {
    //Guard clauses
    if (cached_cshapes_features)
      return cached_cshapes_features

    //Declare local instance variables
    let file_path = AtlasBordersService.getDatasetPaths().cshapesPath

    //Guard clauses
    if (!fs.existsSync(file_path)) {
      console.warn(`[AtlasBordersService] CShapes file not found: ${file_path}`)
      cached_cshapes_features = []
      return cached_cshapes_features
    }

    //Function body
    try {
      console.log(`[AtlasBordersService] Loading and indexing CShapes-2.0.geojson...`)
      let raw = fs.readFileSync(file_path, 'utf-8')
      cached_cshapes_data = JSON.parse(raw)
      cached_cshapes_features = cached_cshapes_data.features || []

      //Index keyframes by gwcode
      cached_cshapes_keyframes_by_gwcode = new Map()
      for (let i = 0; i < cached_cshapes_features.length; i++) {
        let feat = cached_cshapes_features[i]
        let p = feat.properties
        let gw = p.gwcode
        if (gw !== undefined) {
          if (!cached_cshapes_keyframes_by_gwcode.has(gw))
            cached_cshapes_keyframes_by_gwcode.set(gw, [])
          let list = cached_cshapes_keyframes_by_gwcode.get(gw)!
          list.push({
            date: p.gwsdate || `${p.gwsyear}`,
            label: `Boundary keyframe (${p.gwsyear}-${p.gweyear})`,
            year: p.gwsyear,
          })
        }
      }

      //Sort keyframes chronologically
      for (let list of cached_cshapes_keyframes_by_gwcode.values()) {
        list.sort((arg0_a, arg0_b) => arg0_a.year - arg0_b.year)
      }

      console.log(`[AtlasBordersService] Successfully indexed ${cached_cshapes_features.length} CShapes features across ${cached_cshapes_keyframes_by_gwcode.size} nations.`)
    } catch (arg0_err) {
      console.error('[AtlasBordersService] Failed to load CShapes-2.0.geojson:', arg0_err)
      cached_cshapes_features = []
    }

    //Return statement
    return cached_cshapes_features
  }

  /**
   * Loads and indexes atlas.naissance in memory on first access using SVEA History keyframe specifications.
   *
   * @returns {Map<string, NaissanceEntityRecord>}
   */
  /**
   * Loads and indexes a .naissance file in memory on first access using SVEA History keyframe specifications.
   *
   * @param {string} [arg0_file_path]
   *
   * @returns {Map<string, NaissanceEntityRecord>}
   */
  static loadNaissance (arg0_file_path?: string): Map<string, NaissanceEntityRecord> {
    //Convert from parameters
    let file_path = arg0_file_path || AtlasBordersService.getDatasetPaths().naissancePath

    //Guard clauses
    if (cached_naissance_entities_by_path.has(file_path))
      return cached_naissance_entities_by_path.get(file_path)!

    if (!fs.existsSync(file_path)) {
      console.warn(`[AtlasBordersService] Naissance file not found: ${file_path}`)
      let empty_map = new Map<string, NaissanceEntityRecord>()
      cached_naissance_entities_by_path.set(file_path, empty_map)
      return empty_map
    }

    //Declare local instance variables
    let entity_records = new Map<string, NaissanceEntityRecord>()

    //Release previous slice from memory cache to prevent holding multiple 600MB-900MB slices in RAM
    if (cached_naissance_entities_by_path.size >= 1)
      cached_naissance_entities_by_path.clear()

    //Function body
    try {
      console.log(`[AtlasBordersService] Loading and indexing ${path.basename(file_path)}...`)
      let raw = fs.readFileSync(file_path, 'utf-8')
      let parsed_data = JSON.parse(raw)
      raw = ''

      let keys = Object.keys(parsed_data)
      for (let i = 0; i < keys.length; i++) {
        let ent_id = keys[i]
        if (ent_id === 'map_settings')
          continue

        let ent = parsed_data[ent_id]
        if (!ent || ent.class_name !== 'GeometryPolygon' || !ent.history)
          continue

        let raw_ts_keys = Object.keys(ent.history)
        if (raw_ts_keys.length === 0)
          continue

        let sorted_ts = raw_ts_keys.map(Number).sort((arg0_a, arg0_b) => arg0_a - arg0_b)
        let kf_map = new Map<number, [any, any, any]>()

        for (let x = 0; x < sorted_ts.length; x++) {
          let ts = sorted_ts[x]
          let val = ent.history[String(ts)]
          if (Array.isArray(val))
            kf_map.set(ts, val as [any, any, any])
        }

        entity_records.set(ent_id, {
          class_name: ent.class_name,
          id: ent_id,
          keyframes: kf_map,
          max_ts: sorted_ts[sorted_ts.length - 1],
          min_ts: sorted_ts[0],
          name: ent.name,
          sorted_timestamps: sorted_ts,
        })
      }

      parsed_data = null as any
      console.log(`[AtlasBordersService] Successfully indexed ${entity_records.size} entities from ${path.basename(file_path)}.`)
    } catch (arg0_err) {
      console.error(`[AtlasBordersService] Failed to load ${file_path}:`, arg0_err)
    }

    cached_naissance_entities_by_path.set(file_path, entity_records)

    //Return statement
    return entity_records
  }

  /**
   * Slices active historical borders for a given year and dataset.
   *
   * @param {number} arg0_year
   * @param {Object} [arg1_options]
   * @param {[number, number, number, number]} [arg1_options.bbox]
   * @param {string} [arg1_options.dataset]
   *
   * @returns {HistoricalBordersResponse}
   */
  static getBordersAtYear (
    arg0_year: number,
    arg1_options?: { bbox?: [number, number, number, number]; dataset?: string }
  ): HistoricalBordersResponse {
    //Convert from parameters
    let options = arg1_options || {}
    let target_year = Math.round(arg0_year)

    //Declare local instance variables
    let bbox = options.bbox
    let dataset = options.dataset || 'statistical_borders'
    let disk_cache_path = path.join(
      AtlasBordersService.getDatasetPaths().cacheDir,
      `borders_${dataset}_${target_year}.json`
    )
    let domain: [number, number] = dataset === 'detailed_borders'
      ? [-3500, 2026]
      : (target_year >= 1886 ? [1886, 2026] : [-3500, 1886])
    let features: HistoricalBorderFeature[] = []
    let lru_key = `${dataset}_${target_year}`
    let source: 'cshapes' | 'naissance' = dataset === 'detailed_borders'
      ? 'naissance'
      : (target_year >= 1886 ? 'cshapes' : 'naissance')

    //Check in-memory LRU cache if no bbox
    if (!bbox && in_memory_slice_lru.has(lru_key)) {
      let cached_list = in_memory_slice_lru.get(lru_key)!
      return {
        count: cached_list.length,
        domain,
        features: cached_list,
        source,
        year: target_year,
      }
    }

    //Check disk cache if no bbox
    if (!bbox && fs.existsSync(disk_cache_path)) {
      try {
        let cached_json = JSON.parse(fs.readFileSync(disk_cache_path, 'utf-8'))
        if (Array.isArray(cached_json.features)) {
          in_memory_slice_lru.set(lru_key, cached_json.features)
          return {
            count: cached_json.features.length,
            domain,
            features: cached_json.features,
            source,
            year: target_year,
          }
        }
      } catch {
        //Ignore malformed cache
      }
    }

    //Function body
    if (dataset === 'detailed_borders') {
      //--- 1. DETAILED BORDERS SLICER (-3500 to 2026) ---
      let slice = detailed_borders_slices.find((arg0_s) =>
        target_year >= arg0_s.domain[0] && (target_year < arg0_s.domain[1] || arg0_s.domain[1] === 2026)
      )
      if (!slice)
        slice = target_year < -3500 ? detailed_borders_slices[0] : detailed_borders_slices[detailed_borders_slices.length - 1]

      let detailed_path = path.join(AtlasBordersService.getDatasetPaths().detailedDir, slice.file)
      let entities = AtlasBordersService.loadNaissance(detailed_path)
      let target_ts = UfDate.getTimestamp({
        day: 1,
        hour: 0,
        minute: 0,
        month: 1,
        year: target_year,
      })

      for (let [ent_id, ent] of entities.entries()) {
        //Guard clause: check if entity exists at or before target timestamp
        if (ent.min_ts > target_ts)
          continue

        let current_geom: any = null
        let current_props: Record<string, any> = {}
        let current_symbol: Record<string, any> = {}
        let resolved_ts = ent.min_ts

        //Resolve state at target_ts using SVEA History algorithm
        for (let i = 0; i < ent.sorted_timestamps.length; i++) {
          let ts = ent.sorted_timestamps[i]
          if (ts > target_ts)
            break

          resolved_ts = ts
          let kf = ent.keyframes.get(ts)
          if (!kf)
            continue

          if (kf[0] !== undefined)
            current_geom = kf[0]
          if (kf[1] !== undefined && typeof kf[1] === 'object' && kf[1] !== null)
            current_symbol = { ...current_symbol, ...kf[1] }
          if (kf[2] !== undefined && typeof kf[2] === 'object' && kf[2] !== null)
            current_props = { ...current_props, ...kf[2] }
        }

        //If territory ceased existing (.properties.hidden in SVEA) or geometry is missing, skip
        if (current_props.hidden === true)
          continue
        if (!current_geom)
          continue

        let geom = current_geom.feature?.geometry || current_geom.geometry || (current_geom.type && current_geom.coordinates ? current_geom : null)
        if (!geom || !geom.coordinates)
          continue

        let geom_bbox = computeGeometryBBox(geom)

        if (bbox) {
          let [b_min_x, b_min_y, b_max_x, b_max_y] = bbox
          let [g_min_x, g_min_y, g_max_x, g_max_y] = geom_bbox
          if (g_max_x < b_min_x || g_min_x > b_max_x || g_max_y < b_min_y || g_min_y > b_max_y)
            continue
        }

        //Format keyframes list for inspection
        let keyframes_list: HistoricalBorderKeyframe[] = []
        for (let k = 0; k < ent.sorted_timestamps.length; k++) {
          let k_ts = ent.sorted_timestamps[k]
          let date_obj = UfDate.convertTimestampToDate(k_ts)
          let k_val = ent.keyframes.get(k_ts)
          let label = 'Territory modified'
          if (k_val && (k_val[0] === null || k_val[2]?.hidden === true))
            label = 'Territory dissolved / deleted'
          else if (k === 0)
            label = 'Territory established'
          else if (k_val && k_val[2] && k_val[2].name)
            label = `Renamed to ${String(k_val[2].name).replace(/\n+/g, ' ')}`

          keyframes_list.push({
            date: UfDate.formatDate(date_obj),
            label,
            timestamp: k_ts,
            year: date_obj.year,
          })
        }

        let raw_name = current_props.name || ent.name || `Entity ${ent_id}`
        let entity_name = typeof raw_name === 'string' ? raw_name.replace(/\n+/g, ' ') : `Entity ${ent_id}`
        let resolved_date_obj = UfDate.convertTimestampToDate(resolved_ts)

        features.push({
          bbox: geom_bbox,
          geometry: geom,
          id: `detailed_${ent_id}`,
          properties: {
            adm0_a3: entity_name,
            area: current_props.area,
            date: UfDate.formatDate(resolved_date_obj),
            flags: current_props.flags,
            id: ent_id,
            iso_a3: entity_name,
            keyframes: keyframes_list,
            label: current_props.label,
            link: current_props.link,
            name: entity_name,
            name_long: entity_name,
            state_id: current_props.state_id,
            symbol: current_symbol,
            timestamp: resolved_ts,
          },
          type: 'Feature',
        })
      }
    } else if (target_year >= 1886) {
      //--- 2. CSHAPES-2.0 GEOJSON SLICER (1886 - Present) ---
      let cshapes = AtlasBordersService.loadCShapes()

      for (let i = 0; i < cshapes.length; i++) {
        let feat = cshapes[i]
        let p = feat.properties
        let s_yr = p.gwsyear
        let e_yr = p.gweyear

        //Check temporal domain validity
        let is_active = s_yr <= target_year && (e_yr >= target_year || (e_yr >= 2019 && target_year >= 2019))
        if (!is_active)
          continue

        //Compute or verify bounding box
        let geom_bbox = feat.bbox || computeGeometryBBox(feat.geometry)
        if (bbox) {
          let [b_min_x, b_min_y, b_max_x, b_max_y] = bbox
          let [g_min_x, g_min_y, g_max_x, g_max_y] = geom_bbox
          if (g_max_x < b_min_x || g_min_x > b_max_x || g_max_y < b_min_y || g_min_y > b_max_y)
            continue
        }

        let gw = p.gwcode
        let keyframes = gw !== undefined ? cached_cshapes_keyframes_by_gwcode.get(gw) : undefined

        features.push({
          bbox: geom_bbox,
          geometry: feat.geometry,
          id: `cshapes_${p.gwcode}_${p.gwsyear}`,
          properties: {
            adm0_a3: p.cntry_name,
            area: p.area,
            caplat: p.caplat,
            caplong: p.caplong,
            capname: p.capname,
            endDate: p.gwedate,
            endYear: p.gweyear,
            gwcode: p.gwcode,
            id: p.gwcode,
            iso_a3: p.cntry_name,
            keyframes: keyframes || [],
            name: p.cntry_name,
            name_long: p.cntry_name,
            startDate: p.gwsdate,
            startYear: p.gwsyear,
          },
          type: 'Feature',
        })
      }
    } else {
      //--- 3. ATLAS.NAISSANCE SLICER (-3500 to 1886) ---
      let entities = AtlasBordersService.loadNaissance()
      let target_ts = UfDate.getTimestamp({
        day: 1,
        hour: 0,
        minute: 0,
        month: 1,
        year: target_year,
      })

      for (let [ent_id, ent] of entities.entries()) {
        //Guard clause: check if entity exists at or before target timestamp
        if (ent.min_ts > target_ts)
          continue

        let current_geom: any = null
        let current_props: Record<string, any> = {}
        let current_symbol: Record<string, any> = {}
        let resolved_ts = ent.min_ts

        //Resolve state at target_ts using SVEA History algorithm
        for (let i = 0; i < ent.sorted_timestamps.length; i++) {
          let ts = ent.sorted_timestamps[i]
          if (ts > target_ts)
            break

          resolved_ts = ts
          let kf = ent.keyframes.get(ts)
          if (!kf)
            continue

          if (kf[0] !== undefined)
            current_geom = kf[0]
          if (kf[1] !== undefined && typeof kf[1] === 'object' && kf[1] !== null)
            current_symbol = { ...current_symbol, ...kf[1] }
          if (kf[2] !== undefined && typeof kf[2] === 'object' && kf[2] !== null)
            current_props = { ...current_props, ...kf[2] }
        }

        //If territory ceased existing (.properties.hidden in SVEA) or geometry is missing, skip
        if (current_props.hidden === true)
          continue
        if (!current_geom)
          continue

        let geom = current_geom.feature?.geometry || current_geom.geometry || (current_geom.type && current_geom.coordinates ? current_geom : null)
        if (!geom || !geom.coordinates)
          continue

        let geom_bbox = computeGeometryBBox(geom)

        if (bbox) {
          let [b_min_x, b_min_y, b_max_x, b_max_y] = bbox
          let [g_min_x, g_min_y, g_max_x, g_max_y] = geom_bbox
          if (g_max_x < b_min_x || g_min_x > b_max_x || g_max_y < b_min_y || g_min_y > b_max_y)
            continue
        }

        //Format keyframes list for inspection
        let keyframes_list: HistoricalBorderKeyframe[] = []
        for (let k = 0; k < ent.sorted_timestamps.length; k++) {
          let k_ts = ent.sorted_timestamps[k]
          let date_obj = UfDate.convertTimestampToDate(k_ts)
          let k_val = ent.keyframes.get(k_ts)
          let label = 'Territory modified'
          if (k_val && (k_val[0] === null || k_val[2]?.hidden === true))
            label = 'Territory dissolved / deleted'
          else if (k === 0)
            label = 'Territory established'
          else if (k_val && k_val[2] && k_val[2].name)
            label = `Renamed to ${String(k_val[2].name).replace(/\n+/g, ' ')}`

          keyframes_list.push({
            date: UfDate.formatDate(date_obj),
            label,
            timestamp: k_ts,
            year: date_obj.year,
          })
        }

        let raw_name = current_props.name || ent.name || `Entity ${ent_id}`
        let entity_name = typeof raw_name === 'string' ? raw_name.replace(/\n+/g, ' ') : `Entity ${ent_id}`
        let resolved_date_obj = UfDate.convertTimestampToDate(resolved_ts)

        features.push({
          bbox: geom_bbox,
          geometry: geom,
          id: `naissance_${ent_id}`,
          properties: {
            adm0_a3: entity_name,
            date: UfDate.formatDate(resolved_date_obj),
            id: ent_id,
            iso_a3: entity_name,
            keyframes: keyframes_list,
            name: entity_name,
            name_long: entity_name,
            symbol: current_symbol,
            timestamp: resolved_ts,
          },
          type: 'Feature',
        })
      }
    }

    //Sort features deterministically by name
    features.sort((arg0_a, arg0_b) => arg0_a.properties.name.localeCompare(arg0_b.properties.name))

    //Update caches if query was global (no bbox)
    if (!bbox) {
      if (in_memory_slice_lru.size >= max_lru_entries) {
        let first_key = in_memory_slice_lru.keys().next().value
        if (first_key !== undefined)
          in_memory_slice_lru.delete(first_key)
      }
      in_memory_slice_lru.set(lru_key, features)

      //Persist to disk cache asynchronously
      try {
        fs.writeFile(
          disk_cache_path,
          JSON.stringify({ domain, features, source, year: target_year }),
          'utf-8',
          () => {}
        )
      } catch {
        //Ignore disk write errors
      }
    }

    //Return statement
    return {
      count: features.length,
      domain,
      features,
      source,
      year: target_year,
    }
  }

  /**
   * Streams sliced historical borders as chunked JSON to the HTTP response.
   *
   * @param {ServerResponse} arg0_res
   * @param {number} arg1_year
   * @param {Object} [arg2_options]
   * @param {[number, number, number, number]} [arg2_options.bbox]
   * @param {string} [arg2_options.dataset]
   *
   * @returns {void}
   */
  static streamBorders (
    arg0_res: ServerResponse,
    arg1_year: number,
    arg2_options?: { bbox?: [number, number, number, number]; dataset?: string }
  ): void {
    //Convert from parameters
    let options = arg2_options || {}
    let res = arg0_res
    let year = arg1_year

    //Declare local instance variables
    let borders_res = AtlasBordersService.getBordersAtYear(year, options)
    let features = borders_res.features

    //Function body
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Transfer-Encoding', 'chunked')
    res.setHeader('Cache-Control', 'public, max-age=3600')

    res.write('{\n')
    res.write(`  "type": "FeatureCollection",\n`)
    res.write(`  "year": ${borders_res.year},\n`)
    res.write(`  "source": "${borders_res.source}",\n`)
    res.write(`  "domain": [${borders_res.domain[0]}, ${borders_res.domain[1]}],\n`)
    res.write(`  "count": ${features.length},\n`)
    res.write(`  "features": [\n`)

    for (let i = 0; i < features.length; i++) {
      let is_last = i === features.length - 1
      let chunk = `    ${JSON.stringify(features[i])}${is_last ? '' : ','}\n`
      res.write(chunk)
    }

    res.write('  ]\n')
    res.write('}\n')
    res.end()
  }

  /**
   * Retrieves full keyframe history and metadata for a specific entity.
   *
   * @param {string} arg0_id
   *
   * @returns {any}
   */
  static getEntityDetails (arg0_id: string): any {
    //Convert from parameters
    let target_id = arg0_id.replace(/^(naissance_|cshapes_|detailed_)/, '')

    //Declare local instance variables
    let cshapes = AtlasBordersService.loadCShapes()
    let default_entities = AtlasBordersService.loadNaissance()
    let search_entity_maps = [default_entities, ...cached_naissance_entities_by_path.values()]

    //Function body
    //1. Check Naissance entities across any loaded maps or default atlas.naissance
    for (let i = 0; i < search_entity_maps.length; i++) {
      let entities = search_entity_maps[i]
      if (entities.has(target_id)) {
        let ent = entities.get(target_id)!
        let keyframes_detail: any[] = []

        for (let x = 0; x < ent.sorted_timestamps.length; x++) {
          let ts = ent.sorted_timestamps[x]
          let kf = ent.keyframes.get(ts)
          let date_obj = UfDate.convertTimestampToDate(ts)

          keyframes_detail.push({
            date: UfDate.formatDate(date_obj),
            hasGeometry: Boolean(kf && kf[0] && kf[0] !== null),
            properties: kf?.[2] || {},
            symbol: kf?.[1] || {},
            timestamp: ts,
            year: date_obj.year,
          })
        }

        //Return statement
        return {
          class_name: ent.class_name,
          id: ent.id,
          keyframes: keyframes_detail,
          name: ent.name,
          source: 'naissance',
          totalKeyframes: keyframes_detail.length,
        }
      }
    }

    //2. Check CShapes entities
    let numeric_gw = parseInt(target_id, 10)
    let matching_features = cshapes.filter(
      (arg0_f) => arg0_f.properties.gwcode === numeric_gw || arg0_f.properties.cntry_name.toLowerCase() === target_id.toLowerCase()
    )

    if (matching_features.length > 0) {
      let keyframes_detail = matching_features.map((arg0_f) => ({
        area: arg0_f.properties.area,
        capname: arg0_f.properties.capname,
        date: arg0_f.properties.gwsdate,
        endDate: arg0_f.properties.gwedate,
        endYear: arg0_f.properties.gweyear,
        startDate: arg0_f.properties.gwsdate,
        startYear: arg0_f.properties.gwsyear,
        year: arg0_f.properties.gwsyear,
      }))

      keyframes_detail.sort((arg0_a, arg0_b) => arg0_a.year - arg0_b.year)

      //Return statement
      return {
        gwcode: matching_features[0].properties.gwcode,
        id: target_id,
        keyframes: keyframes_detail,
        name: matching_features[0].properties.cntry_name,
        source: 'cshapes',
        totalKeyframes: keyframes_detail.length,
      }
    }

    //Return statement
    return null
  }

  /**
   * Clears the in-memory LRU cache and disk slice cache.
   *
   * @returns {void}
   */
  static clearCache (): void {
    //Function body
    in_memory_slice_lru.clear()
    cached_naissance_entities_by_path.clear()
    let cache_dir = AtlasBordersService.getDatasetPaths().cacheDir
    if (fs.existsSync(cache_dir)) {
      let files = fs.readdirSync(cache_dir)
      for (let i = 0; i < files.length; i++) {
        if (files[i].startsWith('borders_') && files[i].endsWith('.json')) {
          try {
            fs.unlinkSync(path.join(cache_dir, files[i]))
          } catch {
            //Ignore delete errors
          }
        }
      }
    }
  }
}
