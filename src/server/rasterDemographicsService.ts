import fs from 'fs'
import path from 'path'
import { decode as decodePng } from 'fast-png'
import { AtlasBordersService } from './atlasBordersService.ts'

export interface DemographicCohortResult {
  country: string
  dependencyRatio: number
  female: Record<string, number>
  male: Record<string, number>
  sexRatio: number
  totalFemale: number
  totalMale: number
}

export interface SectorBreakdownResult {
  byCountry: Record<string, Record<string, number>>
  global: Record<string, number>
}

export interface ScanlineSpan {
  c_end: number
  c_start: number
  row: number
}

let AGE_COHORTS = [
  '00', '01', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', '60', '65', '70', '75', '80'
]

let SECTOR_KEYS = [
  'agriculture', 'informal_labour', 'manufacturing', 'services', 'not_in_work'
]

let COHORTS_DIR = 'D:/Project 1509 - SVEA/histmap/3.data_transform/age_sex/4.composite_cohorts'
let PROFESSIONS_DIR = 'D:/Project 1509 - SVEA/histmap/3.data_transform/professions/4.aggregates'
let NATURAL_EARTH_PATH = path.join(process.cwd(), 'public/data/ne_50m_admin_0_countries.geojson')

let RASTER_WIDTH = 4320
let RASTER_HEIGHT = 2160

let demographic_year_cache = new Map<number, { f: Record<string, Float32Array>; m: Record<string, Float32Array> }>()
let sector_year_cache = new Map<number, Record<string, Float32Array>>()
let available_demographic_years: number[] | null = null
let available_sector_years: number[] | null = null
let cached_natural_earth_features: any[] | null = null

/**
 * Loads and returns the sorted list of available keyframe years for age_sex composite cohorts.
 *
 * @returns {number[]}
 */
function getAvailableDemographicYears (): number[] {
  //Guard clauses
  if (available_demographic_years)
    return available_demographic_years

  //Declare local instance variables
  let all_files: string[] = []
  let years_set = new Set<number>()

  //Function body
  try {
    if (fs.existsSync(COHORTS_DIR)) {
      all_files = fs.readdirSync(COHORTS_DIR)
      for (let i = 0; i < all_files.length; i++) {
        let f = all_files[i]
        if (f.startsWith('f_00_') && f.endsWith('.png')) {
          let yr_str = f.replace('f_00_', '').replace('.png', '')
          let yr = parseInt(yr_str, 10)
          if (!Number.isNaN(yr))
            years_set.add(yr)
        }
      }
    }
  } catch (arg0_err) {
    console.error('[RasterDemographicsService] Failed to read demographic years:', arg0_err)
  }

  available_demographic_years = Array.from(years_set).sort((arg0_a, arg0_b) => arg0_a - arg0_b)

  //Return statement
  return available_demographic_years
}

/**
 * Loads and returns the sorted list of available keyframe years for professions aggregates.
 *
 * @returns {number[]}
 */
function getAvailableSectorYears (): number[] {
  //Guard clauses
  if (available_sector_years)
    return available_sector_years

  //Declare local instance variables
  let all_files: string[] = []
  let years_set = new Set<number>()

  //Function body
  try {
    if (fs.existsSync(PROFESSIONS_DIR)) {
      all_files = fs.readdirSync(PROFESSIONS_DIR)
      for (let i = 0; i < all_files.length; i++) {
        let f = all_files[i]
        if (f.startsWith('agriculture_t_') && f.endsWith('.png')) {
          let yr_str = f.replace('agriculture_t_', '').replace('.png', '')
          let yr = parseInt(yr_str, 10)
          if (!Number.isNaN(yr))
            years_set.add(yr)
        }
      }
    }
  } catch (arg0_err) {
    console.error('[RasterDemographicsService] Failed to read sector years:', arg0_err)
  }

  available_sector_years = Array.from(years_set).sort((arg0_a, arg0_b) => arg0_a - arg0_b)

  //Return statement
  return available_sector_years
}

