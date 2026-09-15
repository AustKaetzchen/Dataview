import React, { useState, useEffect, useRef } from 'react'
import {
  AppMode,
  DataFormat,
  DecodedRaster,
} from '@/lib/geopng/types'
import {
  decodeRawGeoPngBufferAsync,
  computeRasterDifference,
  buildDecodedRasterResult,
} from '@/lib/geopng/decoder'
import { interpolateRasters } from '@/lib/geopng/interpolate'
import { ParsedDataLayer } from '@/server/layerParser'
import { getPixelOffset } from '@config'

/**
 * Computes Cartesian product of selector choices.
 *
 * @param {Record<string, string | string[]>} arg0_selectors
 *
 * @returns {Array<Record<string, string>>}
 */
export function getSelectorCombinations (
  arg0_selectors: Record<string, string | string[]>
): Array<Record<string, string>> {
  //Convert from parameters
  let selectors = arg0_selectors

  //Declare local instance variables
  let combinations: Array<Record<string, string>> = [{}]
  let keys = Object.keys(selectors)

  //Function body
  for (let i = 0; i < keys.length; i++) {
    let k = keys[i]
    let raw_val = selectors[k]
    let val_array = Array.isArray(raw_val) ? raw_val : [raw_val]
    if (val_array.length === 0)
      continue

    let next_combinations: Array<Record<string, string>> = []
    for (let x = 0; x < combinations.length; x++) {
      let current = combinations[x]
      for (let y = 0; y < val_array.length; y++) {
        let v = val_array[y]
        next_combinations.push({
          ...current,
          [k]: v,
        })
      }
    }
    combinations = next_combinations
  }

  //Return statement
  return combinations
}

/**
 * Shifts a decoded raster vertically north by the specified number of pixels.
 *
 * @param {DecodedRaster} arg0_raster
 * @param {number} arg1_pixels
 *
 * @returns {DecodedRaster}
 */
export function shiftRasterNorth (
  arg0_raster: DecodedRaster,
  arg1_pixels: number
): DecodedRaster {
  //Convert from parameters
  let pixels = Math.max(0, Math.round(arg1_pixels))
  let raster = arg0_raster

  //Guard clauses
  if (pixels === 0)
    return raster

  //Declare local instance variables
  let dst_data: Float32Array
  let h = raster.height
  let src_data = raster.data
  let w = raster.width

  //Function body
  dst_data = new Float32Array(w*h)
  dst_data.fill(NaN)

  for (let r = 0; r < h; r++) {
    let src_r = r + pixels
    if (src_r < h) {
      let dst_offset = r*w
      let src_offset = src_r*w
      for (let c = 0; c < w; c++)
        dst_data[dst_offset + c] = src_data[src_offset + c]
    }
  }

  //Return statement
  return buildDecodedRasterResult(
    dst_data,
    w,
    h,
    raster.min,
    raster.max,
    raster.mean,
    raster.stdDev,
    raster.validCount,
    raster.totalCells
  )
}

/**
 * Culls the in-memory raster cache dynamically based on memory pressure and performant mode.
 *
 * @param {Map<string, DecodedRaster>} arg0_cache
 * @param {boolean} [arg1_performant_mode=false]
 * @param {string} [arg2_preserve_key]
 *
 * @returns {void}
 */
/**
 * Culls the in-memory raster cache dynamically based on memory pressure and performant mode.
 *
 * @param {Map<string, DecodedRaster>} arg0_cache
 * @param {boolean} [arg1_performant_mode=false]
 * @param {string | string[]} [arg2_preserve_keys]
 *
 * @returns {void}
 */
export function cullRasterCache (
  arg0_cache: Map<string, DecodedRaster>,
  arg1_performant_mode?: boolean,
  arg2_preserve_keys?: string | string[],
  arg3_is_playing?: boolean
): void {
  //Convert from parameters
  let cache = arg0_cache
  let is_playing = Boolean(arg3_is_playing)
  let performant_mode = Boolean(arg1_performant_mode)
  let preserve_keys_raw = arg2_preserve_keys

  //Declare local instance variables
  let is_memory_pressured = false
  let max_allowed_entries: number
  let memory_info = (performance as any)?.memory
  let min_required: number
  let preserve_set = new Set<string>()

  //Function body
  if (typeof preserve_keys_raw === 'string') {
    preserve_set.add(preserve_keys_raw)
  } else if (Array.isArray(preserve_keys_raw)) {
    for (let i = 0; i < preserve_keys_raw.length; i++)
      preserve_set.add(preserve_keys_raw[i])
  }

  if (memory_info && memory_info.jsHeapSizeLimit > 0) {
    let heap_ratio = memory_info.usedJSHeapSize/memory_info.jsHeapSizeLimit
    if (heap_ratio > 0.6)
      is_memory_pressured = true
  }

  min_required = Math.max(1, preserve_set.size)
  max_allowed_entries = (performant_mode || is_playing)
    ? min_required
    : (is_memory_pressured ? Math.max(2, min_required) : Math.max(3, min_required))

  if (cache.size > max_allowed_entries) {
    let all_keys = Array.from(cache.keys())
    for (let i = 0; i < all_keys.length; i++) {
      let k = all_keys[i]
      if (cache.size <= max_allowed_entries)
        break
      if (k.startsWith('raw:') && !preserve_set.has(k))
        cache.delete(k)
    }

    if (cache.size > max_allowed_entries) {
      all_keys = Array.from(cache.keys())
      for (let i = 0; i < all_keys.length; i++) {
        let k = all_keys[i]
        if (cache.size <= max_allowed_entries)
          break
        if (!preserve_set.has(k))
          cache.delete(k)
      }
    }
  }
}

