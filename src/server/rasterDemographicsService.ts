import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { decode as decodePng } from 'fast-png'
import { AtlasBordersService } from './atlasBordersService.ts'

export interface DemographicCohortResult {
  country: string
  dependencyRatio: number
  female: Record<string, number>
  lastModified?: number
  male: Record<string, number>
  sexRatio: number
  totalFemale: number
  totalMale: number
}

export interface SectorBreakdownResult {
  byCountry: Record<string, Record<string, number>>
  global: Record<string, number>
  lastModified?: number
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
let BMP_CACHE_DIR = path.resolve(process.cwd(), 'data/raster_cache')
let NATIVE_READER_BIN = path.resolve(process.cwd(), 'bin/raster_reader.exe')
let BAKED_DEMOGRAPHICS_PATH = path.resolve(process.cwd(), 'data/baked_global_demographics.json')
let BAKED_SECTORS_PATH = path.resolve(process.cwd(), 'data/baked_global_sectors.json')

if (!fs.existsSync(BMP_CACHE_DIR))
  fs.mkdirSync(BMP_CACHE_DIR, { recursive: true })

let RASTER_WIDTH = 4320
let RASTER_HEIGHT = 2160

let baked_global_demographics: Record<string, DemographicCohortResult> = {}
let baked_global_sectors: Record<string, Record<string, number>> = {}
let demographic_cache_mtimes = new Map<number, number>()
let demographic_year_cache = new Map<number, { f: Record<string, Float32Array>; m: Record<string, Float32Array> }>()
let sector_cache_mtimes = new Map<number, number>()
let sector_year_cache = new Map<number, Record<string, Float32Array>>()
let available_demographic_years: number[] | null = null
let available_sector_years: number[] | null = null
let cached_natural_earth_features: any[] | null = null

/**
 * Returns the latest modification timestamp (mtimeMs) among all 36 source demographic GeoPNGs for a year.
 *
 * @param {number} arg0_year
 *
 * @returns {number}
 */
export function getDemographicSourceMaxMtime (arg0_year: number): number {
  //Convert from parameters
  let year = arg0_year

  //Declare local instance variables
  let max_mtime = 0

  //Function body
  for (let i = 0; i < AGE_COHORTS.length; i++) {
    let cid = AGE_COHORTS[i]
    let f_path = path.join(COHORTS_DIR, `f_${cid}_${year}.png`)
    let m_path = path.join(COHORTS_DIR, `m_${cid}_${year}.png`)

    if (fs.existsSync(f_path)) {
      try {
        let st = fs.statSync(f_path)
        if (st.mtimeMs > max_mtime)
          max_mtime = st.mtimeMs
      } catch {}
    }
    if (fs.existsSync(m_path)) {
      try {
        let st = fs.statSync(m_path)
        if (st.mtimeMs > max_mtime)
          max_mtime = st.mtimeMs
      } catch {}
    }
  }

  //Return statement
  return max_mtime
}

/**
 * Returns the latest modification timestamp (mtimeMs) among all 5 source profession GeoPNGs for a year.
 *
 * @param {number} arg0_year
 *
 * @returns {number}
 */
export function getSectorSourceMaxMtime (arg0_year: number): number {
  //Convert from parameters
  let year = arg0_year

  //Declare local instance variables
  let max_mtime = 0

  //Function body
  for (let i = 0; i < SECTOR_KEYS.length; i++) {
    let s = SECTOR_KEYS[i]
    let s_path = path.join(PROFESSIONS_DIR, `${s}_t_${year}.png`)

    if (fs.existsSync(s_path)) {
      try {
        let st = fs.statSync(s_path)
        if (st.mtimeMs > max_mtime)
          max_mtime = st.mtimeMs
      } catch {}
    }
  }

  //Return statement
  return max_mtime
}

/**
 * Helper to determine if a cached file is missing or older than its source file.
 *
 * @param {string} arg0_source_path
 * @param {string} arg1_cache_path
 *
 * @returns {boolean}
 */
export function isFileCacheStale (arg0_source_path: string, arg1_cache_path: string): boolean {
  //Convert from parameters
  let cache_path = arg1_cache_path
  let source_path = arg0_source_path

  //Guard clauses
  if (!fs.existsSync(cache_path))
    return true
  if (!fs.existsSync(source_path))
    return false

  //Declare local instance variables
  let cache_stat: fs.Stats
  let source_stat: fs.Stats

  //Function body
  try {
    cache_stat = fs.statSync(cache_path)
    source_stat = fs.statSync(source_path)

    //Return statement
    return source_stat.mtimeMs > cache_stat.mtimeMs
  } catch {
    //Return statement
    return true
  }
}

/**
 * Returns the latest modification timestamp for either demographics or professions at a given year.
 *
 * @param {string} arg0_layer
 * @param {number} arg1_year
 *
 * @returns {number}
 */
export function getLayerYearSourceMtime (arg0_layer: string, arg1_year: number): number {
  //Convert from parameters
  let layer = arg0_layer
  let year = arg1_year

  //Function body
  if (layer === 'age_sex')
    return getDemographicSourceMaxMtime(year)
  if (layer.includes('profession'))
    return getSectorSourceMaxMtime(year)

  //Return statement
  return 0
}

/**
 * Loads baked global demographics from disk into memory cache.
 */
function loadBakedGlobalDemographics (): void {
  //Function body
  try {
    if (fs.existsSync(BAKED_DEMOGRAPHICS_PATH)) {
      let file_mtime = fs.statSync(BAKED_DEMOGRAPHICS_PATH).mtimeMs
      let raw = fs.readFileSync(BAKED_DEMOGRAPHICS_PATH, 'utf8')
      baked_global_demographics = JSON.parse(raw)
      let all_years = Object.keys(baked_global_demographics)
      for (let i = 0; i < all_years.length; i++) {
        let yr = all_years[i]
        if (!baked_global_demographics[yr].lastModified)
          baked_global_demographics[yr].lastModified = file_mtime
      }
    }
  } catch (arg0_err) {
    console.error('[RasterDemographicsService] Failed to load baked global demographics:', arg0_err)
  }
}

/**
 * Loads baked global sectors from disk into memory cache.
 */
function loadBakedGlobalSectors (): void {
  //Function body
  try {
    if (fs.existsSync(BAKED_SECTORS_PATH)) {
      let file_mtime = fs.statSync(BAKED_SECTORS_PATH).mtimeMs
      let raw = fs.readFileSync(BAKED_SECTORS_PATH, 'utf8')
      baked_global_sectors = JSON.parse(raw)
      let all_years = Object.keys(baked_global_sectors)
      for (let i = 0; i < all_years.length; i++) {
        let yr = all_years[i]
        if (!(baked_global_sectors[yr] as any).lastModified)
          (baked_global_sectors[yr] as any).lastModified = file_mtime
      }
    }
  } catch (arg0_err) {
    console.error('[RasterDemographicsService] Failed to load baked global sectors:', arg0_err)
  }
}

loadBakedGlobalDemographics()
loadBakedGlobalSectors()

/**
 * Saves a baked global demographic result to in-memory cache and writes to disk.
 *
 * @param {number} arg0_year
 * @param {DemographicCohortResult} arg1_result
 */
function saveBakedGlobalDemographic (arg0_year: number, arg1_result: DemographicCohortResult): void {
  //Convert from parameters
  let result = arg1_result
  let year = arg0_year

  //Declare local instance variables
  let src_mtime = getDemographicSourceMaxMtime(year)
  let yr_str = String(year)

  //Function body
  result.lastModified = src_mtime > 0 ? src_mtime : Date.now()
  baked_global_demographics[yr_str] = result
  try {
    fs.writeFileSync(BAKED_DEMOGRAPHICS_PATH, JSON.stringify(baked_global_demographics, null, 2), 'utf8')
  } catch (arg0_err) {
    console.error('[RasterDemographicsService] Failed to save baked global demographics:', arg0_err)
  }
}

/**
 * Saves a baked global sector result to in-memory cache and writes to disk.
 *
 * @param {number} arg0_year
 * @param {Record<string, number>} arg1_sectors
 */
function saveBakedGlobalSector (arg0_year: number, arg1_sectors: Record<string, number>): void {
  //Convert from parameters
  let sectors = arg1_sectors
  let year = arg0_year

  //Declare local instance variables
  let clean_sectors: Record<string, number> = {}
  let src_mtime = getSectorSourceMaxMtime(year)
  let yr_str = String(year)

  //Function body
  for (let i = 0; i < SECTOR_KEYS.length; i++) {
    let s = SECTOR_KEYS[i]
    if (typeof sectors[s] === 'number')
      clean_sectors[s] = sectors[s]
  }
  clean_sectors.lastModified = src_mtime > 0 ? src_mtime : Date.now()
  baked_global_sectors[yr_str] = clean_sectors
  try {
    fs.writeFileSync(BAKED_SECTORS_PATH, JSON.stringify(baked_global_sectors, null, 2), 'utf8')
  } catch (arg0_err) {
    console.error('[RasterDemographicsService] Failed to save baked global sectors:', arg0_err)
  }
}

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
 * Reads a 32-bit Float32Array raster from an uncompressed .bmp cache file.
 * Returns null if file is missing, corrupt, or not 64-byte aligned.
 *
 * @param {string} arg0_filepath
 * @param {number} [arg1_w=RASTER_WIDTH]
 * @param {number} [arg2_h=RASTER_HEIGHT]
 *
 * @returns {Float32Array | null}
 */
function readFloat32FromBmp (
  arg0_filepath: string,
  arg1_w = RASTER_WIDTH,
  arg2_h = RASTER_HEIGHT
): Float32Array | null {
  //Convert from parameters
  let filepath = arg0_filepath
  let h = arg2_h
  let w = arg1_w

  //Guard clauses
  if (!fs.existsSync(filepath))
    return null

  //Declare local instance variables
  let buf: Buffer
  let off: number

  //Function body
  try {
    buf = fs.readFileSync(filepath)
    if (buf.length < 64 || buf.readUInt16LE(0) !== 0x4D42)
      return null

    off = buf.readUInt32LE(10)
    if (off % 4 !== 0 || buf.length < off + w*h*4)
      return null

    //Return statement
    return new Float32Array(buf.buffer, buf.byteOffset + off, w*h)
  } catch (arg0_err) {
    console.error(`[RasterDemographicsService] Error reading BMP cache ${filepath}:`, arg0_err)
    return null
  }
}

/**
 * Writes a Float32Array raster to disk as an uncompressed 32-bit .bmp file with 64-byte aligned header.
 *
 * @param {string} arg0_filepath
 * @param {Float32Array} arg1_data
 * @param {number} [arg2_w=RASTER_WIDTH]
 * @param {number} [arg3_h=RASTER_HEIGHT]
 *
 * @returns {boolean}
 */
function writeFloat32AsBmp (
  arg0_filepath: string,
  arg1_data: Float32Array,
  arg2_w = RASTER_WIDTH,
  arg3_h = RASTER_HEIGHT
): boolean {
  //Convert from parameters
  let data = arg1_data
  let filepath = arg0_filepath
  let h = arg3_h
  let w = arg2_w

  //Declare local instance variables
  let fd: number
  let hdr = Buffer.alloc(64)
  let img_bytes = w*h*4
  let pixel_buf: Buffer
  let total_bytes = 64 + img_bytes

  //Function body
  try {
    hdr.writeUInt16LE(0x4D42, 0)
    hdr.writeUInt32LE(total_bytes, 2)
    hdr.writeUInt32LE(0, 6)
    hdr.writeUInt32LE(64, 10)
    hdr.writeUInt32LE(40, 14)
    hdr.writeInt32LE(w, 18)
    hdr.writeInt32LE(-h, 22)
    hdr.writeUInt16LE(1, 26)
    hdr.writeUInt16LE(32, 28)
    hdr.writeUInt32LE(0, 30)
    hdr.writeUInt32LE(img_bytes, 34)
    hdr.writeInt32LE(2835, 38)
    hdr.writeInt32LE(2835, 42)
    hdr.writeUInt32LE(0, 46)
    hdr.writeUInt32LE(0, 50)

    pixel_buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
    fd = fs.openSync(filepath, 'w')
    fs.writeSync(fd, hdr, 0, 64)
    fs.writeSync(fd, pixel_buf, 0, pixel_buf.length)
    fs.closeSync(fd)

    //Return statement
    return true
  } catch (arg0_err) {
    console.error(`[RasterDemographicsService] Error writing BMP cache ${filepath}:`, arg0_err)
    return false
  }
}

/**
 * Reads a big-endian float32 GeoPNG from disk and converts it to a native Float32Array, caching as 32-bit BMP.
 *
 * @param {string} arg0_filepath
 *
 * @returns {Float32Array | null}
 */
function loadGeoPngAsFloat32 (arg0_filepath: string): Float32Array | null {
  //Convert from parameters
  let filepath = arg0_filepath

  //Guard clauses
  if (!filepath)
    return null

  //Declare local instance variables
  let base_name = path.basename(filepath, path.extname(filepath))
  let bmp_path = path.join(BMP_CACHE_DIR, `${base_name}.bmp`)
  let buf: Buffer
  let cached_bmp: Float32Array | null
  let img: any
  let is_stale: boolean
  let out_buf: ArrayBuffer
  let out_f32: Float32Array
  let out_u32: Uint32Array
  let src_u32: Uint32Array

  //Check BMP cache first if fresh
  is_stale = isFileCacheStale(filepath, bmp_path)
  if (!is_stale) {
    cached_bmp = readFloat32FromBmp(bmp_path)
    if (cached_bmp)
      return cached_bmp
  }

  //Guard clause: check if source GeoPNG exists
  if (!fs.existsSync(filepath))
    return null

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

    //Write to BMP cache so all subsequent lookups are instantaneous
    writeFloat32AsBmp(bmp_path, out_f32)

    //Return statement
    return out_f32
  } catch (arg0_err) {
    console.error(`[RasterDemographicsService] Error decoding ${filepath}:`, arg0_err)
    return null
  }
}

