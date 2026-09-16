/**
 * BMP caching and native raster reader integration for high-performance demographics and sector models.
 */

import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { decode as decodePng } from 'fast-png'
import type { ScanlineSpan } from './rasterScanline.ts'

export let AGE_COHORTS = [
  '00', '01', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', '60', '65', '70', '75', '80'
]

export let SECTOR_KEYS = [
  'agriculture', 'informal_labour', 'manufacturing', 'services', 'not_in_work'
]

export let COHORTS_DIR = 'D:/Project 1509 - SVEA/histmap/3.data_transform/age_sex/4.composite_cohorts'
export let PROFESSIONS_DIR = 'D:/Project 1509 - SVEA/histmap/3.data_transform/professions/4.aggregates'
export let BMP_CACHE_DIR = path.resolve(process.cwd(), 'data/raster_cache')
export let NATIVE_READER_BIN = path.resolve(process.cwd(), 'bin/raster_reader.exe')

if (!fs.existsSync(BMP_CACHE_DIR))
  fs.mkdirSync(BMP_CACHE_DIR, { recursive: true })

export let RASTER_HEIGHT = 2160
export let RASTER_WIDTH = 4320

/**
 * Ensures that all 36 demographic cohort rasters for a keyframe year exist in BMP cache and are up-to-date.
 *
 * @param {number} arg0_year
 */
export function ensureDemographicBmpCache (arg0_year: number): void {
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
export function ensureSectorBmpCache (arg0_year: number): void {
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
 * Checks whether a cache file is missing or older than its source counterpart.
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
 * Reads a big-endian float32 GeoPNG from disk and converts it to a native Float32Array, caching as 32-bit BMP.
 *
 * @param {string} arg0_filepath
 *
 * @returns {Float32Array | null}
 */
export function loadGeoPngAsFloat32 (arg0_filepath: string): Float32Array | null {
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
    console.error(`[RasterBmpCache] Error decoding ${filepath}:`, arg0_err)
    return null
  }
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
export function readFloat32FromBmp (
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
    if (off%4 !== 0 || buf.length < off + w*h*4)
      return null

    //Return statement
    return new Float32Array(buf.buffer, buf.byteOffset + off, w*h)
  } catch (arg0_err) {
    console.error(`[RasterBmpCache] Error reading BMP cache ${filepath}:`, arg0_err)
    return null
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
export function runNativeRasterReader (arg0_options: {
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
    buf = Buffer.alloc(4 + 4 + spans.length*12)
    buf.write('BINS', 0, 4, 'ascii')
    buf.writeUInt32LE(spans.length, 4)
    for (let i = 0; i < spans.length; i++) {
      buf.writeInt32LE(spans[i].row, 8 + i*12)
      buf.writeInt32LE(spans[i].c_start, 12 + i*12)
      buf.writeInt32LE(spans[i].c_end, 16 + i*12)
    }
  }

  try {
    proc_res = spawnSync(NATIVE_READER_BIN, args, {
      encoding: 'utf8',
      input: buf,
      maxBuffer: 10*1024*1024,
      windowsHide: true,
    })

    if (proc_res.status === 0 && proc_res.stdout) {
      parsed = JSON.parse(proc_res.stdout)
      return parsed
    }
  } catch (arg0_err) {
    console.warn('[RasterBmpCache] Native C reader failed, falling back to JS:', arg0_err)
  }

  //Return statement
  return null
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
export function writeFloat32AsBmp (
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
    console.error(`[RasterBmpCache] Error writing BMP cache ${filepath}:`, arg0_err)
    return false
  }
}