let in_flight_fetches = new Map<string, Promise<DecodedRaster | null>>()

/**
 * Fetches and decodes a single GeoPNG raster from backend API.
 *
 * @param {string} arg0_layer_id
 * @param {number} arg1_year
 * @param {Record<string, string>} arg2_selectors
 * @param {DataFormat} arg3_format
 * @param {Map<string, DecodedRaster>} arg4_cache
 * @param {boolean} [arg5_has_selectors]
 * @param {number | { covariate?: string; x?: number; y?: number }} [arg6_pixel_offset]
 * @param {boolean} [arg7_performant_mode]
 * @param {AbortSignal} [arg8_signal]
 *
 * @returns {Promise<DecodedRaster | null>}
 */
export async function fetchSingleDecodedRasterAsync (
  arg0_layer_id: string,
  arg1_year: number,
  arg2_selectors: Record<string, string>,
  arg3_format: DataFormat,
  arg4_cache: Map<string, DecodedRaster>,
  arg5_has_selectors?: boolean,
  arg6_pixel_offset?: number | { covariate?: string; x?: number; y?: number },
  arg7_performant_mode?: boolean,
  arg8_signal?: AbortSignal
): Promise<DecodedRaster | null> {
  //Convert from parameters
  let cache = arg4_cache
  let format = arg3_format
  let has_selectors = Boolean(arg5_has_selectors)
  let layer_id = arg0_layer_id
  let performant_mode = Boolean(arg7_performant_mode)
  let pixel_offset = arg6_pixel_offset
  let selectors = arg2_selectors
  let signal = arg8_signal
  let year = arg1_year

  //Declare local instance variables
  let cache_key: string
  let pending_promise: Promise<DecodedRaster | null>
  let po_key = typeof pixel_offset === 'number'
    ? `po${pixel_offset}`
    : (pixel_offset && typeof pixel_offset === 'object' && pixel_offset.covariate
      ? `po${pixel_offset.y || 0}_${pixel_offset.covariate}`
      : 'po0')
  let sel_keys = has_selectors ? Object.keys(selectors).sort() : []
  let sel_part = sel_keys.map((arg0_k) => `${arg0_k}=${selectors[arg0_k]}`).join(':')

  //Construct cache_key
  cache_key = has_selectors && sel_part.length > 0
    ? `${layer_id}:${sel_part}:${year}:${format}:${po_key}`
    : `${layer_id}:${year}:${format}:${po_key}`

  //Guard clauses
  if (cache.has(cache_key))
    return cache.get(cache_key)!

  if (in_flight_fetches.has(cache_key))
    return in_flight_fetches.get(cache_key)!

  pending_promise = (async () => {
    try {
      let query_params = new URLSearchParams({
        layer: layer_id,
        year: year.toString(),
      })
      if (has_selectors) {
        for (let i = 0; i < sel_keys.length; i++) {
          let sk = sel_keys[i]
          if (selectors[sk])
            query_params.set(sk, selectors[sk])
        }
      }

      let resp = await fetch(`/api/raster/file?${query_params.toString()}`, { signal })
      if (!resp.ok)
        return null

      let buf = await resp.arrayBuffer()
      let uint8 = new Uint8Array(buf)
      let decoded = await decodeRawGeoPngBufferAsync(uint8, format)

      //Apply pixel offset if configured
      if (typeof pixel_offset === 'number' && pixel_offset !== 0) {
        decoded = shiftRasterNorth(decoded, pixel_offset)
      } else if (typeof pixel_offset === 'object' && pixel_offset !== null && pixel_offset.covariate) {
        let covariate_id = pixel_offset.covariate
        let raw_covariate: DecodedRaster | null = null
        let raw_key = `raw:${covariate_id}:${year}:${format}`
        let y_offset = pixel_offset.y ? Math.max(0, Math.round(pixel_offset.y)) : 0

        if (cache.has(raw_key)) {
          raw_covariate = cache.get(raw_key)!
        } else {
          try {
            let cov_resp = await fetch(`/api/raster/file?layer=${covariate_id}&year=${year.toString()}`, { signal })
            if (cov_resp.ok) {
              let cov_buf = await cov_resp.arrayBuffer()
              raw_covariate = await decodeRawGeoPngBufferAsync(new Uint8Array(cov_buf), format)
              if (!performant_mode)
                cache.set(raw_key, raw_covariate)
            }
          } catch (arg0_cov_err) {
            console.error(`Failed to fetch raw covariate ${covariate_id}:`, arg0_cov_err)
          }
        }

        if (raw_covariate && raw_covariate.data.length === decoded.data.length && y_offset > 0) {
          let cov_data = raw_covariate.data
          let h = decoded.height
          let len = decoded.data.length
          let new_total = new Float32Array(len)
          let shifted_cov = shiftRasterNorth(raw_covariate, y_offset)
          let shifted_cov_data = shifted_cov.data
          let tot_data = decoded.data
          let w = decoded.width

          new_total.fill(NaN)

          for (let r = 0; r < h; r++) {
            let row_offset = r*w
            for (let c = 0; c < w; c++) {
              let i = row_offset + c
              let t_val = tot_data[i]
              let c_val = cov_data[i]
              let sc_val = shifted_cov_data[i]

              let rural = Math.max(0, (Number.isNaN(t_val) ? 0 : t_val) - (Number.isNaN(c_val) ? 0 : c_val))

              if ((rural <= 0 || Number.isNaN(rural)) && !Number.isNaN(c_val) && c_val > 0 && Number.isNaN(sc_val)) {
                let count = 0
                let sum = 0
                for (let dr = -2; dr <= 2; dr++) {
                  let nr = r + dr
                  if (nr >= 0 && nr < h) {
                    let n_row_offset = nr*w
                    for (let dc = -2; dc <= 2; dc++) {
                      let nc = c + dc
                      if (nc >= 0 && nc < w) {
                        let ni = n_row_offset + nc
                        let nu = cov_data[ni]
                        let nt = tot_data[ni]
                        if (Number.isNaN(nu) && !Number.isNaN(nt) && nt > 0) {
                          sum += nt
                          count++
                        }
                      }
                    }
                  }
                }
                if (count > 0)
                  rural = Math.round(sum/count)
              }

              let tot = rural + (Number.isNaN(sc_val) ? 0 : sc_val)
              if (tot > 0)
                new_total[i] = tot
            }
          }
          decoded = buildDecodedRasterResult(new_total, decoded.width, decoded.height)
        }
      }

      cache.set(cache_key, decoded)
      cullRasterCache(cache, performant_mode, cache_key)
      return decoded
    } catch (arg0_e: any) {
      if (arg0_e?.name !== 'AbortError')
        console.error(`Failed to fetch raster for ${layer_id} at year ${year}:`, arg0_e)
      return null
    } finally {
      in_flight_fetches.delete(cache_key)
    }
  })()

  in_flight_fetches.set(cache_key, pending_promise)
  return pending_promise
}