/**
 * Finds the closest available keyframe year to the target requested year.
 *
 * @param {number} arg0_year
 * @param {number[]} arg1_years
 *
 * @returns {number}
 */
function findClosestYear (arg0_year: number, arg1_years: number[]): number {
  //Convert from parameters
  let target_year = arg0_year
  let years = arg1_years

  //Guard clauses
  if (!years || years.length === 0)
    return target_year

  //Declare local instance variables
  let closest = years[0]
  let min_diff = Math.abs(target_year - closest)

  //Function body
  for (let i = 1; i < years.length; i++) {
    let diff = Math.abs(target_year - years[i])
    if (diff < min_diff) {
      min_diff = diff
      closest = years[i]
    }
  }

  //Return statement
  return closest
}

/**
 * Reads a big-endian float32 GeoPNG from disk and converts it to a native Float32Array.
 *
 * @param {string} arg0_filepath
 *
 * @returns {Float32Array | null}
 */
function loadGeoPngAsFloat32 (arg0_filepath: string): Float32Array | null {
  //Convert from parameters
  let filepath = arg0_filepath

  //Guard clauses
  if (!fs.existsSync(filepath))
    return null

  //Declare local instance variables
  let buf: Buffer
  let img: any
  let out_buf: ArrayBuffer
  let out_f32: Float32Array
  let out_u32: Uint32Array
  let src_u32: Uint32Array

  //Function body
  try {
    buf = fs.readFileSync(filepath)
    img = decodePng(buf)
    src_u32 = new Uint32Array(img.data.buffer, img.data.byteOffset, img.data.byteLength/4)
    out_buf = new ArrayBuffer(src_u32.length*4)
    out_u32 = new Uint32Array(out_buf)
    out_f32 = new Float32Array(out_buf)

    for (let i = 0; i < src_u32.length; i++) {
      let raw = src_u32[i]
      out_u32[i] = ((raw & 0xff) << 24) | ((raw & 0xff00) << 8) | ((raw >>> 8) & 0xff00) | (raw >>> 24)
    }

    //Return statement
    return out_f32
  } catch (arg0_err) {
    console.error(`[RasterDemographicsService] Error decoding ${filepath}:`, arg0_err)
    return null
  }
}

/**
 * Loads all 36 demographic cohort rasters for a keyframe year into memory cache.
 *
 * @param {number} arg0_year
 *
 * @returns {{ f: Record<string, Float32Array>; m: Record<string, Float32Array> } | null}
 */
function getDemographicYearRasters (
  arg0_year: number
): { f: Record<string, Float32Array>; m: Record<string, Float32Array> } | null {
  //Convert from parameters
  let year = arg0_year

  //Declare local instance variables
  let available = getAvailableDemographicYears()
  let female_map: Record<string, Float32Array> = {}
  let keyframe_year: number
  let male_map: Record<string, Float32Array> = {}

  //Guard clauses
  keyframe_year = findClosestYear(year, available)
  if (demographic_year_cache.has(keyframe_year))
    return demographic_year_cache.get(keyframe_year)!

  //Function body
  for (let i = 0; i < AGE_COHORTS.length; i++) {
    let cid = AGE_COHORTS[i]
    let f_path = path.join(COHORTS_DIR, `f_${cid}_${keyframe_year}.png`)
    let m_path = path.join(COHORTS_DIR, `m_${cid}_${keyframe_year}.png`)

    let f_data = loadGeoPngAsFloat32(f_path)
    let m_data = loadGeoPngAsFloat32(m_path)

    if (f_data)
      female_map[cid] = f_data
    if (m_data)
      male_map[cid] = m_data
  }

  //Evict oldest if cache exceeds 3 years
  if (demographic_year_cache.size >= 3) {
    let first_key = demographic_year_cache.keys().next().value
    if (first_key !== undefined)
      demographic_year_cache.delete(first_key)
  }

  let year_payload = { f: female_map, m: male_map }
  demographic_year_cache.set(keyframe_year, year_payload)

  //Return statement
  return year_payload
}

