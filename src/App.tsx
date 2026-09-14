import React, { useState, useEffect, useMemo, useCallback, useDeferredValue, useRef } from 'react'
import {
  AppMode,
  DataFormat,
  ScaleType,
  ColorPalette,
  BoundsMode,
  ProjectionType,
  DecodedRaster,
  BinningConfig,
  HeightmapConfig,
  CircleOverlayConfig,
  MapModeItem,
  MapModeId,
} from './lib/geopng/types'
import {
  decodeRawGeoPngBufferAsync,
  computeRasterDifference,
  buildDecodedRasterResult,
} from './lib/geopng/decoder'
import { renderRasterToCanvas, getPaletteLUT } from './lib/geopng/palettes'
import { formatLegendValue } from './components/map/ColorBarLegend'
import { computeQuantiles } from './lib/geopng/scales'
import { createBinnedRaster } from './lib/geopng/downsampling'
import {
  CountryFeature,
} from './lib/geopng/polygonBinning'
import { useCountryStatsAsync } from './lib/geopng/useCountryStatsAsync'
import { MAP_CONFIG, MAPMODES_CONFIG, getPixelOffset } from '@config'
import { SidebarControls } from './components/controls/SidebarControls'
import { MapViewer } from './components/map/MapViewer'
import { AnalyticsDrawer } from './components/analytics/AnalyticsDrawer'
import { TimelineBar } from './components/timeline/TimelineBar'
import { VideoExportModal, type StartTimelapseExportOptions } from './components/export/VideoExportModal'
import { interpolateRasters } from './lib/geopng/interpolate'
import { ParsedDataLayer } from './server/layerParser'
import { UserRole } from './components/controls/DataLayersTab'
import { Icon } from './components/ui/icon'
import { UfDate } from './lib/ufDate'
import { toCanvas } from 'html-to-image'

/**
 * Maps raw JSON5 colourscheme strings to the corresponding D3 ColorPalette enum name.
 *
 * @param {string} [arg0_scheme]
 *
 * @returns {ColorPalette | null}
 */
const mapColourschemeToPalette = function (arg0_scheme?: string): ColorPalette | null {
  //Convert from parameters
  let raw = arg0_scheme || ''

  //Declare local instance variables
  let s = raw.toLowerCase().replace(/[^a-z]/g, '')

  //Return statement
  if (s === 'rdylgn')
    return 'RdYlGn'
  if (s === 'turbo')
    return 'Turbo'
  if (s === 'cividis')
    return 'Cividis'
  if (s === 'plasma')
    return 'Plasma'
  if (s === 'reds')
    return 'Reds'
  if (s === 'blues')
    return 'Blues'
  if (s === 'ylorrd')
    return 'YlOrRd'
  if (s === 'ylgnbu')
    return 'YlGnBu'
  if (s === 'brbg')
    return 'BrBG'
  if (s === 'greens')
    return 'Greens'
  if (s === 'viridis')
    return 'Viridis'
  return null
}

/**
 * Fetches and decodes a GeoPNG raster from the backend API for a given layer, year, and selectors.
 *
 * @param {string} arg0_layer_id
 * @param {number} arg1_year
 * @param {Record<string, string>} arg2_selectors
 * @param {DataFormat} arg3_format
 * @param {Map<string, DecodedRaster>} arg4_cache
 *
 * @returns {Promise<DecodedRaster | null>}
 */
const in_flight_fetches = new Map<string, Promise<DecodedRaster | null>>()

/**
 * Applies legend configuration (colourscheme, inversion, scale type, units) from layer or active variable selector option.
 *
 * @param {ParsedDataLayer | null} arg0_layer
 * @param {Record<string, string | string[]>} arg1_selectors
 * @param {(arg0_palette: ColorPalette) => void} arg2_set_palette
 * @param {(arg0_invert: boolean) => void} arg3_set_invert
 * @param {(arg0_scale: ScaleType) => void} arg4_set_scale
 * @param {(arg0_title: string) => void} arg5_set_title
 * @param {(arg0_subtitle: string) => void} arg6_set_subtitle
 */
const applyLayerLegend = function (
  arg0_layer: ParsedDataLayer | null,
  arg1_selectors: Record<string, string | string[]>,
  arg2_set_palette: (arg0_palette: ColorPalette) => void,
  arg3_set_invert: (arg0_invert: boolean) => void,
  arg4_set_scale: (arg0_scale: ScaleType) => void,
  arg5_set_title: (arg0_title: string) => void,
  arg6_set_subtitle: (arg0_subtitle: string) => void
) {
  //Convert from parameters
  let layer = arg0_layer
  let selectors = arg1_selectors
  let set_invert = arg3_set_invert
  let set_palette = arg2_set_palette
  let set_scale = arg4_set_scale
  let set_subtitle = arg6_set_subtitle
  let set_title = arg5_set_title

  //Guard clauses
  if (!layer)
    return

  //Declare local instance variables
  let candidate_legend: { colourscheme?: string; inverted?: boolean; type?: string } | undefined
  let candidate_title = layer.name || layer.id
  let candidate_unit = layer.unit || ''
  let mapped_palette: ColorPalette | null = null

  //Function body
  //Check if any selected variable option has a specific legend (e.g. occupation option)
  if (layer.variable_selectors) {
    let sel_keys = Object.keys(layer.variable_selectors)
    for (let i = 0; i < sel_keys.length; i++) {
      let sk = sel_keys[i]
      let opt_keys = Object.keys(layer.variable_selectors[sk]?.options || {})
      let raw_val = selectors[sk]
      let chosen_vals = Array.isArray(raw_val) ? raw_val : [raw_val || opt_keys[0] || '']
      let primary_val = chosen_vals[0] || ''
      if (primary_val && layer.variable_selectors[sk]?.options[primary_val]) {
        let opt = layer.variable_selectors[sk].options[primary_val]
        if (opt.legend)
          candidate_legend = opt.legend
        if (opt.name) {
          if (chosen_vals.length > 1) {
            candidate_title = `${layer.name} (${chosen_vals.length} selected)`
          } else {
            candidate_title = `${layer.name} (${opt.name})`
          }
        }
      }
    }
  }

  //Fall back to layer legend
  if (!candidate_legend)
    candidate_legend = layer.legend

  //Apply colourscheme
  if (candidate_legend?.colourscheme) {
    mapped_palette = mapColourschemeToPalette(candidate_legend.colourscheme)
    if (mapped_palette)
      set_palette(mapped_palette)
  }

  //Apply inversion
  if (candidate_legend?.inverted !== undefined)
    set_invert(candidate_legend.inverted)
  else
    set_invert(false)

  //Apply scale type
  if (candidate_legend?.type) {
    let t = candidate_legend.type.toLowerCase()
    if (t === 'pseudo-log' || t === 'log')
      set_scale('pseudo-log')
    else
      set_scale('linear')
  }

  //Apply titles
  set_title(candidate_title)
  set_subtitle(candidate_unit)
}

/**
 * Computes Cartesian product of selector choices.
 *
 * @param {Record<string, string | string[]>} arg0_selectors
 *
 * @returns {Array<Record<string, string>>}
 */
