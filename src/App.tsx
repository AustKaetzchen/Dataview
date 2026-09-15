import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react'
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
  CityPoint,
  CityFullRecord,
  StadesterConfig,
} from './lib/geopng/types'
import { decodeRawGeoPngBufferAsync, computeRasterDifference } from './lib/geopng/decoder'
import { computeQuantiles } from './lib/geopng/scales'
import { createBinnedRaster } from './lib/geopng/downsampling'
import { CountryFeature } from './lib/geopng/polygonBinning'
import { useCountryStatsAsync } from './lib/geopng/useCountryStatsAsync'
import { MAP_CONFIG, MAPMODES_CONFIG } from '@config'
import { SidebarControls } from './components/controls/SidebarControls'
import { MapViewer } from './components/map/MapViewer'
import { AnalyticsDrawer } from './components/analytics/AnalyticsDrawer'
import { TimelineBar } from './components/timeline/TimelineBar'
import { VideoExportModal, type StartTimelapseExportOptions } from './components/export/VideoExportModal'
import { ParsedDataLayer } from './server/layerParser'
import { UserRole } from './components/controls/DataLayersTab'
import { Icon } from './components/ui/icon'
import { useStadesterCities, fetchStadesterCitiesAsync } from './components/map/useStadesterCities'
import { useRasterPipeline, fetchRasterKeyframe, fetchInterpolatedRasterAsync } from './lib/raster/useRasterPipeline'
import { useRasterRenderer } from './lib/raster/useRasterRenderer'
import { useTimelapseExportOrchestrator } from './components/export/useTimelapseExportOrchestrator'
import { applyLayerLegend } from './lib/raster/legendUtils'

/**
 * Main application root component managing raster datasets, map layers, and reactive view state.
 *
 * @returns {React.ReactElement}
 */