/**
 * Loads all 5 sector aggregates for a keyframe year into memory cache.
 *
 * @param {number} arg0_year
 *
 * @returns {Record<string, Float32Array> | null}
 */
function getSectorYearRasters (arg0_year: number): Record<string, Float32Array> | null {
  //Convert from parameters
  let year = arg0_year

  //Declare local instance variables
  let available = getAvailableSectorYears()
  let keyframe_year: number
  let sector_map: Record<string, Float32Array> = {}

  //Guard clauses
  keyframe_year = findClosestYear(year, available)
  if (sector_year_cache.has(keyframe_year))
    return sector_year_cache.get(keyframe_year)!

  //Function body
  for (let i = 0; i < SECTOR_KEYS.length; i++) {
    let s = SECTOR_KEYS[i]
    let p = path.join(PROFESSIONS_DIR, `${s}_t_${keyframe_year}.png`)
    let data = loadGeoPngAsFloat32(p)
    if (data)
      sector_map[s] = data
  }

  if (sector_year_cache.size >= 4) {
    let first_key = sector_year_cache.keys().next().value
    if (first_key !== undefined)
      sector_year_cache.delete(first_key)
  }

  sector_year_cache.set(keyframe_year, sector_map)

  //Return statement
  return sector_map
}

/**
 * Computes scanline bounding spans for a GeoJSON Polygon or MultiPolygon.
 * Uses the Jordan curve even-odd rule across all exterior and hole rings.
 *
 * @param {any} arg0_geometry
 * @param {number} [arg1_w=RASTER_WIDTH]
 * @param {number} [arg2_h=RASTER_HEIGHT]
 *
 * @returns {ScanlineSpan[]}
 */
export function computeScanlineSpans (
  arg0_geometry: any,
  arg1_w = RASTER_WIDTH,
  arg2_h = RASTER_HEIGHT
): ScanlineSpan[] {
  //Convert from parameters
  let geometry = arg0_geometry
  let h = arg2_h
  let w = arg1_w

  //Guard clauses
  if (!geometry || !geometry.coordinates)
    return []

  //Declare local instance variables
  let polygons: number[][][][] =
    geometry.type === 'Polygon'
      ? [geometry.coordinates as number[][][]]
      : (geometry.coordinates as number[][][][])
  let spans: ScanlineSpan[] = []

  //Function body
  for (let p_idx = 0; p_idx < polygons.length; p_idx++) {
    let poly_rings = polygons[p_idx]
    if (!poly_rings || poly_rings.length === 0)
      continue

    let ext_ring = poly_rings[0]
    let max_y = -Infinity
    let min_y = Infinity

    for (let pt_idx = 0; pt_idx < ext_ring.length; pt_idx++) {
      let y = ext_ring[pt_idx][1]
      if (y < min_y)
        min_y = y
      if (y > max_y)
        max_y = y
    }

    let max_r = Math.min(h - 1, Math.ceil(((90 - min_y)/180)*h))
    let min_r = Math.max(0, Math.floor(((90 - max_y)/180)*h))

    for (let r = min_r; r <= max_r; r++) {
      let lat = 90 - ((r + 0.5)/h)*180
      let intersections: number[] = []

      for (let ring_idx = 0; ring_idx < poly_rings.length; ring_idx++) {
        let ring = poly_rings[ring_idx]
        for (let x = 0, y_idx = ring.length - 1; x < ring.length; y_idx = x++) {
          let p1 = ring[x]
          let p2 = ring[y_idx]
          if ((p1[1] <= lat && p2[1] > lat) || (p2[1] <= lat && p1[1] > lat)) {
            let t = (lat - p1[1])/(p2[1] - p1[1])
            let lng = p1[0] + t*(p2[0] - p1[0])
            intersections.push(lng)
          }
        }
      }

      if (intersections.length < 2)
        continue
      intersections.sort((arg0_a, arg0_b) => arg0_a - arg0_b)

      for (let k = 0; k < intersections.length - 1; k += 2) {
        let c_end = Math.min(w - 1, Math.ceil(((intersections[k + 1] + 180)/360)*w))
        let c_start = Math.max(0, Math.floor(((intersections[k] + 180)/360)*w))
        if (c_start <= c_end)
          spans.push({ c_end, c_start, row: r })
      }
    }
  }

  //Return statement
  return spans
}