/**
 * Fetches and decodes a GeoPNG raster (or composited multi-selector sum) from backend API.
 *
 * @param {string} arg0_layer_id
 * @param {number} arg1_year
 * @param {Record<string, string | string[]>} arg2_selectors
 * @param {DataFormat} arg3_format
 * @param {Map<string, DecodedRaster>} arg4_cache
 * @param {boolean} [arg5_has_selectors]
 * @param {number | { covariate?: string; x?: number; y?: number }} [arg6_pixel_offset]
 * @param {boolean} [arg7_performant_mode]
 * @param {AbortSignal} [arg8_signal]
 *
 * @returns {Promise<DecodedRaster | null>}
 */
export async function fetchRasterKeyframe (
  arg0_layer_id: string,
  arg1_year: number,
  arg2_selectors: Record<string, string | string[]>,
  arg3_format: DataFormat,
  arg4_cache: Map<string, DecodedRaster>,
  arg5_has_selectors?: boolean,
  arg6_pixel_offset?: number | { covariate?: string; x?: number; y?: number },
  arg7_performant_mode?: boolean,
  arg8_signal?: AbortSignal
): Promise<DecodedRaster | null> {
  //Convert from parameters
  let cache = arg4_cache
  let format = arg3_format
  let has_selectors = Boolean(arg5_has_selectors)
  let layer_id = arg0_layer_id
  let performant_mode = Boolean(arg7_performant_mode)
  let pixel_offset = arg6_pixel_offset
  let selectors = arg2_selectors
  let signal = arg8_signal
  let year = arg1_year

  //Declare local instance variables
  let combinations = has_selectors ? getSelectorCombinations(selectors) : [{}]
  let composite_cache_key: string
  let composite_promise: Promise<DecodedRaster | null>
  let po_key = typeof pixel_offset === 'number'
    ? `po${pixel_offset}`
    : (pixel_offset && typeof pixel_offset === 'object' && pixel_offset.covariate
      ? `po${pixel_offset.y || 0}_${pixel_offset.covariate}`
      : 'po0')
  let sel_keys = has_selectors ? Object.keys(selectors).sort() : []
  let sel_part = sel_keys.map((arg0_k) => {
    let val = selectors[arg0_k]
    let str_val = Array.isArray(val) ? val.slice().sort().join(',') : val
    return `${arg0_k}=${str_val}`
  }).join(':')

  //Construct composite_cache_key
  composite_cache_key = has_selectors && sel_part.length > 0
    ? `${layer_id}:${sel_part}:${year}:${format}:${po_key}`
    : `${layer_id}:${year}:${format}:${po_key}`

  //Fast path: already in cache
  if (cache.has(composite_cache_key))
    return cache.get(composite_cache_key)!

  if (in_flight_fetches.has(composite_cache_key))
    return in_flight_fetches.get(composite_cache_key)!

  if (combinations.length <= 1) {
    let single_sel = combinations[0] || {}
    return fetchSingleDecodedRasterAsync(
      layer_id,
      year,
      single_sel,
      format,
      cache,
      has_selectors,
      pixel_offset,
      performant_mode,
      signal
    )
  }

  //Multi-select Cartesian composite
  composite_promise = (async () => {
    try {
      let raster_promises = combinations.map((arg0_comb) =>
        fetchSingleDecodedRasterAsync(
          layer_id,
          year,
          arg0_comb,
          format,
          cache,
          has_selectors,
          pixel_offset,
          performant_mode,
          signal
        )
      )
      let results = await Promise.all(raster_promises)
      let valid_rasters = results.filter((arg0_r): arg0_r is DecodedRaster => arg0_r !== null)

      if (valid_rasters.length === 0)
        return null

      let composite: DecodedRaster
      if (valid_rasters.length === 1) {
        composite = valid_rasters[0]
      } else {
        let base = valid_rasters[0]
        let len = base.width*base.height
        let sum_data = new Float32Array(len)

        for (let i = 0; i < valid_rasters.length; i++) {
          let r_data = valid_rasters[i].data
          for (let idx = 0; idx < len; idx++) {
            let v = r_data[idx]
            if (Number.isNaN(v)) {
              sum_data[idx] = NaN
            } else if (!Number.isNaN(sum_data[idx])) {
              sum_data[idx] += v
            }
          }
        }

        composite = buildDecodedRasterResult(sum_data, base.width, base.height)
      }

      cache.set(composite_cache_key, composite)
      cullRasterCache(cache, performant_mode, composite_cache_key)
      return composite
    } catch (arg0_err: any) {
      if (arg0_err?.name !== 'AbortError')
        console.error(`Failed to composite multi-selector raster for ${layer_id}:`, arg0_err)
      return null
    } finally {
      in_flight_fetches.delete(composite_cache_key)
    }
  })()

  in_flight_fetches.set(composite_cache_key, composite_promise)
  return composite_promise
}