/**
 * Ensures that all 36 demographic cohort rasters for a keyframe year exist in BMP cache and are up-to-date.
 *
 * @param {number} arg0_year
 */
function ensureDemographicBmpCache (arg0_year: number): void {
  //Convert from parameters
  let year = arg0_year

  //Function body
  for (let i = 0; i < AGE_COHORTS.length; i++) {
    let cid = AGE_COHORTS[i]
    let f_bmp = path.join(BMP_CACHE_DIR, `f_${cid}_${year}.bmp`)
    let f_png = path.join(COHORTS_DIR, `f_${cid}_${year}.png`)
    let m_bmp = path.join(BMP_CACHE_DIR, `m_${cid}_${year}.bmp`)
    let m_png = path.join(COHORTS_DIR, `m_${cid}_${year}.png`)

    if (isFileCacheStale(f_png, f_bmp))
      loadGeoPngAsFloat32(f_png)
    if (isFileCacheStale(m_png, m_bmp))
      loadGeoPngAsFloat32(m_png)
  }
}

/**
 * Ensures that all 5 sector rasters for a keyframe year exist in BMP cache and are up-to-date.
 *
 * @param {number} arg0_year
 */
function ensureSectorBmpCache (arg0_year: number): void {
  //Convert from parameters
  let year = arg0_year

  //Function body
  for (let i = 0; i < SECTOR_KEYS.length; i++) {
    let s = SECTOR_KEYS[i]
    let s_bmp = path.join(BMP_CACHE_DIR, `${s}_t_${year}.bmp`)
    let s_png = path.join(PROFESSIONS_DIR, `${s}_t_${year}.png`)

    if (isFileCacheStale(s_png, s_bmp))
      loadGeoPngAsFloat32(s_png)
  }
}