export const App: React.FC = function () {
  //Function body
  let [ui_visible, set_ui_visible] = useState<boolean>(true)
  let [app_mode, set_app_mode] = useState<AppMode>('Single Image')
  let [data_format, set_data_format] = useState<DataFormat>('float32')
  let [projection, set_projection] = useState<ProjectionType>('Mercator')
  let [scale_type, set_scale_type] = useState<ScaleType>('pseudo-log')
  let [log_sigma, set_log_sigma] = useState<number>(1.0)
  let [color_palette, set_color_palette] = useState<ColorPalette>('Plasma')
  let [invert_palette, set_invert_palette] = useState<boolean>(false)
  let [bounds_mode, set_bounds_mode] = useState<BoundsMode>('Manual')
  let [min_val_override, set_min_val_override] = useState<string>('')
  let [max_val_override, set_max_val_override] = useState<string>('')
  let [percentile_list, set_percentile_list] = useState<string>(
    MAP_CONFIG.defaultPercentileBreaks || '0, 1, 5, 25, 50, 75, 95, 99, 100'
  )
  let [absolute_breaks, set_absolute_breaks] = useState<string>('0, 10, 50, 100, 500, 1000')
  let [legend_title, set_legend_title] = useState<string>('Value')
  let [legend_subtitle, set_legend_subtitle] = useState<string>('')
  let [opacity, set_opacity] = useState<number>(0.85)
  let [performant_mode, set_performant_mode] = useState<boolean>(false)

  let [binning_config, set_binning_config] = useState<BinningConfig>({
    enabled: false,
    height: 360,
    method: 'average',
    width: 720,
  })
  let [heightmap_config, set_heightmap_config] = useState<HeightmapConfig>({
    blendWeight: 0.5,
    elevationScale: 800000,
    enabled: false,
    heightScaleMode: 'linear',
    opacity: 0.9,
    opacityByPercentile: false,
    opacityByPercentileStrength: 1.0,
    resolutionArcmin: 60,
  })
  let [sidebar_width, set_sidebar_width] = useState<number>(336)
  let [sidebar_bottom_clearance, set_sidebar_bottom_clearance] = useState<number | undefined>(undefined)

  useEffect(() => {
    let updateSidebarClearance = () => {
      let clearance: number
      let is_vertical = window.innerHeight > window.innerWidth
      let next_val: number | undefined
      let overlaps: boolean
      let timeline_el = document.getElementById('dataview-timelinebar-container')
      if (timeline_el) {
        let rect = timeline_el.getBoundingClientRect()
        let from_bottom = window.innerHeight - rect.top
        clearance = Math.max(from_bottom, 0) + 12
        overlaps = is_vertical || (rect.left < (sidebar_width + 24))
        next_val = overlaps ? clearance : undefined
        set_sidebar_bottom_clearance((arg0_prev) => (arg0_prev === next_val ? arg0_prev : next_val))
      } else {
        set_sidebar_bottom_clearance((arg0_prev) => (arg0_prev === undefined ? undefined : undefined))
      }
    }

    updateSidebarClearance()
    window.addEventListener('resize', updateSidebarClearance)
    let ro = new ResizeObserver(updateSidebarClearance)
    let timeline_el = document.getElementById('dataview-timelinebar-container')
    if (timeline_el)
      ro.observe(timeline_el)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateSidebarClearance)
    }
  }, [sidebar_width, ui_visible])

  let [colourbar_width, set_colourbar_width] = useState<number>(336)
  let [info_panel_open, set_info_panel_open] = useState<boolean>(false)
  let [circle_overlay_config, set_circle_overlay_config] = useState<CircleOverlayConfig>({
    baseRadius: 1.0,
    enabled: false,
    haloWidth: 1,
    percentileCutoff: 99,
    strokeWidth: 2,
  })
  let [stadester_config, set_stadester_config] = useState<StadesterConfig>({
    bubbleSize: 0.4,
    colorMode: 'growth',
    dataset: 'stadester_1.1',
    enabled: false,
    filled: true,
    growthPalette: 'Rainbow',
    halo: false,
    labelCollision: true,
    maxCities: 4000,
    minPop: 0,
    opacity: 0.7,
    showLabels: true,
  })
  let [selected_city_key, set_selected_city_key] = useState<string | null>(null)

  let [map_modes, set_map_modes] = useState<MapModeItem[]>(() =>
    MAPMODES_CONFIG.modes.map((arg0_m) => ({
      active: arg0_m.active ?? false,
      id: arg0_m.id,
      label: arg0_m.label,
    }))
  )

  let [analytics_open, set_analytics_open] = useState<boolean>(false)
  let [settings_drawer_open, set_settings_drawer_open] = useState<boolean>(false)
  let [selected_countries, set_selected_countries] = useState<CountryFeature[]>([])
  let [hovered_country, set_hovered_country] = useState<CountryFeature | null>(null)
  let [countries_mode, set_countries_mode] = useState<boolean>(false)
  let [inspect_data, set_inspect_data] = useState<any>(null)

  let [layers, set_layers] = useState<Record<string, ParsedDataLayer>>({})
  let [active_layer_id, set_active_layer_id] = useState<string | null>('basemap_only')
  let [active_variable_selectors, set_active_variable_selectors] = useState<Record<string, string | string[]>>({
    gender: ['t'],
    profession: ['agriculture'],
  })
  let [is_loading_layers, set_is_loading_layers] = useState<boolean>(false)
  let [user_role, set_user_role] = useState<UserRole>('developer')
  let [timeline_year, set_timeline_year] = useState<number>(1950)
  let [is_playing, set_is_playing] = useState<boolean>(false)
  let [playback_speed, set_playback_speed] = useState<number>(1)
  let [snap_to_keyframes, set_snap_to_keyframes] = useState<boolean>(false)
  let [video_export_open, set_video_export_open] = useState<boolean>(false)

  let search_params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  let is_headless_export = search_params?.get('export_mode') === '1'

  let [legend_position, set_legend_position] = useState<'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'>(() => {
    let url_leg = search_params?.get('legend_position')
    if (url_leg) {
      let normalized = url_leg.replace('centre', 'center') as any
      if (['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].includes(normalized))
        return normalized
    }
    return 'top-left'
  })

  useEffect(() => {
    let url_proj = search_params?.get('projection') as ProjectionType | null
    if (url_proj && ['EqualEarth', 'Mercator', 'Globe', 'Equirectangular'].includes(url_proj))
      set_projection(url_proj)
    let url_leg = search_params?.get('legend_position')
    if (url_leg) {
      let normalized = url_leg.replace('centre', 'center') as any
      if (['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].includes(normalized))
        set_legend_position(normalized)
    }
  }, [])

  let active_layer = useMemo<ParsedDataLayer | null>(() => {
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

  let available_keyframes = useMemo<number[]>(() => {
    if (!active_layer || !active_layer.available_years)
      return []
    return active_layer.available_years
  }, [active_layer])

  //Raster pipeline hook: handles background loading, keyframes, caching, and downsampling
  let {
    activeFileName: active_file_name,
    clearCache: clear_raster_cache,
    diffNameA: diff_name_a,
    diffNameB: diff_name_b,
    displayRaster: pipeline_display_raster,
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
  } = useRasterPipeline({
    activeLayer: active_layer,
    activeLayerId: active_layer_id,
    activeVariableSelectors: active_variable_selectors,
    appMode: app_mode,
    dataFormat: data_format,
    isHeadlessExport: is_headless_export,
    isPlaying: is_playing,
    performantMode: performant_mode,
    snapToKeyframes: snap_to_keyframes,
    timelineYear: timeline_year,
  })

  useEffect(() => {
    clear_raster_cache()
  }, [performant_mode, clear_raster_cache])

  //Server-side timelapse export orchestrator hook
  let {
    cancelTimelapseExport: handle_stop_timelapse_export,
    isTimelapseExporting: is_timelapse_exporting,
    startTimelapseExport: handle_start_timelapse_export,
    timelapseExportPct: timelapse_export_pct,
    timelapseExportResult: timelapse_export_result,
    timelapseExportStatus: timelapse_export_status,
  } = useTimelapseExportOrchestrator({
    activeLayer: active_layer,
    activeLayerId: active_layer_id,
    activeVariableSelectors: active_variable_selectors,
    layers: layers,
    legendPosition: legend_position,
    projection: projection,
    setIsPlaying: set_is_playing,
    setVideoExportOpen: set_video_export_open,
  })

  let stadester_result = useStadesterCities({
    config: stadester_config,
    selectedCityKey: selected_city_key,
    year: Math.round(timeline_year),
  })
  let stadester_cities: CityPoint[] = stadester_result.cities
  let selected_city_record: CityFullRecord | null = stadester_result.selectedCity

  useEffect(() => {
    ; (window as any).setStadesterConfig = set_stadester_config
      ; (window as any).stadesterConfig = stadester_config
      ; (window as any).setActiveLayerId = set_active_layer_id
      ; (window as any).setSelectedCityKey = set_selected_city_key
      ; (window as any).selectedCityRecord = selected_city_record
      ; (window as any).selectedCityKey = selected_city_key
  }, [set_stadester_config, stadester_config, set_active_layer_id, set_selected_city_key, selected_city_record, selected_city_key])

  let handle_close_city_details = useCallback(() => {
    set_selected_city_key(null)
  }, [])

  let handle_select_city = useCallback((arg0_city: CityPoint | null) => {
    let city = arg0_city
    if (!city) {
      set_selected_city_key(null)
    } else {
      set_selected_city_key(city.key)
    }
  }, [])

  let handle_app_inspect = useCallback(
    (arg0_data: any) => {
      let insp_data = arg0_data
      if (!analytics_open)
        return
      set_inspect_data(insp_data)
    },
    [analytics_open]
  )

  //Headless export hook for server render keyframes
  useEffect(() => {
    ; (window as any).__renderKeyframe = async (
      arg0_layer_id: string,
      arg0_year: number,
      arg0_selectors?: Record<string, string | string[]>
    ) => {
      let layer_id = arg0_layer_id
      let yr = arg0_year
      let selectors = arg0_selectors || {}

      if (typeof window !== 'undefined')
        (window as any).__deckRendered = false

      set_active_layer_id(layer_id)
      set_timeline_year(yr)
      set_active_variable_selectors(selectors)

      let target_layer: ParsedDataLayer | null = layers[layer_id] || (active_layer?.id === layer_id ? active_layer : null)
      if (!target_layer && layer_id.includes('.')) {
        let parent_id = layer_id.split('.')[0]
        let parent = layers[parent_id]
        if (parent && parent.sub_layers)
          target_layer = parent.sub_layers.find((arg0_s) => arg0_s.id === layer_id) || null
      }

      if (target_layer) {
        applyLayerLegend(
          target_layer,
          selectors,
          set_color_palette,
          set_invert_palette,
          set_scale_type,
          set_legend_title,
          set_legend_subtitle,
          set_log_sigma
        )
      }

      let has_selectors = Boolean(target_layer?.variable_selectors && Object.keys(target_layer.variable_selectors).length > 0)
      let layer_pixel_offset = target_layer?.pixel_offset

      if (is_headless_export && raster_cache_ref.current.size > 1)
        raster_cache_ref.current.clear()

      let available_years = target_layer?.available_years || (target_layer as any)?.years || []
      let decoded: DecodedRaster | null = null

      if (available_years.length > 0) {
        decoded = await fetchInterpolatedRasterAsync(
          layer_id,
          yr,
          available_years,
          selectors,
          data_format,
          raster_cache_ref.current,
          has_selectors,
          layer_pixel_offset,
          performant_mode,
          snap_to_keyframes
        )
      } else {
        decoded = await fetchRasterKeyframe(
          layer_id,
          yr,
          selectors,
          data_format,
          raster_cache_ref.current,
          has_selectors,
          layer_pixel_offset,
          performant_mode
        )
      }

      if (decoded) {
        set_raster_a(decoded)
        set_raster_b(null)
        set_raster_version((arg0_v) => arg0_v + 1)
      }

      if (stadester_config.enabled) {
        await fetchStadesterCitiesAsync(
          stadester_config.dataset,
          yr,
          stadester_config.minPop,
          stadester_config.maxCities,
          stadester_config.colorMode
        ).catch(() => {})
      }

      await new Promise((arg0_res) => {
        let check_count = 0
        let check_timer = setInterval(() => {
          check_count++
          if ((window as any).__deckRendered || check_count >= 15) {
            clearInterval(check_timer)
            requestAnimationFrame(() => requestAnimationFrame(arg0_res))
          }
        }, 16)
      })
      await new Promise((arg0_res) => setTimeout(arg0_res, 40))
      return true
    }
  }, [active_layer, data_format, is_headless_export, layers, performant_mode, raster_cache_ref, set_raster_a, set_raster_version, stadester_config])

  let deferred_selected_countries = useDeferredValue(selected_countries)

  let handle_change_variable_selector = useCallback((arg0_key: string, arg1_option: string | string[]) => {
    let key = arg0_key
    let option = arg1_option
    set_active_variable_selectors((arg0_prev) => ({
      ...arg0_prev,
      [key]: option,
    }))
  }, [])

  let handle_select_layer = useCallback((arg0_layer_id: string) => {
    let layer_id = arg0_layer_id
    if (layer_id === 'lfpr')
      layer_id = 'lfpr.lfpr_female'
    set_active_layer_id(layer_id)
    let target = layers[layer_id]
    if (target?.encoding)
      set_data_format(target.encoding)
    if (target?.type === 'vector.basemap' || layer_id === 'basemap_only')
      set_raster_a(null)
    set_max_val_override('')
    set_min_val_override('')
  }, [layers, set_raster_a])

  useEffect(() => {
    if (active_layer) {
      applyLayerLegend(
        active_layer,
        active_variable_selectors,
        set_color_palette,
        set_invert_palette,
        set_scale_type,
        set_legend_title,
        set_legend_subtitle,
        set_log_sigma
      )
      if (active_layer.encoding)
        set_data_format(active_layer.encoding)
    }
  }, [active_layer, active_variable_selectors])

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
              ; (window as any).__layersLoaded = true
            let layer_keys = Object.keys(data.layers)
            let stadester_layer = data.layers.stadester || data.layers['stadester_1.1'] || data.layers['stadester_1.0']
            if (stadester_layer && stadester_layer.display_options) {
              let opts = stadester_layer.display_options
              set_stadester_config((arg0_prev) => ({
                ...arg0_prev,
                bubbleSize: opts.bubble_size ?? arg0_prev.bubbleSize,
                colorMode: opts.color_mode ?? arg0_prev.colorMode,
                dataset: opts.dataset ?? arg0_prev.dataset,
                display_options: opts,
                filled: opts.filled ?? arg0_prev.filled,
                growthPalette: opts.growth_palette ?? arg0_prev.growthPalette,
                halo: opts.halo ?? arg0_prev.halo,
                labelCollision: opts.label_collision ?? arg0_prev.labelCollision,
                maxCities: opts.max_cities ?? arg0_prev.maxCities,
                minPop: opts.min_pop ?? arg0_prev.minPop,
                opacity: opts.opacity ?? arg0_prev.opacity,
                showLabels: opts.show_labels ?? arg0_prev.showLabels,
              }))
            }
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
  }, [data_format, raw_bytes_a, raw_bytes_b, set_raster_a, set_raster_b, set_raster_version])

  let handle_file_upload = useCallback(
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
        } else if (target === 'diff_a') {
          set_raw_bytes_a(uint8)
          set_raster_a(decoded)
        } else if (target === 'diff_b') {
          set_raw_bytes_b(uint8)
          set_raster_b(decoded)
        }
        set_raster_version((arg0_v) => arg0_v + 1)
      } catch (arg0_err) {
        console.error('Failed to load GeoPNG file:', arg0_err)
      }
    },
    [data_format, set_raster_a, set_raster_b, set_raster_version, set_raw_bytes_a, set_raw_bytes_b]
  )

  let handle_force_refresh_analytics = useCallback(() => {
    set_raster_version((arg0_v) => arg0_v + 1)
  }, [set_raster_version])

  let active_raster = useMemo<DecodedRaster | null>(() => {
    if (app_mode === 'Single Image')
      return raster_a
    if (raster_a && raster_b)
      return computeRasterDifference(raster_a, raster_b)
    return raster_a
  }, [app_mode, raster_a, raster_b])

  let display_raster = useMemo<DecodedRaster | null>(() => {
    let base = pipeline_display_raster || active_raster
    if (!base)
      return null
    if (!binning_config.enabled)
      return base
    try {
      return createBinnedRaster(
        base,
        binning_config.width,
        binning_config.height,
        binning_config.method
      )
    } catch (arg0_e) {
      console.error('Failed to bin raster:', arg0_e)
      return base
    }
  }, [active_raster, binning_config, pipeline_display_raster])

  let { breaks, maxVal: max_val, minVal: min_val } = useMemo(() => {
    let r = display_raster || active_raster
    if (!r)
      return { breaks: [], maxVal: 1, minVal: 0 }

    if (bounds_mode === 'Percentile') {
      let parts = percentile_list
        .split(',')
        .map((arg0_s) => parseFloat(arg0_s.trim()))
        .filter((arg0_n) => !Number.isNaN(arg0_n))
        .map((arg0_p) => arg0_p / 100)

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

  let handle_toggle_country = useCallback((arg0_c: CountryFeature) => {
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

  let handle_clear_countries = useCallback(() => {
    set_selected_countries([])
  }, [])

  let handle_select_country = useCallback(
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

  let handle_toggle_countries_mode = useCallback((arg0_enabled: boolean) => {
    let enabled = arg0_enabled
    set_countries_mode(enabled)
    set_map_modes((arg0_prev) =>
      arg0_prev.map((arg0_m) => (arg0_m.id === 'country_analysis' ? { ...arg0_m, active: enabled } : arg0_m))
    )
  }, [])

  let handle_toggle_map_mode = useCallback((arg0_id: MapModeId) => {
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

  let handle_reorder_map_modes = useCallback((arg0_new_modes: MapModeItem[]) => {
    let new_modes = arg0_new_modes
    set_map_modes(new_modes)
  }, [set_map_modes])

  let handle_update_breaks = useCallback((arg0_new_breaks: number[]) => {
    let new_breaks = arg0_new_breaks
    set_bounds_mode('Absolute')
    set_absolute_breaks(new_breaks.map((arg0_n) => (Math.round(arg0_n * 1000) / 1000).toString()).join(', '))
  }, [set_absolute_breaks, set_bounds_mode])

  let active_countries = useMemo<CountryFeature[]>(() => {
    if (selected_countries.length > 0)
      return selected_countries
    if (countries_mode && hovered_country)
      return [hovered_country]
    return []
  }, [countries_mode, selected_countries, hovered_country])

  let is_hover_only = selected_countries.length === 0 && Boolean(hovered_country)

  let { countryStats: country_stats, isCalculatingStats: is_calculating_stats } = useCountryStatsAsync({
    activeCountries: active_countries,
    activeRaster: active_raster,
    isHoverOnly: is_hover_only,
  })

  //Raster GPU-backed Canvas renderer hook with explicit texture release
  let { rasterBounds: raster_bounds, renderedCanvas: rendered_canvas } = useRasterRenderer({
    activeCountries: active_countries,
    activeRaster: display_raster || active_raster,
    breaks: breaks,
    colorPalette: color_palette,
    countriesMode: countries_mode,
    countryStats: country_stats,
    invertPalette: invert_palette,
    logSigma: log_sigma,
    maxVal: max_val,
    minVal: min_val,
    projection: projection,
    scaleType: scale_type,
  })

  //Return statement
  return (
    <div id="dataview-app-root" className="relative h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Live Timelapse Recording HUD */}
      {!is_headless_export && is_timelapse_exporting && (
        <div id="timelapse-recording-hud" className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3.5 px-5 py-2.5 rounded-full bg-card/95 backdrop-blur-md border border-red-500/50 shadow-2xl text-foreground select-none">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-red-400">Rendering Timelapse on Server</span>
              <span className="text-xs font-mono text-muted-foreground">({timelapse_export_pct}%)</span>
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
            title="Cancel timelapse render job on server"
          >
            <Icon name="stop" className="text-sm" />
            <span>Cancel</span>
          </button>
        </div>
      )}

      {/* Export Result Toast Banner */}
      {!is_headless_export && timelapse_export_result && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg bg-card/95 backdrop-blur-md border border-emerald-500/40 shadow-2xl text-foreground max-w-md">
          <Icon name="check_circle" className="text-emerald-400 text-xl flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-emerald-400">Timelapse Saved to Server!</div>
            <div className="text-[11px] text-muted-foreground truncate" title={timelapse_export_result.path}>
              File: <span className="font-mono text-foreground">{timelapse_export_result.filename}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Size: {(timelapse_export_result.sizeBytes / (1024 * 1024)).toFixed(2)} MB • Saved in exports/
            </div>
          </div>
          <button
            type="button"
            onClick={() => { }}
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
          onInspect={handle_app_inspect}
          onSelectLayer={handle_select_layer}
          onToggleUi={() => set_ui_visible((arg0_prev) => !arg0_prev)}
          uiVisible={!is_headless_export && ui_visible && !is_timelapse_exporting}
          isTimelapseExporting={is_timelapse_exporting || is_headless_export}
          legendPosition={legend_position}
          onChangeLegendPosition={set_legend_position}
          onCloseCityDetails={handle_close_city_details}
          onSelectCity={handle_select_city}
          performantMode={performant_mode}
          onTogglePerformantMode={set_performant_mode}
          selectedCity={selected_city_record}
          selectedCityKey={selected_city_key}
          setStadesterConfig={set_stadester_config}
          stadesterCities={stadester_cities}
          stadesterConfig={stadester_config}
          timelineYear={Math.round(timeline_year)}
          userRole={user_role}
        />

        {/* ECharts Analytical View Panel (Top Right) */}
        <AnalyticsDrawer
          isOpen={!is_headless_export && ui_visible && analytics_open && !is_timelapse_exporting}
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
          citiesMode={stadester_config.enabled}
          currentYear={timeline_year}
          inspectData={inspect_data}
          onSelectCity={(arg0_key) => {
            set_selected_city_key(arg0_key)
          }}
          stadesterDataset={stadester_config.dataset}
        />
      </div>

      {/* Historical Timeline Scrubber Bar */}
      {(ui_visible || is_timelapse_exporting || is_headless_export) && (
        <TimelineBar
          availableKeyframes={available_keyframes}
          currentYear={timeline_year}
          isLoading={is_loading_raster || (stadester_config.enabled && stadester_result.isLoading)}
          isPlaying={is_playing}
          maxYear={available_keyframes.length > 0 ? available_keyframes[available_keyframes.length - 1] : 2025}
          minYear={available_keyframes.length > 0 ? available_keyframes[0] : -10000}
          onChangePlaybackSpeed={set_playback_speed}
          onChangeYear={set_timeline_year}
          onTogglePlay={() => set_is_playing((arg0_prev) => !arg0_prev)}
          onToggleSnapToKeyframes={set_snap_to_keyframes}
          playbackSpeed={playback_speed}
          snapToKeyframes={snap_to_keyframes}
          style={{
            left: 0,
            marginLeft: 'auto',
            marginRight: 'auto',
            right: 0,
            width: 'min(1100px, calc(100vw - 64px))',
          }}
        />
      )}

      {/* Floating Sidebar Controls Dock */}
      {!is_headless_export && ui_visible && !is_timelapse_exporting && (
        <SidebarControls
          activeFileName={active_file_name}
          activeLayerId={active_layer_id}
          activeVariableSelectors={active_variable_selectors}
          appMode={app_mode}
          binningConfig={binning_config}
          bottomClearance={sidebar_bottom_clearance}
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
        colorPalette={color_palette}
        currentProjection={projection}
        isOpen={video_export_open}
        legendSubtitle={legend_subtitle}
        legendTitle={legend_title}
        maxVal={max_val}
        maxYear={available_keyframes.length > 0 ? available_keyframes[available_keyframes.length - 1] : 2025}
        minVal={min_val}
        minYear={available_keyframes.length > 0 ? available_keyframes[0] : -10000}
        onClose={() => set_video_export_open(false)}
        onStartTimelapseExport={handle_start_timelapse_export}
        renderedCanvas={rendered_canvas}
        timelineYear={timeline_year}
      />
    </div>
  )
}

export default App