/**
 * Fetches and interpolates rasters between bounding keyframe years for arbitrary timeline years.
 *
 * @param {string} arg0_layer_id
 * @param {number} arg1_timeline_year
 * @param {number[]} arg2_available_years
 * @param {Record<string, string | string[]>} arg3_selectors
 * @param {DataFormat} arg4_format
 * @param {Map<string, DecodedRaster>} arg5_cache
 * @param {boolean} [arg6_has_selectors]
 * @param {number | { covariate?: string; x?: number; y?: number }} [arg7_pixel_offset]
 * @param {boolean} [arg8_performant_mode]
 * @param {boolean} [arg9_snap_to_keyframes]
 * @param {AbortSignal} [arg10_signal]
 *
 * @returns {Promise<DecodedRaster | null>}
 */
export async function fetchInterpolatedRasterAsync (
  arg0_layer_id: string,
  arg1_timeline_year: number,
  arg2_available_years: number[],
  arg3_selectors: Record<string, string | string[]>,
  arg4_format: DataFormat,
  arg5_cache: Map<string, DecodedRaster>,
  arg6_has_selectors?: boolean,
  arg7_pixel_offset?: number | { covariate?: string; x?: number; y?: number },
  arg8_performant_mode?: boolean,
  arg9_snap_to_keyframes?: boolean,
  arg10_signal?: AbortSignal
): Promise<DecodedRaster | null> {
  //Convert from parameters
  let cache = arg5_cache
  let format = arg4_format
  let has_selectors = Boolean(arg6_has_selectors)
  let layer_id = arg0_layer_id
  let performant_mode = Boolean(arg8_performant_mode)
  let pixel_offset = arg7_pixel_offset
  let selectors = arg3_selectors
  let signal = arg10_signal
  let snap_to_keyframes = Boolean(arg9_snap_to_keyframes)
  let timeline_year = arg1_timeline_year
  let years = arg2_available_years

  //Guard clauses
  if (!years || years.length === 0)
    return fetchRasterKeyframe(layer_id, timeline_year, selectors, format, cache, has_selectors, pixel_offset, performant_mode, signal)

  //Declare local instance variables
  let next_year = years[years.length - 1]
  let prev_year = years[0]
  let primary_year: number

  //Function body
  for (let i = 0; i < years.length; i++) {
    if (years[i] <= timeline_year)
      prev_year = years[i]
    if (years[i] >= timeline_year) {
      next_year = years[i]
      break
    }
  }

  if (snap_to_keyframes || prev_year === next_year || timeline_year <= prev_year || timeline_year >= next_year) {
    primary_year = snap_to_keyframes
      ? (Math.abs(timeline_year - prev_year) <= Math.abs(timeline_year - next_year) ? prev_year : next_year)
      : prev_year
    return fetchRasterKeyframe(layer_id, primary_year, selectors, format, cache, has_selectors, pixel_offset, performant_mode, signal)
  }

  let [r_a, r_b] = await Promise.all([
    fetchRasterKeyframe(layer_id, prev_year, selectors, format, cache, has_selectors, pixel_offset, performant_mode, signal),
    fetchRasterKeyframe(layer_id, next_year, selectors, format, cache, has_selectors, pixel_offset, performant_mode, signal),
  ])

  if (r_a && r_b) {
    let t = (timeline_year - prev_year)/(next_year - prev_year)
    return interpolateRasters(r_a, r_b, t)
  }

  //Return statement
  return r_a || r_b || null
}