/**
 * Sums all valid positive cell values across precomputed scanline spans.
 *
 * @param {ScanlineSpan[]} arg0_spans
 * @param {Float32Array} arg1_data
 * @param {number} [arg2_w=RASTER_WIDTH]
 *
 * @returns {number}
 */
function sumRasterSpans (
  arg0_spans: ScanlineSpan[],
  arg1_data: Float32Array,
  arg2_w = RASTER_WIDTH
): number {
  //Convert from parameters
  let data = arg1_data
  let spans = arg0_spans
  let w = arg2_w

  //Declare local instance variables
  let sum = 0

  //Function body
  for (let i = 0; i < spans.length; i++) {
    let span = spans[i]
    let row_offset = span.row*w
    for (let c = span.c_start; c <= span.c_end; c++) {
      let v = data[row_offset + c]
      if (v > 0 && v < 1e12)
        sum += v
    }
  }

  //Return statement
  return sum
}

/**
 * Sums all valid positive cell values over the entire raster grid.
 *
 * @param {Float32Array} arg0_data
 *
 * @returns {number}
 */
function sumGlobalRaster (arg0_data: Float32Array): number {
  //Convert from parameters
  let data = arg0_data

  //Declare local instance variables
  let sum = 0

  //Function body
  for (let i = 0; i < data.length; i++) {
    let v = data[i]
    if (v > 0 && v < 1e12)
      sum += v
  }

  //Return statement
  return sum
}

/**
 * Loads Natural Earth GeoJSON features from disk with caching.
 *
 * @returns {any[]}
 */
function getNaturalEarthFeatures (): any[] {
  //Guard clauses
  if (cached_natural_earth_features)
    return cached_natural_earth_features

  //Function body
  try {
    if (fs.existsSync(NATURAL_EARTH_PATH)) {
      let raw = fs.readFileSync(NATURAL_EARTH_PATH, 'utf8')
      let parsed = JSON.parse(raw)
      cached_natural_earth_features = parsed.features || []
    } else {
      cached_natural_earth_features = []
    }
  } catch (arg0_err) {
    console.error('[RasterDemographicsService] Failed to load Natural Earth:', arg0_err)
    cached_natural_earth_features = []
  }

  //Return statement
  return cached_natural_earth_features!
}

/**
 * Resolves a polygon geometry for a given country name or identifier at a given year.
 * Checks AtlasBordersService (historical borders) first, then Natural Earth.
 *
 * @param {string} arg0_name
 * @param {number} arg1_year
 *
 * @returns {any | null}
 */
export function resolveCountryGeometry (arg0_name: string, arg1_year: number): any | null {
  //Convert from parameters
  let name = arg0_name
  let year = arg1_year

  //Guard clauses
  if (!name || name.toLowerCase().trim() === 'global')
    return null

  //Declare local instance variables
  let clean = name.toLowerCase().trim()
  let hist_res = AtlasBordersService.getBordersAtYear(year)
  let ne_feats: any[]

  //Function body
  if (hist_res && hist_res.features) {
    for (let i = 0; i < hist_res.features.length; i++) {
      let f = hist_res.features[i]
      let p = f.properties
      if (
        (p.name && p.name.toLowerCase().trim() === clean) ||
        (p.cntry_name && p.cntry_name.toLowerCase().trim() === clean) ||
        (p.name_long && p.name_long.toLowerCase().trim() === clean) ||
        (p.adm0_a3 && p.adm0_a3.toLowerCase().trim() === clean) ||
        (p.iso_a3 && p.iso_a3.toLowerCase().trim() === clean) ||
        (p.id && String(p.id).toLowerCase().trim() === clean) ||
        (p.gwcode && String(p.gwcode) === clean)
      ) {
        return f.geometry
      }
    }
  }

  ne_feats = getNaturalEarthFeatures()
  for (let i = 0; i < ne_feats.length; i++) {
    let f = ne_feats[i]
    let p = f.properties
    if (
      (p.NAME && p.NAME.toLowerCase().trim() === clean) ||
      (p.name && p.name.toLowerCase().trim() === clean) ||
      (p.ADMIN && p.ADMIN.toLowerCase().trim() === clean) ||
      (p.NAME_LONG && p.NAME_LONG.toLowerCase().trim() === clean) ||
      (p.ISO_A3 && p.ISO_A3.toLowerCase().trim() === clean) ||
      (p.ADM0_A3 && p.ADM0_A3.toLowerCase().trim() === clean)
    ) {
      return f.geometry
    }
  }

  //Return statement
  return null
}