/**
 * Executes native C multi-threaded raster reader to process 32-bit BMP rasters in parallel.
 *
 * @param {object} arg0_options
 * @param {string} [arg0_options.country="Global"]
 * @param {boolean} [arg0_options.isGlobal=false]
 * @param {"demographics" | "sectors"} arg0_options.mode
 * @param {ScanlineSpan[]} [arg0_options.spans=[]]
 * @param {number} arg0_options.year
 *
 * @returns {any | null}
 */
function runNativeRasterReader (arg0_options: {
  country?: string
  isGlobal?: boolean
  mode: 'demographics' | 'sectors'
  spans?: ScanlineSpan[]
  year: number
}): any | null {
  //Convert from parameters
  let country = arg0_options.country || 'Global'
  let is_global = arg0_options.isGlobal || false
  let mode = arg0_options.mode
  let spans = arg0_options.spans || []
  let year = arg0_options.year

  //Guard clauses
  if (!fs.existsSync(NATIVE_READER_BIN))
    return null

  //Declare local instance variables
  let args: string[]
  let buf: Buffer | undefined
  let parsed: any
  let proc_res: any

  //Function body
  args = [
    '--mode', mode,
    '--year', String(year),
    '--country', country,
    '--cache-dir', BMP_CACHE_DIR,
  ]
  if (is_global || spans.length === 0)
    args.push('--global')

  if (!is_global && spans.length > 0) {
    buf = Buffer.alloc(4 + 4 + spans.length * 12)
    buf.write('BINS', 0, 4, 'ascii')
    buf.writeUInt32LE(spans.length, 4)
    for (let i = 0; i < spans.length; i++) {
      buf.writeInt32LE(spans[i].row, 8 + i * 12)
      buf.writeInt32LE(spans[i].c_start, 12 + i * 12)
      buf.writeInt32LE(spans[i].c_end, 16 + i * 12)
    }
  }

  try {
    proc_res = spawnSync(NATIVE_READER_BIN, args, {
      encoding: 'utf8',
      input: buf,
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    })

    if (proc_res.status === 0 && proc_res.stdout) {
      parsed = JSON.parse(proc_res.stdout)
      return parsed
    }
  } catch (arg0_err) {
    console.warn('[RasterDemographicsService] Native C reader failed, falling back to JS:', arg0_err)
  }

  //Return statement
  return null
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
  let cached_mtime: number
  let current_mtime: number
  let female_map: Record<string, Float32Array> = {}
  let keyframe_year: number
  let male_map: Record<string, Float32Array> = {}

  //Guard clauses
  keyframe_year = findClosestYear(year, available)

  current_mtime = getDemographicSourceMaxMtime(keyframe_year)
  cached_mtime = demographic_cache_mtimes.get(keyframe_year) ?? 0
  if (current_mtime > cached_mtime) {
    demographic_year_cache.delete(keyframe_year)
    demographic_cache_mtimes.delete(keyframe_year)
  }

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
    if (first_key !== undefined) {
      demographic_year_cache.delete(first_key)
      demographic_cache_mtimes.delete(first_key)
    }
  }

  let year_payload = { f: female_map, m: male_map }
  demographic_cache_mtimes.set(keyframe_year, current_mtime)
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
  let cached_mtime: number
  let current_mtime: number
  let keyframe_year: number
  let sector_map: Record<string, Float32Array> = {}

  //Guard clauses
  keyframe_year = findClosestYear(year, available)

  current_mtime = getSectorSourceMaxMtime(keyframe_year)
  cached_mtime = sector_cache_mtimes.get(keyframe_year) ?? 0
  if (current_mtime > cached_mtime) {
    sector_year_cache.delete(keyframe_year)
    sector_cache_mtimes.delete(keyframe_year)
  }

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
    if (first_key !== undefined) {
      sector_year_cache.delete(first_key)
      sector_cache_mtimes.delete(first_key)
    }
  }

  sector_cache_mtimes.set(keyframe_year, current_mtime)
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
    //Pass 1: exact property match
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

    //Pass 2: historical substring match (e.g. Prussia matching Kingdom of Prussia)
    for (let i = 0; i < hist_res.features.length; i++) {
      let f = hist_res.features[i]
      let p = f.properties
      let cand_name = (p.name || p.cntry_name || p.name_long || p.adm0_a3 || '').toLowerCase().trim()
      if (cand_name) {
        if (
          (clean.length >= 4 && cand_name.includes(clean)) ||
          (cand_name.length >= 4 && clean.includes(cand_name))
        ) {
          return f.geometry
        }
      }
    }
  }

  ne_feats = getNaturalEarthFeatures()
  //Pass 1: Natural Earth exact match
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

  //Pass 2: Natural Earth substring match
  for (let i = 0; i < ne_feats.length; i++) {
    let f = ne_feats[i]
    let p = f.properties
    let cand_name = (p.NAME || p.name || p.ADMIN || p.NAME_LONG || '').toLowerCase().trim()
    if (cand_name) {
      if (
        (clean.length >= 4 && cand_name.includes(clean)) ||
        (cand_name.length >= 4 && clean.includes(cand_name))
      ) {
        return f.geometry
      }
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
  let baked: DemographicCohortResult | undefined
  let dependency_ratio: number
  let female_map: Record<string, number> = {}
  let is_global: boolean
  let keyframe_year: number
  let male_map: Record<string, number> = {}
  let native_res: any
  let old_count = 0
  let rasters: { f: Record<string, Float32Array>; m: Record<string, Float32Array> } | null
  let result_payload: DemographicCohortResult
  let sex_ratio: number
  let source_max_mtime: number
  let spans: ScanlineSpan[] = []
  let total_female = 0
  let total_male = 0
  let total_pop: number
  let working_count = 0
  let youth_count = 0
  let yr_str: string

  //Function body
  if (!geometry && country_name.toLowerCase().trim() !== 'global')
    geometry = resolveCountryGeometry(country_name, year)

  is_global = !geometry || country_name.toLowerCase().trim() === 'global'

  keyframe_year = findClosestYear(year, getAvailableDemographicYears())
  yr_str = String(keyframe_year)

  //Check if source files were modified after cache
  source_max_mtime = getDemographicSourceMaxMtime(keyframe_year)
  if (baked_global_demographics[yr_str]) {
    let baked_mtime = baked_global_demographics[yr_str].lastModified || 0
    if (source_max_mtime > 0 && source_max_mtime > baked_mtime)
      delete baked_global_demographics[yr_str]
  }

  //Check baked global cache first
  if (is_global && baked_global_demographics[yr_str]) {
    baked = baked_global_demographics[yr_str]
    return {
      country: 'Global',
      dependencyRatio: baked.dependencyRatio,
      female: baked.female,
      lastModified: baked.lastModified,
      male: baked.male,
      sexRatio: baked.sexRatio,
      totalFemale: baked.totalFemale,
      totalMale: baked.totalMale,
    }
  }

  if (!is_global)
    spans = computeScanlineSpans(geometry)

  //Attempt fast multi-threaded native C reader first (1 thread per raster)
  ensureDemographicBmpCache(keyframe_year)

  native_res = runNativeRasterReader({
    country: is_global ? 'Global' : country_name,
    isGlobal: is_global,
    mode: 'demographics',
    spans,
    year: keyframe_year,
  })

  if (native_res && native_res.female && native_res.male) {
    result_payload = {
      country: is_global ? 'Global' : country_name,
      dependencyRatio: native_res.dependencyRatio,
      female: native_res.female,
      lastModified: source_max_mtime,
      male: native_res.male,
      sexRatio: native_res.sexRatio,
      totalFemale: native_res.totalFemale,
      totalMale: native_res.totalMale,
    }
    if (is_global)
      saveBakedGlobalDemographic(keyframe_year, result_payload)

    return result_payload
  }

  //Fallback to in-memory JS Float32Array scanner
  rasters = getDemographicYearRasters(year)
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

  result_payload = {
    country: is_global ? 'Global' : country_name,
    dependencyRatio: dependency_ratio,
    female: female_map,
    lastModified: source_max_mtime,
    male: male_map,
    sexRatio: sex_ratio,
    totalFemale: Math.round(total_female*10)/10,
    totalMale: Math.round(total_male*10)/10,
  }
  if (is_global)
    saveBakedGlobalDemographic(keyframe_year, result_payload)

  //Return statement
  return result_payload
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
  let keyframe_year: number
  let native_global: any
  let rasters: Record<string, Float32Array> | null
  let source_max_mtime: number
  let target_entities: { geometry: any; name: string }[] = []
  let yr_str: string

  //Function body
  for (let i = 0; i < geometries.length; i++) {
    if (geometries[i].name && geometries[i].geometry)
      target_entities.push(geometries[i])
  }

  for (let i = 0; i < countries.length; i++) {
    let c_name = countries[i]
    if (c_name.toLowerCase().trim() === 'global')
      continue
    if (!target_entities.some((arg0_t) => arg0_t.name === c_name)) {
      let geom = resolveCountryGeometry(c_name, year)
      if (geom)
        target_entities.push({ geometry: geom, name: c_name })
    }
  }

  keyframe_year = findClosestYear(year, getAvailableSectorYears())
  yr_str = String(keyframe_year)

  //Check if source files were modified after cache
  source_max_mtime = getSectorSourceMaxMtime(keyframe_year)
  if (baked_global_sectors[yr_str]) {
    let baked_mtime = (baked_global_sectors[yr_str] as any).lastModified || 0
    if (source_max_mtime > 0 && source_max_mtime > baked_mtime)
      delete baked_global_sectors[yr_str]
  }

  //Check baked global cache first
  if (baked_global_sectors[yr_str]) {
    for (let i = 0; i < SECTOR_KEYS.length; i++) {
      let s = SECTOR_KEYS[i]
      if (typeof baked_global_sectors[yr_str][s] === 'number')
        global_shares[s] = baked_global_sectors[yr_str][s]
    }
  }

  //If no country entities requested and global shares already baked, return immediately
  if (target_entities.length === 0 && Object.keys(global_shares).length > 0) {
    return {
      byCountry: by_country,
      global: global_shares,
      lastModified: source_max_mtime || ((baked_global_sectors[yr_str] as any)?.lastModified ?? 0),
    }
  }

  //If global shares not yet baked, calculate via native C reader
  if (Object.keys(global_shares).length === 0) {
    ensureSectorBmpCache(keyframe_year)
    native_global = runNativeRasterReader({
      country: 'Global',
      isGlobal: true,
      mode: 'sectors',
      year: keyframe_year,
    })
    if (native_global && native_global.sectors) {
      global_shares = native_global.sectors
      saveBakedGlobalSector(keyframe_year, global_shares)
    }
  }

  //Process target entities via native C reader
  if (target_entities.length > 0) {
    ensureSectorBmpCache(keyframe_year)
    for (let i = 0; i < target_entities.length; i++) {
      let entity = target_entities[i]
      let entity_spans = computeScanlineSpans(entity.geometry)
      let native_entity = runNativeRasterReader({
        country: entity.name,
        isGlobal: false,
        mode: 'sectors',
        spans: entity_spans,
        year: keyframe_year,
      })
      if (native_entity && native_entity.sectors) {
        by_country[entity.name] = native_entity.sectors
      }
    }
  }

  if (Object.keys(global_shares).length > 0 && (target_entities.length === 0 || Object.keys(by_country).length > 0)) {
    return {
      byCountry: by_country,
      global: global_shares,
    }
  }

  //Fallback to in-memory JS Float32Array scanner
  rasters = getSectorYearRasters(year)
  if (rasters) {
    if (Object.keys(global_shares).length === 0) {
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
      saveBakedGlobalSector(keyframe_year, global_shares)
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
    lastModified: source_max_mtime || ((baked_global_sectors[yr_str] as any)?.lastModified ?? 0),
  }
}

export default {
  calculateDemographicPyramid,
  calculateSectorBreakdown,
  computeScanlineSpans,
  getDemographicSourceMaxMtime,
  getLayerYearSourceMtime,
  getSectorSourceMaxMtime,
  isFileCacheStale,
  resolveCountryGeometry,
}