export interface UseRasterPipelineParams {
  activeLayer: ParsedDataLayer | null
  activeLayerId: string | null
  activeVariableSelectors: Record<string, string | string[]>
  appMode: AppMode
  dataFormat: DataFormat
  isHeadlessExport?: boolean
  isPlaying: boolean
  performantMode: boolean
  snapToKeyframes: boolean
  timelineYear: number
}

export interface UseRasterPipelineResult {
  activeFileName: string
  clearCache: () => void
  diffNameA: string
  diffNameB: string
  displayRaster: DecodedRaster | null
  isLoadingRaster: boolean
  rasterA: DecodedRaster | null
  rasterB: DecodedRaster | null
  rasterCacheRef: React.MutableRefObject<Map<string, DecodedRaster>>
  rasterVersion: number
  rawBytesA: Uint8Array | null
  rawBytesB: Uint8Array | null
  setRasterA: React.Dispatch<React.SetStateAction<DecodedRaster | null>>
  setRasterB: React.Dispatch<React.SetStateAction<DecodedRaster | null>>
  setRasterVersion: React.Dispatch<React.SetStateAction<number>>
  setRawBytesA: React.Dispatch<React.SetStateAction<Uint8Array | null>>
  setRawBytesB: React.Dispatch<React.SetStateAction<Uint8Array | null>>
}

/**
 * Custom hook to manage asynchronous raster keyframe loading, memory-capped caching, and interpolation.
 *
 * @param {UseRasterPipelineParams} arg0_params
 *
 * @returns {UseRasterPipelineResult}
 */