const getSelectorCombinations = function (
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
 * Fetches and decodes a single GeoPNG raster from backend API.
 *
 * @param {string} arg0_layer_id
 * @param {number} arg1_year
 * @param {Record<string, string>} arg2_selectors
 * @param {DataFormat} arg3_format
 * @param {Map<string, DecodedRaster>} arg4_cache
 * @param {boolean} [arg5_has_selectors]
 *
 * @returns {Promise<DecodedRaster | null>}
 */
const fetchSingleDecodedRasterAsync = async function (
  arg0_layer_id: string,
  arg1_year: number,
  arg2_selectors: Record<string, string>,
  arg3_format: DataFormat,
  arg4_cache: Map<string, DecodedRaster>,
  arg5_has_selectors?: boolean
): Promise<DecodedRaster | null> {
  //Convert from parameters
  let cache = arg4_cache
  let format = arg3_format
  let has_selectors = Boolean(arg5_has_selectors)
  let layer_id = arg0_layer_id
  let selectors = arg2_selectors
  let year = arg1_year

  //Declare local instance variables
  let cache_key: string
  let pending_promise: Promise<DecodedRaster | null>
  let sel_keys = has_selectors ? Object.keys(selectors).sort() : []
  let sel_part = sel_keys.map((arg0_k) => `${arg0_k}=${selectors[arg0_k]}`).join(':')

  //Construct cache_key
  cache_key = has_selectors && sel_part.length > 0
    ? `${layer_id}:${sel_part}:${year}:${format}`
    : `${layer_id}:${year}:${format}`

  //Return statement
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

      let resp = await fetch(`/api/raster/file?${query_params.toString()}`)
      if (!resp.ok)
        return null

      let buf = await resp.arrayBuffer()
      let uint8 = new Uint8Array(buf)
      let decoded = await decodeRawGeoPngBufferAsync(uint8, format)
      cache.set(cache_key, decoded)
      return decoded
    } catch (arg0_e) {
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
 * Fetches and decodes a GeoPNG raster (or composited multi-selector sum) from the backend API.
 *
 * @param {string} arg0_layer_id
 * @param {number} arg1_year
 * @param {Record<string, string | string[]>} arg2_selectors
 * @param {DataFormat} arg3_format
 * @param {Map<string, DecodedRaster>} arg4_cache
 * @param {boolean} [arg5_has_selectors]
 *
 * @returns {Promise<DecodedRaster | null>}
 */
const fetchRasterKeyframe = async function (
  arg0_layer_id: string,
  arg1_year: number,
  arg2_selectors: Record<string, string | string[]>,
  arg3_format: DataFormat,
  arg4_cache: Map<string, DecodedRaster>,
  arg5_has_selectors?: boolean
): Promise<DecodedRaster | null> {
  //Convert from parameters
  let cache = arg4_cache
  let format = arg3_format
  let has_selectors = Boolean(arg5_has_selectors)
  let layer_id = arg0_layer_id
  let selectors = arg2_selectors
  let year = arg1_year

  //Declare local instance variables
  let combinations = has_selectors ? getSelectorCombinations(selectors) : [{}]
  let composite_cache_key: string
  let composite_promise: Promise<DecodedRaster | null>
  let sel_keys = has_selectors ? Object.keys(selectors).sort() : []
  let sel_part = sel_keys.map((arg0_k) => {
    let val = selectors[arg0_k]
    let str_val = Array.isArray(val) ? val.slice().sort().join(',') : val
    return `${arg0_k}=${str_val}`
  }).join(':')

  //Construct composite_cache_key
  composite_cache_key = has_selectors && sel_part.length > 0
    ? `${layer_id}:${sel_part}:${year}:${format}`
    : `${layer_id}:${year}:${format}`

  //Fast path: already in cache
  if (cache.has(composite_cache_key))
    return cache.get(composite_cache_key)!

  if (in_flight_fetches.has(composite_cache_key))
    return in_flight_fetches.get(composite_cache_key)!

  //If only single combination, delegate directly
  if (combinations.length <= 1) {
    let single_sel = combinations[0] || {}
    return fetchSingleDecodedRasterAsync(layer_id, year, single_sel, format, cache, has_selectors)
  }

  //Multi-select Cartesian composite
  composite_promise = (async () => {
    try {
      let raster_promises = combinations.map((arg0_comb) =>
        fetchSingleDecodedRasterAsync(layer_id, year, arg0_comb, format, cache, has_selectors)
      )
      let results = await Promise.all(raster_promises)
      let valid_rasters = results.filter((arg0_r): arg0_r is DecodedRaster => arg0_r !== null)

      if (valid_rasters.length === 0)
        return null

      if (valid_rasters.length === 1) {
        cache.set(composite_cache_key, valid_rasters[0])
        return valid_rasters[0]
      }

      //Sum pixel values across all selected cohorts / professions
      let base = valid_rasters[0]
      let len = base.width*base.height
      let sum_data = new Float32Array(len)

      for (let i = 0; i < valid_rasters.length; i++) {
        let r_data = valid_rasters[i].data
        for (let idx = 0; idx < len; idx++) {
          sum_data[idx] += r_data[idx]
        }
      }

      let composite = buildDecodedRasterResult(sum_data, base.width, base.height)
      cache.set(composite_cache_key, composite)
      return composite
    } catch (arg0_err) {
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
 * Main application root component managing raster datasets, map layers, and reactive view state.
 *
 * @returns {React.ReactElement}
 */
export const App: React.FC = function () {
  //Declare local instance variables
  let abort_timelapse_export_ref: React.MutableRefObject<boolean>
  let absolute_breaks: string
  let active_countries: CountryFeature[]
  let active_file_name: string
  let active_layer: ParsedDataLayer | null
  let active_layer_id: string | null
  let active_layer_id_ref: React.MutableRefObject<string | null>
  let active_raster: DecodedRaster | null
  let active_variable_selectors: Record<string, string | string[]>
  let analytics_open: boolean
  let app_mode: AppMode
  let available_keyframes: number[]
  let binning_config: BinningConfig
  let bounds_mode: BoundsMode
  let circle_overlay_config: CircleOverlayConfig
  let color_palette: ColorPalette
  let colourbar_width: number
  let countries_mode: boolean
  let data_format: DataFormat
  let deferred_selected_countries: CountryFeature[]
  let diff_name_a: string
  let diff_name_b: string
  let display_raster: DecodedRaster | null
  let displayed_year_ref: React.MutableRefObject<number | null>
  let handle_change_variable_selector: (arg0_key: string, arg1_option: string | string[]) => void
  let handle_clear_countries: () => void
  let handle_file_upload: (arg0_file: File, arg1_target: 'single' | 'diff_a' | 'diff_b') => Promise<void>
  let handle_force_refresh_analytics: () => void
  let handle_reorder_map_modes: (arg0_new_modes: MapModeItem[]) => void
  let handle_select_country: (arg0_c: CountryFeature | null) => void
  let handle_select_layer: (arg0_layer_id: string) => void
  let handle_start_timelapse_export: (arg0_options: StartTimelapseExportOptions) => Promise<void>
  let handle_stop_timelapse_export: () => void
  let handle_toggle_countries_mode: (arg0_enabled: boolean) => void
  let handle_toggle_country: (arg0_c: CountryFeature) => void
  let handle_toggle_map_mode: (arg0_id: MapModeId) => void
  let handle_update_breaks: (arg0_new_breaks: number[]) => void
  let heightmap_config: HeightmapConfig
  let hovered_country: CountryFeature | null
  let in_flight_fetches_count_ref: React.MutableRefObject<number>
  let info_panel_open: boolean
  let inspect_data: any
  let invert_palette: boolean
  let is_hover_only: boolean
  let is_loading_layers: boolean
  let is_loading_raster: boolean
  let is_playing: boolean
  let is_timelapse_exporting: boolean
  let layers: Record<string, ParsedDataLayer>
  let legend_subtitle: string
  let legend_title: string
  let load_req_id_ref: React.MutableRefObject<number>
  let log_sigma: number
  let map_modes: MapModeItem[]
  let max_val_override: string
  let min_val_override: string
  let opacity: number
  let percentile_list: string
  let playback_speed: number
  let projection: ProjectionType
  let raster_a: DecodedRaster | null
  let raster_b: DecodedRaster | null
  let raster_cache_ref: React.MutableRefObject<Map<string, DecodedRaster>>
  let raster_version: number
  let raw_bytes_a: Uint8Array | null
  let raw_bytes_b: Uint8Array | null
  let scale_type: ScaleType
  let selected_countries: CountryFeature[]
  let set_absolute_breaks: React.Dispatch<React.SetStateAction<string>>
  let set_active_file_name: React.Dispatch<React.SetStateAction<string>>
  let set_active_layer_id: React.Dispatch<React.SetStateAction<string | null>>
  let set_active_variable_selectors: React.Dispatch<React.SetStateAction<Record<string, string | string[]>>>
  let set_analytics_open: React.Dispatch<React.SetStateAction<boolean>>
  let set_app_mode: React.Dispatch<React.SetStateAction<AppMode>>
  let set_binning_config: React.Dispatch<React.SetStateAction<BinningConfig>>
  let set_bounds_mode: React.Dispatch<React.SetStateAction<BoundsMode>>
  let set_circle_overlay_config: React.Dispatch<React.SetStateAction<CircleOverlayConfig>>
  let set_color_palette: React.Dispatch<React.SetStateAction<ColorPalette>>
  let set_colourbar_width: React.Dispatch<React.SetStateAction<number>>
  let set_countries_mode: React.Dispatch<React.SetStateAction<boolean>>
  let set_data_format: React.Dispatch<React.SetStateAction<DataFormat>>
  let set_diff_name_a: React.Dispatch<React.SetStateAction<string>>
  let set_diff_name_b: React.Dispatch<React.SetStateAction<string>>
  let set_heightmap_config: React.Dispatch<React.SetStateAction<HeightmapConfig>>
  let set_hovered_country: React.Dispatch<React.SetStateAction<CountryFeature | null>>
  let set_info_panel_open: React.Dispatch<React.SetStateAction<boolean>>
  let set_inspect_data: React.Dispatch<React.SetStateAction<any>>
  let set_invert_palette: React.Dispatch<React.SetStateAction<boolean>>
  let set_is_loading_layers: React.Dispatch<React.SetStateAction<boolean>>
  let set_is_loading_raster: React.Dispatch<React.SetStateAction<boolean>>
  let set_is_playing: React.Dispatch<React.SetStateAction<boolean>>
  let set_is_timelapse_exporting: React.Dispatch<React.SetStateAction<boolean>>
  let set_layers: React.Dispatch<React.SetStateAction<Record<string, ParsedDataLayer>>>
  let set_legend_subtitle: React.Dispatch<React.SetStateAction<string>>
  let set_legend_title: React.Dispatch<React.SetStateAction<string>>
  let set_log_sigma: React.Dispatch<React.SetStateAction<number>>
  let set_map_modes: React.Dispatch<React.SetStateAction<MapModeItem[]>>
  let set_max_val_override: React.Dispatch<React.SetStateAction<string>>
  let set_min_val_override: React.Dispatch<React.SetStateAction<string>>
  let set_opacity: React.Dispatch<React.SetStateAction<number>>
  let set_percentile_list: React.Dispatch<React.SetStateAction<string>>
  let set_playback_speed: React.Dispatch<React.SetStateAction<number>>
  let set_projection: React.Dispatch<React.SetStateAction<ProjectionType>>
  let set_raster_a: React.Dispatch<React.SetStateAction<DecodedRaster | null>>
  let set_raster_b: React.Dispatch<React.SetStateAction<DecodedRaster | null>>
  let set_raster_version: React.Dispatch<React.SetStateAction<number>>
  let set_raw_bytes_a: React.Dispatch<React.SetStateAction<Uint8Array | null>>
  let set_raw_bytes_b: React.Dispatch<React.SetStateAction<Uint8Array | null>>
  let set_scale_type: React.Dispatch<React.SetStateAction<ScaleType>>
  let set_selected_countries: React.Dispatch<React.SetStateAction<CountryFeature[]>>
  let set_settings_drawer_open: React.Dispatch<React.SetStateAction<boolean>>
  let set_sidebar_width: React.Dispatch<React.SetStateAction<number>>
  let set_snap_to_keyframes: React.Dispatch<React.SetStateAction<boolean>>
  let set_timelapse_export_pct: React.Dispatch<React.SetStateAction<number>>
  let set_timelapse_export_result: React.Dispatch<React.SetStateAction<{ filename: string; path: string; sizeBytes: number } | null>>
  let set_timelapse_export_status: React.Dispatch<React.SetStateAction<string>>
  let set_timeline_year: React.Dispatch<React.SetStateAction<number>>
  let set_ui_visible: React.Dispatch<React.SetStateAction<boolean>>
  let set_user_role: React.Dispatch<React.SetStateAction<UserRole>>
  let set_video_export_open: React.Dispatch<React.SetStateAction<boolean>>
  let settings_drawer_open: boolean
  let sidebar_width: number
  let snap_to_keyframes: boolean
  let timelapse_export_pct: number
  let timelapse_export_result: { filename: string; path: string; sizeBytes: number } | null
  let timelapse_export_status: string
  let timeline_year: number
  let timeline_year_ref: React.MutableRefObject<number>
  let ui_visible: boolean
  let user_role: UserRole
  let video_export_open: boolean

  //Function body
  ;[app_mode, set_app_mode] = useState<AppMode>('Single Image')
  ;[data_format, set_data_format] = useState<DataFormat>('float32')
  ;[projection, set_projection] = useState<ProjectionType>('Mercator')
  ;[scale_type, set_scale_type] = useState<ScaleType>('pseudo-log')
  ;[log_sigma, set_log_sigma] = useState<number>(1.0)
  ;[color_palette, set_color_palette] = useState<ColorPalette>('Plasma')
  ;[invert_palette, set_invert_palette] = useState<boolean>(false)
  ;[bounds_mode, set_bounds_mode] = useState<BoundsMode>('Manual')
  ;[min_val_override, set_min_val_override] = useState<string>('')
  ;[max_val_override, set_max_val_override] = useState<string>('')
  ;[percentile_list, set_percentile_list] = useState<string>(
    MAP_CONFIG.defaultPercentileBreaks || '0, 1, 5, 25, 50, 75, 95, 99, 100'
  )
  ;[absolute_breaks, set_absolute_breaks] = useState<string>('0, 10, 50, 100, 500, 1000')
  ;[legend_title, set_legend_title] = useState<string>('Value')
  ;[legend_subtitle, set_legend_subtitle] = useState<string>('')
  ;[opacity, set_opacity] = useState<number>(0.85)

  ;[binning_config, set_binning_config] = useState<BinningConfig>({
    enabled: false,
    height: 360,
    method: 'average',
    width: 720,
  })
  ;[heightmap_config, set_heightmap_config] = useState<HeightmapConfig>({
    blendWeight: 0.5,
    elevationScale: 800000,
    enabled: false,
    heightScaleMode: 'linear',
    opacity: 0.9,
    opacityByPercentile: false,
    opacityByPercentileStrength: 1.0,
    resolutionArcmin: 60,
  })
  ;[sidebar_width, set_sidebar_width] = useState<number>(336)
  ;[colourbar_width, set_colourbar_width] = useState<number>(336)
  ;[info_panel_open, set_info_panel_open] = useState<boolean>(false)
  ;[circle_overlay_config, set_circle_overlay_config] = useState<CircleOverlayConfig>({
    baseRadius: 1.0,
    enabled: false,
    haloWidth: 1,
    percentileCutoff: 99,
    strokeWidth: 2,
  })

  ;[map_modes, set_map_modes] = useState<MapModeItem[]>(() =>
    MAPMODES_CONFIG.modes.map((arg0_m) => ({
      active: arg0_m.active ?? false,
      id: arg0_m.id,
      label: arg0_m.label,
    }))
  )

  ;[analytics_open, set_analytics_open] = useState<boolean>(false)
  ;[settings_drawer_open, set_settings_drawer_open] = useState<boolean>(false)
  ;[raster_version, set_raster_version] = useState<number>(0)
  ;[raw_bytes_a, set_raw_bytes_a] = useState<Uint8Array | null>(null)
  ;[raw_bytes_b, set_raw_bytes_b] = useState<Uint8Array | null>(null)
  ;[raster_a, set_raster_a] = useState<DecodedRaster | null>(null)
  ;[raster_b, set_raster_b] = useState<DecodedRaster | null>(null)
  ;[active_file_name, set_active_file_name] = useState<string>('')
  ;[diff_name_a, set_diff_name_a] = useState<string>('')
  ;[diff_name_b, set_diff_name_b] = useState<string>('')
  ;[selected_countries, set_selected_countries] = useState<CountryFeature[]>([])
  ;[hovered_country, set_hovered_country] = useState<CountryFeature | null>(null)
  ;[countries_mode, set_countries_mode] = useState<boolean>(false)
  ;[inspect_data, set_inspect_data] = useState<any>(null)

  ;[layers, set_layers] = useState<Record<string, ParsedDataLayer>>({})
  ;[active_layer_id, set_active_layer_id] = useState<string | null>('GDP_nominal_pc')
  ;[active_variable_selectors, set_active_variable_selectors] = useState<Record<string, string | string[]>>({
    gender: ['t'],
    profession: ['agriculture'],
  })
  ;[is_loading_layers, set_is_loading_layers] = useState<boolean>(false)
  ;[is_loading_raster, set_is_loading_raster] = useState<boolean>(false)
  ;[is_timelapse_exporting, set_is_timelapse_exporting] = useState<boolean>(false)
  ;[user_role, set_user_role] = useState<UserRole>('developer')
  ;[timeline_year, set_timeline_year] = useState<number>(1950)
  ;[timelapse_export_pct, set_timelapse_export_pct] = useState<number>(0)
  ;[timelapse_export_result, set_timelapse_export_result] = useState<{
    filename: string
    path: string
    sizeBytes: number
  } | null>(null)
  ;[timelapse_export_status, set_timelapse_export_status] = useState<string>('')
  ;[is_playing, set_is_playing] = useState<boolean>(false)
  ;[playback_speed, set_playback_speed] = useState<number>(1)
  ;[snap_to_keyframes, set_snap_to_keyframes] = useState<boolean>(false)
  ;[video_export_open, set_video_export_open] = useState<boolean>(false)
  ;[ui_visible, set_ui_visible] = useState<boolean>(true)
  abort_timelapse_export_ref = useRef<boolean>(false)
  active_layer_id_ref = useRef<string | null>(active_layer_id)
  displayed_year_ref = useRef<number | null>(null)
  in_flight_fetches_count_ref = useRef<number>(0)
  load_req_id_ref = useRef<number>(0)
  raster_cache_ref = useRef<Map<string, DecodedRaster>>(new Map())
  timeline_year_ref = useRef<number>(timeline_year)

  active_layer_id_ref.current = active_layer_id
  timeline_year_ref.current = timeline_year

  deferred_selected_countries = useDeferredValue(selected_countries)

  active_layer = useMemo<ParsedDataLayer | null>(() => {
    if (!active_layer_id)
      return null
    if (layers[active_layer_id])
      return layers[active_layer_id]
    if (active_layer_id.includes('.')) {
      let parent_id = active_layer_id.split('.')[0]
      let parent = layers[parent_id]
      if (parent && parent.sub_layers) {
        let sub = parent.sub_layers.find((arg0_s) => arg0_s.id === active_layer_id)
        if (sub)
          return sub
      }
    }
    return null
  }, [active_layer_id, layers])

  available_keyframes = useMemo<number[]>(() => {
    if (!active_layer || !active_layer.available_years)
      return []
    return active_layer.available_years
  }, [active_layer])

  handle_change_variable_selector = useCallback((arg0_key: string, arg1_option: string | string[]) => {
    let key = arg0_key
    let option = arg1_option
    set_active_variable_selectors((arg0_prev) => ({
      ...arg0_prev,
      [key]: option,
    }))
  }, [])

  handle_select_layer = useCallback((arg0_layer_id: string) => {
    let layer_id = arg0_layer_id
    if (layer_id === 'lfpr')
      layer_id = 'lfpr.lfpr_female'
    set_active_layer_id(layer_id)
  }, [])

  //Apply colourscheme, inversion, scale type, and units from layer/variable selector config
  useEffect(() => {
    if (active_layer) {
      applyLayerLegend(
        active_layer,
        active_variable_selectors,
        set_color_palette,
        set_invert_palette,
        set_scale_type,
        set_legend_title,
        set_legend_subtitle
      )
      if (active_layer.encoding)
        set_data_format(active_layer.encoding)
    }
  }, [active_layer, active_variable_selectors])

  //Populate missing selector defaults when active layer changes
  useEffect(() => {
    if (active_layer && active_layer.variable_selectors) {
      let sel_keys = Object.keys(active_layer.variable_selectors)
      set_active_variable_selectors((arg0_prev) => {
        let changed = false
        let updated = { ...arg0_prev }
        for (let i = 0; i < sel_keys.length; i++) {
          let sk = sel_keys[i]
          let curr = updated[sk]
          let is_empty = curr === undefined || curr === null || (Array.isArray(curr) && curr.length === 0) || curr === ''
          if (is_empty) {
            let opt_keys = Object.keys(active_layer!.variable_selectors![sk].options)
            if (opt_keys.length > 0) {
              updated[sk] = [opt_keys[0]]
              changed = true
            }
          }
        }
        return changed ? updated : arg0_prev
      })
    }
  }, [active_layer])

  //Fetch all available layers from backend API on startup
  useEffect(() => {
    let cancelled = false
    let fetchLayers = async function () {
      set_is_loading_layers(true)
      try {
        let resp = await fetch('/api/layers')
        if (resp.ok) {
          let data = await resp.json()
          if (!cancelled && data && data.layers) {
            set_layers(data.layers)
            let layer_keys = Object.keys(data.layers)
            if (layer_keys.length > 0) {
              let default_key = layer_keys.includes('GDP_nominal_pc') ? 'GDP_nominal_pc' : layer_keys[0]
              set_active_layer_id((arg0_prev) => (arg0_prev && data.layers[arg0_prev] ? arg0_prev : default_key))
            }
          }
        }
      } catch (arg0_err) {
        console.error('Failed to fetch data layers:', arg0_err)
      } finally {
        if (!cancelled)
          set_is_loading_layers(false)
      }
    }
    fetchLayers()
    return () => {
      cancelled = true
    }
  }, [])

  //Load and interpolate rasters whenever layer, selectors, or timeline position change
  useEffect(() => {
    let loadRasters = async function () {
      if (!active_layer || !active_layer.available_years || active_layer.available_years.length === 0)
        return

      let current_req_id = ++load_req_id_ref.current
      let requested_layer_id = active_layer.id
      let requested_selectors = { ...active_variable_selectors }
      let years = active_layer.available_years
      let prev_year = years[0]
      let next_year = years[years.length - 1]
      let t = 0

      //Determine keyframes bounding current year
      if (snap_to_keyframes) {
        let closest = years[0]
        let min_dist = Math.abs(timeline_year - closest)
        for (let i = 1; i < years.length; i++) {
          let dist = Math.abs(timeline_year - years[i])
          if (dist < min_dist) {
            min_dist = dist
            closest = years[i]
          }
        }
        prev_year = closest
        next_year = closest
        t = 0
      } else if (timeline_year <= years[0]) {
        prev_year = years[0]
        next_year = years[0]
        t = 0
      } else if (timeline_year >= years[years.length - 1]) {
        prev_year = years[years.length - 1]
        next_year = years[years.length - 1]
        t = 0
      } else {
        for (let i = 0; i < years.length - 1; i++) {
          if (timeline_year >= years[i] && timeline_year <= years[i + 1]) {
            prev_year = years[i]
            next_year = years[i + 1]
            t = next_year > prev_year ? (timeline_year - prev_year)/(next_year - prev_year) : 0
            break
          }
        }
      }

      let has_selectors = Boolean(active_layer.variable_selectors && Object.keys(active_layer.variable_selectors).length > 0)
      let primary_year = (t === 0 || prev_year === next_year) ? prev_year : (t < 0.5 ? prev_year : next_year)

      //Resolve effective selectors with fallback to first option
      let effective_selectors: Record<string, string | string[]> = {}
      if (has_selectors && active_layer.variable_selectors) {
        let sel_keys = Object.keys(active_layer.variable_selectors)
        for (let i = 0; i < sel_keys.length; i++) {
          let sk = sel_keys[i]
          let opt_keys = Object.keys(active_layer.variable_selectors[sk].options)
          let val = requested_selectors[sk]
          effective_selectors[sk] = (val !== undefined && (Array.isArray(val) ? val.length > 0 : Boolean(val)))
            ? val
            : (opt_keys.length > 0 ? [opt_keys[0]] : '')
        }
      }

      let sel_keys = has_selectors ? Object.keys(effective_selectors).sort() : []
      let sel_part = sel_keys.map((arg0_k) => {
        let val = effective_selectors[arg0_k]
        let str_val = Array.isArray(val) ? val.slice().sort().join(',') : val
        return `${arg0_k}=${str_val}`
      }).join(':')
      let cache_key = has_selectors && sel_part.length > 0
        ? `${requested_layer_id}:${sel_part}:${primary_year}:${data_format}`
        : `${requested_layer_id}:${primary_year}:${data_format}`
      let is_cached = raster_cache_ref.current.has(cache_key)

      //Fast path: if already cached in memory, apply synchronously to avoid frame drops during playback/scrubbing
      if (is_cached) {
        let primary_raster = raster_cache_ref.current.get(cache_key)!
        displayed_year_ref.current = primary_year

        if (prev_year === next_year || t === 0 || is_playing) {
          set_raster_a(primary_raster)
          set_active_file_name(`${requested_layer_id}_${primary_year}.png`)
          set_raster_version((arg0_v) => arg0_v + 1)
        } else {
          let other_year = primary_year === prev_year ? next_year : prev_year
          let other_cache_key = has_selectors && sel_part.length > 0
            ? `${requested_layer_id}:${sel_part}:${other_year}:${data_format}`
            : `${requested_layer_id}:${other_year}:${data_format}`
          if (raster_cache_ref.current.has(other_cache_key)) {
            let other_raster = raster_cache_ref.current.get(other_cache_key)!
            let r_prev = primary_year === prev_year ? primary_raster : other_raster
            let r_next = primary_year === prev_year ? other_raster : primary_raster
            let interpolated = interpolateRasters(r_prev, r_next, t, true)
            set_raster_a(interpolated)
            set_active_file_name(`${requested_layer_id}_${timeline_year.toFixed(1)}.png`)
            set_raster_version((arg0_v) => arg0_v + 1)
          } else {
            set_raster_a(primary_raster)
            set_active_file_name(`${requested_layer_id}_${primary_year}.png`)
            set_raster_version((arg0_v) => arg0_v + 1)
          }
        }

        if (in_flight_fetches_count_ref.current === 0)
          set_is_loading_raster(false)
      } else {
        //Slow path: asynchronous fetch
        set_is_loading_raster(true)
        in_flight_fetches_count_ref.current++

        fetchRasterKeyframe(
          requested_layer_id,
          primary_year,
          effective_selectors,
          data_format,
          raster_cache_ref.current,
          has_selectors
        ).then((arg0_primary) => {
          in_flight_fetches_count_ref.current = Math.max(0, in_flight_fetches_count_ref.current - 1)
          if (in_flight_fetches_count_ref.current === 0)
            set_is_loading_raster(false)

          //Only apply if still on the same active layer
          if (active_layer_id_ref.current !== requested_layer_id)
            return

          if (arg0_primary) {
            displayed_year_ref.current = primary_year
            set_raster_a(arg0_primary)
            set_active_file_name(`${requested_layer_id}_${primary_year}.png`)
            set_raster_version((arg0_v) => arg0_v + 1)
          }
        }).catch((arg0_err) => {
          in_flight_fetches_count_ref.current = Math.max(0, in_flight_fetches_count_ref.current - 1)
          if (in_flight_fetches_count_ref.current === 0)
            set_is_loading_raster(false)
          console.error('Failed to load raster keyframe:', arg0_err)
        })
      }

      //Prefetch upcoming 4 keyframes in the background for ultra-smooth 60fps playback
      let curr_idx = years.indexOf(next_year)
      if (curr_idx !== -1) {
        for (let step = 1; step <= 4; step++) {
          if (curr_idx + step < years.length) {
            let future_year = years[curr_idx + step]
            fetchRasterKeyframe(
              requested_layer_id,
              future_year,
              effective_selectors,
              data_format,
              raster_cache_ref.current,
              has_selectors
            ).catch(() => {})
          }
        }
      }
    }

    loadRasters()
  }, [active_layer, active_variable_selectors, timeline_year, snap_to_keyframes, data_format, is_playing])


  useEffect(() => {
    let cancelled = false
    let redecode = async function () {
      if (raw_bytes_a) {
        let decoded_a = await decodeRawGeoPngBufferAsync(raw_bytes_a, data_format)
        if (!cancelled)
          set_raster_a(decoded_a)
      }
      if (raw_bytes_b) {
        let decoded_b = await decodeRawGeoPngBufferAsync(raw_bytes_b, data_format)
        if (!cancelled)
          set_raster_b(decoded_b)
      }
      if (!cancelled)
        set_raster_version((arg0_v) => arg0_v + 1)
    }
    redecode()
    return () => {
      cancelled = true
    }
  }, [data_format])

  handle_file_upload = useCallback(
    async function (arg0_file: File, arg1_target: 'single' | 'diff_a' | 'diff_b') {
      let file = arg0_file
      let target = arg1_target
      try {
        let buffer = await file.arrayBuffer()
        let uint8 = new Uint8Array(buffer)
        let decoded = await decodeRawGeoPngBufferAsync(uint8, data_format)

        if (target === 'single') {
          set_raw_bytes_a(uint8)
          set_raster_a(decoded)
          set_active_file_name(file.name)
        } else if (target === 'diff_a') {
          set_raw_bytes_a(uint8)
          set_raster_a(decoded)
          set_diff_name_a(file.name)
        } else if (target === 'diff_b') {
          set_raw_bytes_b(uint8)
          set_raster_b(decoded)
          set_diff_name_b(file.name)
        }
        set_raster_version((arg0_v) => arg0_v + 1)
      } catch (arg0_err) {
        console.error('Failed to load GeoPNG file:', arg0_err)
      }
    },
    [data_format]
  )

  handle_force_refresh_analytics = useCallback(() => {
    set_raster_version((arg0_v) => arg0_v + 1)
  }, [])

  active_raster = useMemo<DecodedRaster | null>(() => {
    if (app_mode === 'Single Image')
      return raster_a
    if (raster_a && raster_b)
      return computeRasterDifference(raster_a, raster_b)
    return raster_a
  }, [app_mode, raster_a, raster_b])

  display_raster = useMemo<DecodedRaster | null>(() => {
    if (!active_raster)
      return null
    if (!binning_config.enabled)
      return active_raster
    try {
      return createBinnedRaster(
        active_raster,
        binning_config.width,
        binning_config.height,
        binning_config.method
      )
    } catch (arg0_e) {
      console.error('Failed to bin raster:', arg0_e)
      return active_raster
    }
  }, [active_raster, binning_config])

  let { breaks, maxVal: max_val, minVal: min_val } = useMemo(() => {
    let r = display_raster || active_raster
    if (!r)
      return { breaks: [], maxVal: 1, minVal: 0 }

    if (bounds_mode === 'Percentile') {
      let parts = percentile_list
        .split(',')
        .map((arg0_s) => parseFloat(arg0_s.trim()))
        .filter((arg0_n) => !Number.isNaN(arg0_n))
        .map((arg0_p) => arg0_p/100)

      if (parts.length > 0) {
        let q_breaks = computeQuantiles(r.data, parts)
        let p_max = Math.max(...q_breaks)
        let p_min = Math.min(...q_breaks)
        return { breaks: q_breaks, maxVal: p_max, minVal: p_min }
      }
    } else if (bounds_mode === 'Absolute') {
      let parts = absolute_breaks
        .split(',')
        .map((arg0_s) => parseFloat(arg0_s.trim()))
        .filter((arg0_n) => !Number.isNaN(arg0_n))
        .sort((arg0_a, arg0_b) => arg0_a - arg0_b)

      if (parts.length >= 2) {
        return {
          breaks: parts,
          maxVal: parts[parts.length - 1],
          minVal: parts[0],
        }
      }
    }

    let parsed_max = max_val_override !== '' ? parseFloat(max_val_override) : r.max
    let parsed_min = min_val_override !== '' ? parseFloat(min_val_override) : r.min

    let safe_max = Number.isFinite(parsed_max) ? parsed_max : r.max
    let safe_min = Number.isFinite(parsed_min) ? parsed_min : r.min

    return { breaks: [], maxVal: safe_max, minVal: safe_min }
  }, [display_raster, active_raster, bounds_mode, percentile_list, absolute_breaks, min_val_override, max_val_override])

  handle_toggle_country = useCallback((arg0_c: CountryFeature) => {
    let c = arg0_c
    set_selected_countries((arg0_prev) => {
      let exists = arg0_prev.some(
        (arg0_x) =>
          (arg0_x.properties.iso_a3 && arg0_x.properties.iso_a3 !== '-99' && arg0_x.properties.iso_a3 === c.properties.iso_a3) ||
          arg0_x.properties.name === c.properties.name
      )
      if (exists) {
        return arg0_prev.filter(
          (arg0_x) =>
            !(
              (arg0_x.properties.iso_a3 && arg0_x.properties.iso_a3 !== '-99' && arg0_x.properties.iso_a3 === c.properties.iso_a3) ||
              arg0_x.properties.name === c.properties.name
            )
        )
      }
      return [...arg0_prev, c]
    })
  }, [])

  handle_clear_countries = useCallback(() => {
    set_selected_countries([])
  }, [])

  handle_select_country = useCallback(
    (arg0_c: CountryFeature | null) => {
      let c = arg0_c
      if (!c) {
        set_selected_countries([])
      } else {
        handle_toggle_country(c)
      }
    },
    [handle_toggle_country]
  )

  handle_toggle_countries_mode = useCallback((arg0_enabled: boolean) => {
    let enabled = arg0_enabled
    set_countries_mode(enabled)
    set_map_modes((arg0_prev) =>
      arg0_prev.map((arg0_m) => (arg0_m.id === 'country_analysis' ? { ...arg0_m, active: enabled } : arg0_m))
    )
  }, [])

  handle_toggle_map_mode = useCallback((arg0_id: MapModeId) => {
    let id = arg0_id
    set_map_modes((arg0_prev) => {
      let circle_active: boolean
      let country_active: boolean
      let spike_active: boolean
      let updated = arg0_prev.map((arg0_m) => (arg0_m.id === id ? { ...arg0_m, active: !arg0_m.active } : arg0_m))

      country_active = updated.find((arg0_m) => arg0_m.id === 'country_analysis')?.active ?? false
      spike_active = updated.find((arg0_m) => arg0_m.id === 'spike_map')?.active ?? false
      circle_active = updated.find((arg0_m) => arg0_m.id === 'circle_sizing')?.active ?? false

      set_countries_mode(country_active)
      set_heightmap_config((arg0_h) => ({ ...arg0_h, enabled: spike_active }))
      set_circle_overlay_config((arg0_c) => ({ ...arg0_c, enabled: circle_active }))
      return updated
    })
  }, [])

  handle_reorder_map_modes = useCallback((arg0_new_modes: MapModeItem[]) => {
    let new_modes = arg0_new_modes
    set_map_modes(new_modes)
  }, [])

  handle_update_breaks = useCallback((arg0_new_breaks: number[]) => {
    let new_breaks = arg0_new_breaks
    set_bounds_mode('Absolute')
    set_absolute_breaks(new_breaks.map((arg0_n) => (Math.round(arg0_n*1000)/1000).toString()).join(', '))
  }, [])

  handle_start_timelapse_export = useCallback(
    async function (arg0_options: StartTimelapseExportOptions) {
      //Convert from parameters
      let options = arg0_options

      //Declare local instance variables
      let all_layer_entries: ParsedDataLayer[]
      let all_target_years: number[]
      let base_name: string
      let chunks: Blob[] = []
      let clean_filename: string
      let end_yr: number
      let export_h = 1080
      let export_w = 1920
      let ext: string
      let final_blob: Blob
      let frames_per_keyframe = 15
      let is_mp4: boolean
      let layers_to_record: string[] = []
      let mime_type = ''
      let overall_step = 0
      let record_canvas: HTMLCanvasElement
      let record_ctx: CanvasRenderingContext2D | null
      let recorder: MediaRecorder
      let save_result: any
      let seq_years: number[]
      let start_yr: number
      let stop_promise: Promise<Blob>
      let stream: MediaStream
      let total_overall_steps = 0
      let upload_resp: Response

      //Guard clauses
      if (Object.keys(layers).length === 0 && !active_layer)
        return

      //Function body
      abort_timelapse_export_ref.current = false
      set_is_playing(false)
      set_video_export_open(false)
      set_is_timelapse_exporting(true)
      set_timelapse_export_pct(0)
      set_timelapse_export_status('Initializing timelapse recording canvas...')
      set_timelapse_export_result(null)

      try {
        all_layer_entries = Object.values(layers)

        //Resolve layers to record
        if (options.mode === 'stationary') {
          layers_to_record = (options.selectedLayers && options.selectedLayers.length > 0)
            ? [options.selectedLayers[0]]
            : (active_layer_id ? [active_layer_id] : [all_layer_entries[0]?.id || 'GDP_nominal_pc'])
        } else {
          layers_to_record = (options.selectedLayers && options.selectedLayers.length > 0)
            ? options.selectedLayers
            : all_layer_entries.slice(0, 8).map((arg0_l) => arg0_l.id)
        }

        //Collect keyframe years
        all_target_years = []
        for (let i = 0; i < layers_to_record.length; i++) {
          let lid = layers_to_record[i]
          let lyr = layers[lid] || (active_layer?.id === lid ? active_layer : null)
          if (lyr?.available_years) {
            for (let y = 0; y < lyr.available_years.length; y++) {
              let yr_val = lyr.available_years[y]
              if (!all_target_years.includes(yr_val))
                all_target_years.push(yr_val)
            }
          }
        }
        if (all_target_years.length === 0)
          all_target_years = [1800, 1850, 1900, 1950, 2000, 2025]
        all_target_years.sort((arg0_a, arg0_b) => arg0_a - arg0_b)

        seq_years = all_target_years.filter((arg0_y) => arg0_y >= options.startYear && arg0_y <= options.endYear)
        if (seq_years.length === 0)
          seq_years = [all_target_years[0]]

        start_yr = seq_years[0]
        end_yr = seq_years[seq_years.length - 1]
        total_overall_steps = seq_years.length*layers_to_record.length

        let raw_w = window.innerWidth || 1920
        let raw_h = window.innerHeight || 1080
        export_w = raw_w % 2 === 0 ? raw_w : raw_w + 1
        export_h = raw_h % 2 === 0 ? raw_h : raw_h + 1

        record_canvas = document.createElement('canvas')
        record_canvas.width = export_w
        record_canvas.height = export_h
        record_ctx = record_canvas.getContext('2d')
        if (!record_ctx)
          throw new Error('Could not create 2D canvas context for timelapse export')

        stream = record_canvas.captureStream(options.fps || 30)

        //Prioritize video/mp4 where supported
        if (typeof MediaRecorder !== 'undefined') {
          if (MediaRecorder.isTypeSupported('video/mp4')) {
            mime_type = 'video/mp4'
          } else if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
            mime_type = 'video/mp4;codecs=avc1'
          } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
            mime_type = 'video/webm;codecs=vp9'
          } else if (MediaRecorder.isTypeSupported('video/webm')) {
            mime_type = 'video/webm'
          }
        }

        recorder = new MediaRecorder(stream, {
          mimeType: mime_type || undefined,
          videoBitsPerSecond: 8000000,
        })

        recorder.ondataavailable = (arg0_e) => {
          if (arg0_e.data && arg0_e.data.size > 0)
            chunks.push(arg0_e.data)
        }

        recorder.start()

        for (let y_idx = 0; y_idx < seq_years.length; y_idx++) {
          let yr = seq_years[y_idx]
          if (abort_timelapse_export_ref.current)
            break

          for (let l_idx = 0; l_idx < layers_to_record.length; l_idx++) {
            let layer_id = layers_to_record[l_idx]
            if (abort_timelapse_export_ref.current)
              break

            let target_layer = layers[layer_id] || (active_layer?.id === layer_id ? active_layer : null)
            let layer_name = target_layer?.name || layer_id

            set_active_layer_id(layer_id)
            set_timeline_year(yr)
            displayed_year_ref.current = yr

            set_timelapse_export_status(`Recording keyframe ${overall_step + 1}/${total_overall_steps}: ${layer_name} (${UfDate.formatYear(yr)})...`)
            set_timelapse_export_pct(Math.round((overall_step / total_overall_steps)*100))

            let has_selectors = Boolean(target_layer?.variable_selectors && Object.keys(target_layer.variable_selectors).length > 0)
            let effective_selectors: Record<string, string | string[]> = {}
            if (has_selectors && target_layer?.variable_selectors) {
              let sel_keys = Object.keys(target_layer.variable_selectors)
              for (let i = 0; i < sel_keys.length; i++) {
                let sk = sel_keys[i]
                let opt_keys = Object.keys(target_layer.variable_selectors[sk].options)
                let val = active_variable_selectors[sk]
                effective_selectors[sk] = (val !== undefined && (Array.isArray(val) ? val.length > 0 : Boolean(val)))
                  ? val
                  : (opt_keys.length > 0 ? [opt_keys[0]] : '')
              }
            }

            let decoded = await fetchRasterKeyframe(
              layer_id,
              yr,
              effective_selectors,
              data_format,
              raster_cache_ref.current,
              has_selectors
            )

            if (decoded) {
              set_raster_a(decoded)
              set_active_file_name(`${layer_id}_${yr}.png`)
              set_raster_version((arg0_v) => arg0_v + 1)
            }

            //Wait for React and deck.gl to complete render
            await new Promise((arg0_resolve) => requestAnimationFrame(() => requestAnimationFrame(arg0_resolve)))
            await new Promise((arg0_resolve) => setTimeout(arg0_resolve, 80))

            if (abort_timelapse_export_ref.current)
              break

            let map_canvas = document.querySelector('#deckgl-overlay canvas') as HTMLCanvasElement | null
            if (!map_canvas)
              map_canvas = document.querySelector('canvas') as HTMLCanvasElement | null

            record_ctx.fillStyle = '#0b0f19'
            record_ctx.fillRect(0, 0, export_w, export_h)

            if (map_canvas && map_canvas.width > 0 && map_canvas.height > 0) {
              record_ctx.drawImage(map_canvas, 0, 0, export_w, export_h)
            }

            //1. Draw real ColorBarLegend component from DOM
            let colourbar_node = document.getElementById('dataview-colourbar-container')
            if (colourbar_node) {
              try {
                let cb_rendered = await toCanvas(colourbar_node, {
                  pixelRatio: 1,
                  skipFonts: true,
                })
                if (cb_rendered && cb_rendered.width > 0 && cb_rendered.height > 0) {
                  let cb_rect = colourbar_node.getBoundingClientRect()
                  record_ctx.drawImage(
                    cb_rendered,
                    Math.round(cb_rect.left),
                    Math.round(cb_rect.top),
                    Math.round(cb_rect.width),
                    Math.round(cb_rect.height)
                  )
                }
              } catch (arg0_cb_err) {
                console.warn('[TimelapseExport] Failed to capture colourbar node:', arg0_cb_err)
              }
            }

            //2. Draw real TimelineBar component from DOM
            let timelinebar_node = document.getElementById('dataview-timelinebar-container')
            if (timelinebar_node) {
              try {
                let tb_rendered = await toCanvas(timelinebar_node, {
                  pixelRatio: 1,
                  skipFonts: true,
                })
                if (tb_rendered && tb_rendered.width > 0 && tb_rendered.height > 0) {
                  let tb_rect = timelinebar_node.getBoundingClientRect()
                  record_ctx.drawImage(
                    tb_rendered,
                    Math.round(tb_rect.left),
                    Math.round(tb_rect.top),
                    Math.round(tb_rect.width),
                    Math.round(tb_rect.height)
                  )
                }
              } catch (arg0_tb_err) {
                console.warn('[TimelapseExport] Failed to capture timelinebar node:', arg0_tb_err)
              }
            }

            //Tick stream
            for (let frame_idx = 0; frame_idx < frames_per_keyframe; frame_idx++) {
              if (abort_timelapse_export_ref.current)
                break
              await new Promise((arg0_resolve) => setTimeout(arg0_resolve, 1000/(options.fps || 30)))
            }

            overall_step++
          }
        }

        set_timelapse_export_status('Encoding recorded frames and uploading to server...')
        set_timelapse_export_pct(100)

        stop_promise = new Promise<Blob>((arg0_resolve) => {
          recorder.onstop = () => {
            let blob = new Blob(chunks, { type: mime_type || 'video/webm' })
            arg0_resolve(blob)
          }
        })

        recorder.stop()
        final_blob = await stop_promise

        if (final_blob.size === 0)
          throw new Error('Recorded timelapse video stream was empty.')

        let reader = new FileReader()
        let base64_promise = new Promise<string>((arg0_resolve, arg0_reject) => {
          reader.onloadend = () => {
            if (typeof reader.result === 'string')
              arg0_resolve(reader.result)
            else
              arg0_reject(new Error('Failed to convert video blob to base64'))
          }
          reader.onerror = arg0_reject
        })
        reader.readAsDataURL(final_blob)
        let base64_data = await base64_promise

        is_mp4 = mime_type.includes('mp4')
        ext = is_mp4 ? 'mp4' : 'webm'
        base_name = (options.filename || `timelapse_${Date.now()}`).replace(/\.(mp4|webm)$/i, '')
        clean_filename = `${base_name}.${ext}`

        upload_resp = await fetch('/api/export/video', {
          body: JSON.stringify({
            data: base64_data,
            filename: clean_filename,
            format: ext,
            metadata: { mimeType: mime_type },
            videoData: base64_data,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        })

        if (!upload_resp.ok) {
          let err_msg = await upload_resp.text()
          throw new Error(`Server video error: ${err_msg}`)
        }

        save_result = await upload_resp.json()
        console.log('[Timelapse Export] Video successfully saved to server:', save_result.path, `(${save_result.sizeBytes} bytes)`)
        set_timelapse_export_result(save_result)
        let stopped_notice = abort_timelapse_export_ref.current ? ' (stopped by user)' : ''
        set_timelapse_export_status(`Saved to exports/${save_result.filename}${stopped_notice} (${(save_result.sizeBytes / (1024*1024)).toFixed(2)} MB)`)
      } catch (arg0_err: any) {
        console.error('Timelapse video export failed:', arg0_err)
        set_timelapse_export_status(`Export failed: ${arg0_err?.message || 'Unknown error'}`)
      } finally {
        set_is_timelapse_exporting(false)
      }
    },
    [active_layer, active_layer_id, active_variable_selectors, color_palette, data_format, invert_palette, layers, max_val, min_val, scale_type]
  )

  handle_stop_timelapse_export = useCallback(() => {
    abort_timelapse_export_ref.current = true
    set_timelapse_export_status('Stopping recording and finalizing video...')
  }, [])

  active_countries = useMemo<CountryFeature[]>(() => {
    if (selected_countries.length > 0)
      return selected_countries
    if (countries_mode && hovered_country)
      return [hovered_country]
    return []
  }, [countries_mode, selected_countries, hovered_country])

  is_hover_only = selected_countries.length === 0 && Boolean(hovered_country)

  let { countryStats: country_stats, isCalculatingStats: is_calculating_stats } = useCountryStatsAsync({
    activeCountries: active_countries,
    activeRaster: active_raster,
    isHoverOnly: is_hover_only,
  })

  let { rasterBounds: raster_bounds, renderedCanvas: rendered_canvas } = useMemo(() => {
    let r = display_raster || active_raster
    if (!r) {
      return {
        rasterBounds: (projection === 'Mercator'
          ? [-180, -85.051129, 180, 85.051129]
          : projection === 'Globe'
          ? [-180, -89.9, 180, 89.9]
          : [-180, -90, 180, 90]) as [number, number, number, number],
        renderedCanvas: null,
      }
    }

    let is_country_isolated = Boolean(
      countries_mode &&
        active_countries.length > 0 &&
        country_stats &&
        country_stats.validCount > 0 &&
        Number.isFinite(country_stats.min) &&
        Number.isFinite(country_stats.max)
    )

    let effective_max = is_country_isolated ? country_stats!.max : max_val
    let effective_min = is_country_isolated ? country_stats!.min : min_val

    let { canvas } = renderRasterToCanvas(
      r.data,
      r.width,
      r.height,
      {
        activeCountries: is_country_isolated ? active_countries : null,
        breaks,
        invertPalette: invert_palette,
        logSigma: log_sigma,
        maxVal: effective_max,
        minVal: effective_min,
        palette: color_palette,
        projection,
        scaleType: scale_type,
      }
    )

    let pixel_height = 180/r.height
    let pixel_offset = getPixelOffset(projection)
    let offset = pixel_offset*pixel_height
    let final_bounds: [number, number, number, number] = [-180, -90 + offset, 180, 90 + offset]

    return { rasterBounds: final_bounds, renderedCanvas: canvas }
  }, [
    display_raster,
    active_raster,
    color_palette,
    invert_palette,
    scale_type,
    log_sigma,
    min_val,
    max_val,
    breaks,
    projection,
    countries_mode,
    active_countries,
    country_stats,
  ])

  //Return statement
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Live Timelapse Recording HUD */}
      {is_timelapse_exporting && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3.5 px-5 py-2.5 rounded-full bg-card/95 backdrop-blur-md border border-red-500/50 shadow-2xl text-foreground select-none">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-red-400">Recording Timelapse</span>
              <span className="text-xs font-mono text-muted-foreground">({timelapse_export_pct}%)</span>
              <span className="text-xs font-mono font-bold text-foreground">• {UfDate.formatYear(timeline_year)}</span>
            </div>
            <span className="text-[11px] text-muted-foreground truncate max-w-sm">{timelapse_export_status}</span>
          </div>
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
            <div className="h-full bg-primary transition-all duration-150" style={{ width: `${timelapse_export_pct}%` }} />
          </div>
          <button
            type="button"
            onClick={handle_stop_timelapse_export}
            className="ml-1 px-3 py-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold text-xs flex items-center gap-1.5 rounded-full shadow-xs cursor-pointer transition-colors"
            title="Stop timelapse recording early and save recorded frames to server"
          >
            <Icon name="stop" className="text-sm" />
            <span>Stop</span>
          </button>
        </div>
      )}

      {/* Export Result Toast Banner */}
      {timelapse_export_result && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg bg-card/95 backdrop-blur-md border border-emerald-500/40 shadow-2xl text-foreground max-w-md">
          <Icon name="check_circle" className="text-emerald-400 text-xl flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-emerald-400">Timelapse Saved to Server!</div>
            <div className="text-[11px] text-muted-foreground truncate" title={timelapse_export_result.path}>
              File: <span className="font-mono text-foreground">{timelapse_export_result.filename}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Size: {(timelapse_export_result.sizeBytes / (1024*1024)).toFixed(2)} MB • Saved in exports/
            </div>
          </div>
          <button
            type="button"
            onClick={() => set_timelapse_export_result(null)}
            className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <Icon name="close" className="text-sm" />
          </button>
        </div>
      )}

      {/* Main Map Viewer */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <MapViewer
          raster={display_raster || active_raster}
          renderedCanvas={rendered_canvas}
          rasterBounds={raster_bounds}
          projection={projection}
          setProjection={set_projection}
          opacity={opacity}
          palette={color_palette}
          invertPalette={invert_palette}
          minVal={min_val}
          maxVal={max_val}
          legendTitle={legend_title}
          legendSubtitle={legend_subtitle}
          scaleType={scale_type}
          logSigma={log_sigma}
          breaks={breaks}
          onUpdateBreaks={handle_update_breaks}
          mapModes={map_modes}
          onToggleMapMode={handle_toggle_map_mode}
          onReorderMapModes={handle_reorder_map_modes}
          heightmapConfig={heightmap_config}
          setHeightmapConfig={set_heightmap_config}
          circleOverlayConfig={circle_overlay_config}
          setCircleOverlayConfig={set_circle_overlay_config}
          analyticsOpen={analytics_open}
          onToggleAnalytics={() => set_analytics_open((arg0_prev) => !arg0_prev)}
          selectedCountry={selected_countries[0] || null}
          selectedCountries={selected_countries}
          deferredSelectedCountries={deferred_selected_countries}
          isCalculatingStats={is_calculating_stats}
          onSelectCountry={handle_select_country}
          onToggleCountry={handle_toggle_country}
          onClearCountries={handle_clear_countries}
          countriesMode={countries_mode}
          onToggleCountriesMode={handle_toggle_countries_mode}
          hoveredCountry={hovered_country}
          onHoverCountry={set_hovered_country}
          countryStats={country_stats}
          settingsDrawerOpen={settings_drawer_open}
          onToggleSettingsDrawer={set_settings_drawer_open}
          sidebarWidth={sidebar_width}
          colourbarWidth={colourbar_width}
          onResizeColourbarWidth={set_colourbar_width}
          infoPanelOpen={info_panel_open}
          onToggleInfoPanel={() => set_info_panel_open((arg0_prev) => !arg0_prev)}
          onCloseInfoPanel={() => set_info_panel_open(false)}
          activeLayerId={active_layer_id}
          activeVariableSelectors={active_variable_selectors}
          dataLayers={layers}
          isLoadingLayers={is_loading_layers || is_loading_raster}
          onChangeVariableSelector={handle_change_variable_selector}
          onInspect={set_inspect_data}
          onSelectLayer={handle_select_layer}
          onToggleUi={() => set_ui_visible((arg0_prev) => !arg0_prev)}
          uiVisible={ui_visible && !is_timelapse_exporting}
          isTimelapseExporting={is_timelapse_exporting}
          userRole={user_role}
        />

        {/* ECharts Analytical View Panel (Top Right) */}
        <AnalyticsDrawer
          isOpen={ui_visible && analytics_open && !is_timelapse_exporting}
          onToggleOpen={() => set_analytics_open(false)}
          raster={display_raster || active_raster}
          scaleType={scale_type}
          logSigma={log_sigma}
          minOverride={min_val_override !== '' ? parseFloat(min_val_override) : undefined}
          maxOverride={max_val_override !== '' ? parseFloat(max_val_override) : undefined}
          selectedCountry={selected_countries[0] || null}
          selectedCountries={selected_countries}
          onSelectCountry={handle_select_country}
          onClearCountries={handle_clear_countries}
          countryStats={country_stats}
          isCalculatingStats={is_calculating_stats}
          isSettingsDrawerOpen={settings_drawer_open}
          rasterKey={raster_version}
          onForceRefresh={handle_force_refresh_analytics}
          activeLayer={active_layer}
          activeVariableSelectors={active_variable_selectors}
          currentYear={timeline_year}
          inspectData={inspect_data}
        />
      </div>

      {/* Historical Timeline Scrubber Bar */}
      {(ui_visible || is_timelapse_exporting) && (
        <TimelineBar
          availableKeyframes={available_keyframes}
          currentYear={timeline_year}
          isLoading={is_loading_raster}
          isPlaying={is_playing}
          maxYear={available_keyframes.length > 0 ? available_keyframes[available_keyframes.length - 1] : 2025}
          minYear={available_keyframes.length > 0 ? available_keyframes[0] : -10000}
          onChangePlaybackSpeed={set_playback_speed}
          onChangeYear={set_timeline_year}
          onTogglePlay={() => set_is_playing((arg0_prev) => !arg0_prev)}
          onToggleSnapToKeyframes={set_snap_to_keyframes}
          playbackSpeed={playback_speed}
          snapToKeyframes={snap_to_keyframes}
          style={
            (!ui_visible || is_timelapse_exporting)
              ? { left: '50%', transform: 'translateX(-50%)', width: 'min(1100px, calc(100vw - 64px))' }
              : { left: `calc(${sidebar_width + 16}px + (100vw - ${sidebar_width + 360}px) / 2)`, width: 'min(1100px, calc(100vw - 450px))' }
          }
        />
      )}

      {/* Floating Sidebar Controls Dock */}
      {ui_visible && !is_timelapse_exporting && (
        <SidebarControls
          activeFileName={active_file_name}
          activeLayerId={active_layer_id}
          activeVariableSelectors={active_variable_selectors}
          appMode={app_mode}
          binningConfig={binning_config}
          boundsMode={bounds_mode}
          circleOverlayConfig={circle_overlay_config}
          colorPalette={color_palette}
          dataFormat={data_format}
          diffNameA={diff_name_a}
          diffNameB={diff_name_b}
          heightmapConfig={heightmap_config}
          infoPanelOpen={info_panel_open}
          invertPalette={invert_palette}
          isLoadingLayers={is_loading_layers || is_loading_raster}
          layers={layers}
          legendSubtitle={legend_subtitle}
          legendTitle={legend_title}
          logSigma={log_sigma}
          mapModes={map_modes}
          maxValOverride={max_val_override}
          minValOverride={min_val_override}
          onChangeUserRole={set_user_role}
          onChangeVariableSelector={handle_change_variable_selector}
          onFileUpload={handle_file_upload}
          onOpenVideoExport={() => set_video_export_open(true)}
          onSelectLayer={handle_select_layer}
          onToggleInfoPanel={() => set_info_panel_open((arg0_prev) => !arg0_prev)}
          onToggleMapMode={handle_toggle_map_mode}
          onWidthChange={set_sidebar_width}
          opacity={opacity}
          percentileList={percentile_list}
          absoluteBreaks={absolute_breaks}
          scaleType={scale_type}
          selectedCountries={deferred_selected_countries}
          setAbsoluteBreaks={set_absolute_breaks}
          setAppMode={set_app_mode}
          setBinningConfig={set_binning_config}
          setBoundsMode={set_bounds_mode}
          setColorPalette={set_color_palette}
          setDataFormat={set_data_format}
          setInvertPalette={set_invert_palette}
          setLegendSubtitle={set_legend_subtitle}
          setLegendTitle={set_legend_title}
          setLogSigma={set_log_sigma}
          setMaxValOverride={set_max_val_override}
          setMinValOverride={set_min_val_override}
          setOpacity={set_opacity}
          setPercentileList={set_percentile_list}
          setScaleType={set_scale_type}
          userRole={user_role}
          width={sidebar_width}
        />
      )}

      {/* Developer Video Export Modal */}
      <VideoExportModal
        activeLayerId={active_layer_id}
        availableKeyframes={available_keyframes}
        availableLayers={layers}
        isOpen={video_export_open}
        maxYear={available_keyframes.length > 0 ? available_keyframes[available_keyframes.length - 1] : 2025}
        minYear={available_keyframes.length > 0 ? available_keyframes[0] : -10000}
        onClose={() => set_video_export_open(false)}
        onStartTimelapseExport={handle_start_timelapse_export}
      />
    </div>
  )
}

export default App