/**
 * Calculates genuine demographic population pyramid cohort values from source GeoPNG rasters.
 *
 * @param {object} arg0_options
 * @param {string} [arg0_options.country]
 * @param {any} [arg0_options.geometry]
 * @param {number} arg0_options.year
 *
 * @returns {DemographicCohortResult}
 */
export function calculateDemographicPyramid (arg0_options: {
  country?: string
  geometry?: any
  year: number
}): DemographicCohortResult {
  //Convert from parameters
  let options = arg0_options
  let country_name = options.country || 'Global'
  let geometry = options.geometry
  let year = options.year

  //Declare local instance variables
  let dependency_ratio: number
  let female_map: Record<string, number> = {}
  let is_global: boolean
  let male_map: Record<string, number> = {}
  let old_count = 0
  let rasters = getDemographicYearRasters(year)
  let sex_ratio: number
  let spans: ScanlineSpan[] = []
  let total_female = 0
  let total_male = 0
  let total_pop: number
  let working_count = 0
  let youth_count = 0

  //Function body
  if (!geometry && country_name.toLowerCase().trim() !== 'global')
    geometry = resolveCountryGeometry(country_name, year)

  is_global = !geometry || country_name.toLowerCase().trim() === 'global'

  if (!is_global)
    spans = computeScanlineSpans(geometry)

  if (rasters) {
    for (let i = 0; i < AGE_COHORTS.length; i++) {
      let cid = AGE_COHORTS[i]
      let f_data = rasters.f[cid]
      let m_data = rasters.m[cid]

      let f_sum = 0
      let m_sum = 0

      if (is_global) {
        if (f_data)
          f_sum = sumGlobalRaster(f_data)
        if (m_data)
          m_sum = sumGlobalRaster(m_data)
      } else {
        if (f_data)
          f_sum = sumRasterSpans(spans, f_data)
        if (m_data)
          m_sum = sumRasterSpans(spans, m_data)
      }

      //Convert individuals to thousands with 1 decimal place
      let f_thousands = Math.round((f_sum/1000)*10)/10
      let m_thousands = Math.round((m_sum/1000)*10)/10

      female_map[cid] = f_thousands
      male_map[cid] = m_thousands

      total_female += f_thousands
      total_male += m_thousands

      let cohort_total = f_thousands + m_thousands
      if (i <= 3) {
        youth_count += cohort_total
      } else if (i >= 14) {
        old_count += cohort_total
      } else {
        working_count += cohort_total
      }
    }
  }

  total_pop = youth_count + working_count + old_count
  sex_ratio = total_female > 0 ? Math.round((total_male/total_female)*1000)/1000 : 1.0
  dependency_ratio = total_pop > 0 ? Math.round(((youth_count + old_count)/total_pop)*1000)/10 : 35.0

  //Return statement
  return {
    country: is_global ? 'Global' : country_name,
    dependencyRatio: dependency_ratio,
    female: female_map,
    male: male_map,
    sexRatio: sex_ratio,
    totalFemale: Math.round(total_female*10)/10,
    totalMale: Math.round(total_male*10)/10,
  }
}