export function useRasterPipeline (arg0_params: UseRasterPipelineParams): UseRasterPipelineResult {
  //Convert from parameters
  let active_layer = arg0_params.activeLayer
  let active_layer_id = arg0_params.activeLayerId
  let active_variable_selectors = arg0_params.activeVariableSelectors
  let app_mode = arg0_params.appMode
  let data_format = arg0_params.dataFormat
  let is_headless_export = Boolean(arg0_params.isHeadlessExport)
  let is_playing = arg0_params.isPlaying
  let performant_mode = arg0_params.performantMode
  let snap_to_keyframes = arg0_params.snapToKeyframes
  let timeline_year = arg0_params.timelineYear

  //Declare local instance variables
  let abort_controller_ref = useRef<AbortController | null>(null)
  let active_file_name: string
  let active_layer_id_ref = useRef<string | null>(active_layer_id)
  let diff_name_a: string
  let diff_name_b: string
  let display_raster: DecodedRaster | null
  let displayed_year_ref = useRef<number | null>(null)
  let in_flight_fetches_count_ref = useRef<number>(0)
  let interp_buffer_ref = useRef<Float32Array | null>(null)
  let is_loading_raster: boolean
  let last_interp_pair_ref = useRef<{ a: DecodedRaster | null; b: DecodedRaster | null; t: number } | null>(null)
  let last_interp_raster_ref = useRef<DecodedRaster | null>(null)
  let load_req_id_ref = useRef<number>(0)
  let raster_a: DecodedRaster | null
  let raster_b: DecodedRaster | null
  let raster_cache_ref = useRef<Map<string, DecodedRaster>>(new Map())
  let raster_version: number
  let raw_bytes_a: Uint8Array | null
  let raw_bytes_b: Uint8Array | null
  let set_active_file_name: React.Dispatch<React.SetStateAction<string>>
  let set_diff_name_a: React.Dispatch<React.SetStateAction<string>>
  let set_diff_name_b: React.Dispatch<React.SetStateAction<string>>
  let set_is_loading_raster: React.Dispatch<React.SetStateAction<boolean>>
  let set_raster_a: React.Dispatch<React.SetStateAction<DecodedRaster | null>>
  let set_raster_b: React.Dispatch<React.SetStateAction<DecodedRaster | null>>
  let set_raster_version: React.Dispatch<React.SetStateAction<number>>
  let set_raw_bytes_a: React.Dispatch<React.SetStateAction<Uint8Array | null>>
  let set_raw_bytes_b: React.Dispatch<React.SetStateAction<Uint8Array | null>>

  //Function body
  ;[active_file_name, set_active_file_name] = useState<string>('')
  ;[diff_name_a, set_diff_name_a] = useState<string>('')
  ;[diff_name_b, set_diff_name_b] = useState<string>('')
  ;[is_loading_raster, set_is_loading_raster] = useState<boolean>(false)
  ;[raster_a, set_raster_a] = useState<DecodedRaster | null>(null)
  ;[raster_b, set_raster_b] = useState<DecodedRaster | null>(null)
  ;[raster_version, set_raster_version] = useState<number>(0)
  ;[raw_bytes_a, set_raw_bytes_a] = useState<Uint8Array | null>(null)
  ;[raw_bytes_b, set_raw_bytes_b] = useState<Uint8Array | null>(null)

  active_layer_id_ref.current = active_layer_id

  //Clear cache when performant mode is toggled
  useEffect(() => {
    raster_cache_ref.current.clear()
    last_interp_pair_ref.current = null
    last_interp_raster_ref.current = null
  }, [performant_mode])

  //Prune stale layer entries when active layer changes
  useEffect(() => {
    let current_layer = active_layer_id
    if (current_layer) {
      let cache = raster_cache_ref.current
      let all_keys = Array.from(cache.keys())
      for (let i = 0; i < all_keys.length; i++) {
        let k = all_keys[i]
        if (!k.startsWith(`${current_layer}:`))
          cache.delete(k)
      }
    }
    last_interp_pair_ref.current = null
    last_interp_raster_ref.current = null
  }, [active_layer_id])

  //Fetch raster keyframes on year/layer/selector update
  useEffect(() => {
    if (!active_layer)
      return

    let requested_layer_id = active_layer_id
    if (!requested_layer_id)
      return

    let years = active_layer.available_years || (active_layer as any).years
    if (!years || years.length === 0)
      return

    //Abort any obsolete in-flight requests immediately
    if (abort_controller_ref.current)
      abort_controller_ref.current.abort()

    let controller = new AbortController()
    abort_controller_ref.current = controller

    let current_req_id = ++load_req_id_ref.current
    let layer_pixel_offset = active_layer.pixel_offset

    let prev_year = years[0]
    let next_year = years[years.length - 1]

    for (let i = 0; i < years.length; i++) {
      if (years[i] <= timeline_year)
        prev_year = years[i]
      if (years[i] >= timeline_year) {
        next_year = years[i]
        break
      }
    }

    let primary_year = snap_to_keyframes
      ? Math.abs(timeline_year - prev_year) <= Math.abs(timeline_year - next_year)
        ? prev_year
        : next_year
      : prev_year

    let is_interpolating = !snap_to_keyframes && prev_year !== next_year && timeline_year > prev_year && timeline_year < next_year

    let effective_format: DataFormat = (active_layer.encoding as DataFormat) || (active_layer as any).format || data_format
    let effective_selectors = active_variable_selectors
    let has_selectors = Boolean(active_layer.variable_selectors && Object.keys(active_layer.variable_selectors).length > 0) || Boolean((active_layer as any).has_selectors)

    let po_key = typeof layer_pixel_offset === 'number'
      ? `po${layer_pixel_offset}`
      : (layer_pixel_offset && typeof layer_pixel_offset === 'object' && layer_pixel_offset.covariate
        ? `po${layer_pixel_offset.y || 0}_${layer_pixel_offset.covariate}`
        : 'po0')
    let sel_keys = has_selectors ? Object.keys(effective_selectors).sort() : []
    let sel_part = sel_keys.map((arg0_k) => {
      let val = effective_selectors[arg0_k]
      let str_val = Array.isArray(val) ? val.slice().sort().join(',') : val
      return `${arg0_k}=${str_val}`
    }).join(':')

    let cache_key_a = has_selectors && sel_part.length > 0
      ? `${requested_layer_id}:${sel_part}:${is_interpolating ? prev_year : primary_year}:${effective_format}:${po_key}`
      : `${requested_layer_id}:${is_interpolating ? prev_year : primary_year}:${effective_format}:${po_key}`

    let cache_key_b = has_selectors && sel_part.length > 0
      ? `${requested_layer_id}:${sel_part}:${next_year}:${effective_format}:${po_key}`
      : `${requested_layer_id}:${next_year}:${effective_format}:${po_key}`

    if (is_interpolating) {
      let has_a = raster_cache_ref.current.has(cache_key_a)
      let has_b = raster_cache_ref.current.has(cache_key_b)

      if (has_a && has_b) {
        displayed_year_ref.current = timeline_year
        set_raster_a(raster_cache_ref.current.get(cache_key_a)!)
        set_raster_b(raster_cache_ref.current.get(cache_key_b)!)
        set_active_file_name(`${requested_layer_id}_${timeline_year}.png`)
        set_raster_version((arg0_v) => arg0_v + 1)
        set_is_loading_raster(false)
        cullRasterCache(raster_cache_ref.current, performant_mode, [cache_key_a, cache_key_b], is_playing)
      } else {
        set_is_loading_raster(true)
        in_flight_fetches_count_ref.current++

        Promise.all([
          fetchRasterKeyframe(requested_layer_id, prev_year, effective_selectors, effective_format, raster_cache_ref.current, has_selectors, layer_pixel_offset, performant_mode, controller.signal),
          fetchRasterKeyframe(requested_layer_id, next_year, effective_selectors, effective_format, raster_cache_ref.current, has_selectors, layer_pixel_offset, performant_mode, controller.signal),
        ])
          .then(([arg0_primary, arg0_secondary]) => {
            in_flight_fetches_count_ref.current = Math.max(0, in_flight_fetches_count_ref.current - 1)
            if (in_flight_fetches_count_ref.current === 0)
              set_is_loading_raster(false)

            if (active_layer_id_ref.current !== requested_layer_id || load_req_id_ref.current !== current_req_id)
              return

            if (arg0_primary) {
              displayed_year_ref.current = timeline_year
              set_raster_a(arg0_primary)
              if (arg0_secondary)
                set_raster_b(arg0_secondary)
              set_active_file_name(`${requested_layer_id}_${timeline_year}.png`)
              set_raster_version((arg0_v) => arg0_v + 1)
              cullRasterCache(raster_cache_ref.current, performant_mode, [cache_key_a, cache_key_b], is_playing)
            }
          })
          .catch((arg0_err) => {
            in_flight_fetches_count_ref.current = Math.max(0, in_flight_fetches_count_ref.current - 1)
            if (in_flight_fetches_count_ref.current === 0)
              set_is_loading_raster(false)
            if (arg0_err?.name !== 'AbortError')
              console.error('Failed to load raster keyframe pair:', arg0_err)
          })
      }
    } else {
      if (raster_cache_ref.current.has(cache_key_a)) {
        let cached = raster_cache_ref.current.get(cache_key_a)!
        displayed_year_ref.current = primary_year
        set_raster_a(cached)
        set_raster_b(null)
        set_active_file_name(`${requested_layer_id}_${primary_year}.png`)
        set_raster_version((arg0_v) => arg0_v + 1)
        set_is_loading_raster(false)
      } else {
        set_is_loading_raster(true)
        in_flight_fetches_count_ref.current++

        fetchRasterKeyframe(
          requested_layer_id,
          primary_year,
          effective_selectors,
          effective_format,
          raster_cache_ref.current,
          has_selectors,
          layer_pixel_offset,
          performant_mode,
          controller.signal
        )
          .then((arg0_primary) => {
            in_flight_fetches_count_ref.current = Math.max(0, in_flight_fetches_count_ref.current - 1)
            if (in_flight_fetches_count_ref.current === 0)
              set_is_loading_raster(false)

            if (active_layer_id_ref.current !== requested_layer_id || load_req_id_ref.current !== current_req_id)
              return

            if (arg0_primary) {
              displayed_year_ref.current = primary_year
              set_raster_a(arg0_primary)
              set_raster_b(null)
              set_active_file_name(`${requested_layer_id}_${primary_year}.png`)
              set_raster_version((arg0_v) => arg0_v + 1)
              cullRasterCache(raster_cache_ref.current, performant_mode, cache_key_a, is_playing)
            }
          })
          .catch((arg0_err) => {
            in_flight_fetches_count_ref.current = Math.max(0, in_flight_fetches_count_ref.current - 1)
            if (in_flight_fetches_count_ref.current === 0)
              set_is_loading_raster(false)
            if (arg0_err?.name !== 'AbortError')
              console.error('Failed to load raster keyframe:', arg0_err)
          })
      }
    }

    //Prefetch upcoming keyframe only when performant mode is OFF and not playing to conserve RAM
    if (!performant_mode && !is_headless_export && !is_playing) {
      let curr_idx = years.indexOf(next_year)
      if (curr_idx !== -1 && curr_idx + 1 < years.length) {
        let future_year = years[curr_idx + 1]
        let schedule_idle = (window as any).requestIdleCallback
          ? (arg0_cb: () => void) => (window as any).requestIdleCallback(arg0_cb, { timeout: 800 })
          : (arg0_cb: () => void) => setTimeout(arg0_cb, 300)

        schedule_idle(() => {
          if (load_req_id_ref.current !== current_req_id)
            return
          fetchRasterKeyframe(
            requested_layer_id,
            future_year,
            effective_selectors,
            effective_format,
            raster_cache_ref.current,
            has_selectors,
            layer_pixel_offset,
            performant_mode
          ).catch(() => {})
        })
      }
    }

    return () => {
      controller.abort()
    }
  }, [
    active_layer,
    active_layer_id,
    active_variable_selectors,
    data_format,
    is_headless_export,
    is_playing,
    performant_mode,
    snap_to_keyframes,
    timeline_year,
  ])

  //Compute active display raster based on app mode (Single Image or Image Difference)
  if (app_mode === 'Image Difference') {
    if (raster_a && raster_b)
      display_raster = computeRasterDifference(raster_a, raster_b)
    else
      display_raster = raster_a
  } else {
    if (!snap_to_keyframes && raster_a && raster_b) {
      let years = active_layer?.available_years || (active_layer as any)?.years || []
      let p_yr = years[0]
      let n_yr = years[years.length - 1]
      for (let i = 0; i < years.length; i++) {
        if (years[i] <= timeline_year)
          p_yr = years[i]
        if (years[i] >= timeline_year) {
          n_yr = years[i]
          break
        }
      }
      if (p_yr !== n_yr && timeline_year > p_yr && timeline_year < n_yr) {
        let t = (timeline_year - p_yr)/(n_yr - p_yr)
        let last_interp = last_interp_pair_ref.current

        if (
          is_playing &&
          last_interp &&
          last_interp.a === raster_a &&
          last_interp.b === raster_b &&
          Math.abs(last_interp.t - t) < 0.015 &&
          last_interp_raster_ref.current
        ) {
          display_raster = last_interp_raster_ref.current
        } else {
          let req_len = raster_a.width*raster_a.height
          if (!interp_buffer_ref.current || interp_buffer_ref.current.length !== req_len)
            interp_buffer_ref.current = new Float32Array(req_len)

          display_raster = interpolateRasters(raster_a, raster_b, t, undefined, interp_buffer_ref.current)
          last_interp_pair_ref.current = { a: raster_a, b: raster_b, t }
          last_interp_raster_ref.current = display_raster
        }
      } else {
        display_raster = raster_a
      }
    } else {
      display_raster = raster_a
    }
  }

  //Return statement
  return {
    activeFileName: active_file_name,
    clearCache: () => raster_cache_ref.current.clear(),
    diffNameA: diff_name_a,
    diffNameB: diff_name_b,
    displayRaster: display_raster,
    isLoadingRaster: is_loading_raster,
    rasterA: raster_a,
    rasterB: raster_b,
    rasterCacheRef: raster_cache_ref,
    rasterVersion: raster_version,
    rawBytesA: raw_bytes_a,
    rawBytesB: raw_bytes_b,
    setRasterA: set_raster_a,
    setRasterB: set_raster_b,
    setRasterVersion: set_raster_version,
    setRawBytesA: set_raw_bytes_a,
    setRawBytesB: set_raw_bytes_b,
  }
}