/**
 * Calculates genuine sectoral employment shares from source GeoPNG aggregates rasters.
 *
 * @param {object} arg0_options
 * @param {string[]} [arg0_options.countries]
 * @param {{ geometry: any; name: string }[]} [arg0_options.geometries]
 * @param {number} arg0_options.year
 *
 * @returns {SectorBreakdownResult}
 */
export function calculateSectorBreakdown (arg0_options: {
  countries?: string[]
  geometries?: { geometry: any; name: string }[]
  year: number
}): SectorBreakdownResult {
  //Convert from parameters
  let options = arg0_options
  let countries = options.countries || []
  let geometries = options.geometries || []
  let year = options.year

  //Declare local instance variables
  let by_country: Record<string, Record<string, number>> = {}
  let global_active_workforce = 0
  let global_shares: Record<string, number> = {}
  let global_sums: Record<string, number> = {}
  let rasters = getSectorYearRasters(year)
  let target_entities: { geometry: any; name: string }[] = []

  //Function body
  for (let i = 0; i < geometries.length; i++) {
    if (geometries[i].name && geometries[i].geometry)
      target_entities.push(geometries[i])
  }

  for (let i = 0; i < countries.length; i++) {
    let c_name = countries[i]
    if (!target_entities.some((arg0_t) => arg0_t.name === c_name)) {
      let geom = resolveCountryGeometry(c_name, year)
      if (geom)
        target_entities.push({ geometry: geom, name: c_name })
    }
  }

  //Compute global sector distribution
  if (rasters) {
    for (let i = 0; i < SECTOR_KEYS.length; i++) {
      let s = SECTOR_KEYS[i]
      let s_data = rasters[s]
      let s_sum = s_data ? sumGlobalRaster(s_data) : 0
      global_sums[s] = s_sum
      if (s !== 'not_in_work')
        global_active_workforce += s_sum
    }

    for (let i = 0; i < SECTOR_KEYS.length; i++) {
      let s = SECTOR_KEYS[i]
      if (s === 'not_in_work') {
        let denom = global_active_workforce + global_sums[s]
        global_shares[s] = denom > 0 ? Math.round((global_sums[s]/denom)*1000)/10 : 0
      } else {
        global_shares[s] =
          global_active_workforce > 0
            ? Math.round((global_sums[s]/global_active_workforce)*1000)/10
            : 25.0
      }
    }
  }

  //Compute per-country sector distribution
  if (rasters) {
    for (let i = 0; i < target_entities.length; i++) {
      let entity = target_entities[i]
      let entity_active_workforce = 0
      let entity_shares: Record<string, number> = {}
      let entity_sums: Record<string, number> = {}
      let spans = computeScanlineSpans(entity.geometry)

      for (let x = 0; x < SECTOR_KEYS.length; x++) {
        let s = SECTOR_KEYS[x]
        let s_data = rasters[s]
        let s_sum = s_data ? sumRasterSpans(spans, s_data) : 0
        entity_sums[s] = s_sum
        if (s !== 'not_in_work')
          entity_active_workforce += s_sum
      }

      for (let x = 0; x < SECTOR_KEYS.length; x++) {
        let s = SECTOR_KEYS[x]
        if (s === 'not_in_work') {
          let denom = entity_active_workforce + entity_sums[s]
          entity_shares[s] = denom > 0 ? Math.round((entity_sums[s]/denom)*1000)/10 : 0
        } else {
          entity_shares[s] =
            entity_active_workforce > 0
              ? Math.round((entity_sums[s]/entity_active_workforce)*1000)/10
              : (global_shares[s] ?? 25.0)
        }
      }

      by_country[entity.name] = entity_shares
    }
  }

  //Return statement
  return {
    byCountry: by_country,
    global: global_shares,
  }
}

export default {
  calculateDemographicPyramid,
  calculateSectorBreakdown,
  computeScanlineSpans,
  resolveCountryGeometry,
}
