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
} from './lib/geopng/types'
import {
  decodeRawGeoPngBufferAsync,
  computeRasterDifference,
} from './lib/geopng/decoder'
import { renderRasterToCanvas } from './lib/geopng/palettes'
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

/**
 * Main application root component managing raster datasets, map layers, and reactive view state.
 *
 * @returns {React.ReactElement}
 */
export const App: React.FC = function () {
  //Declare local instance variables
  let absolute_breaks: string
  let active_countries: CountryFeature[]
  let active_file_name: string
  let active_raster: DecodedRaster | null
  let analytics_open: boolean
  let app_mode: AppMode
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
  let handle_clear_countries: () => void
  let handle_file_upload: (arg0_file: File, arg1_target: 'single' | 'diff_a' | 'diff_b') => Promise<void>
  let handle_force_refresh_analytics: () => void
  let handle_reorder_map_modes: (arg0_new_modes: MapModeItem[]) => void
  let handle_select_country: (arg0_c: CountryFeature | null) => void
  let handle_toggle_countries_mode: (arg0_enabled: boolean) => void
  let handle_toggle_country: (arg0_c: CountryFeature) => void
  let handle_toggle_map_mode: (arg0_id: MapModeId) => void
  let handle_update_breaks: (arg0_new_breaks: number[]) => void
  let heightmap_config: HeightmapConfig
  let hovered_country: CountryFeature | null
  let info_panel_open: boolean
  let invert_palette: boolean
  let is_hover_only: boolean
  let legend_subtitle: string
  let legend_title: string
  let log_sigma: number
  let map_modes: MapModeItem[]
  let max_val_override: string
  let min_val_override: string
  let opacity: number
  let percentile_list: string
  let projection: ProjectionType
  let raster_a: DecodedRaster | null
  let raster_b: DecodedRaster | null
  let raster_version: number
  let raw_bytes_a: Uint8Array | null
  let raw_bytes_b: Uint8Array | null
  let scale_type: ScaleType
  let selected_countries: CountryFeature[]
  let set_absolute_breaks: React.Dispatch<React.SetStateAction<string>>
  let set_active_file_name: React.Dispatch<React.SetStateAction<string>>
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
  let set_invert_palette: React.Dispatch<React.SetStateAction<boolean>>
  let set_legend_subtitle: React.Dispatch<React.SetStateAction<string>>
  let set_legend_title: React.Dispatch<React.SetStateAction<string>>
  let set_log_sigma: React.Dispatch<React.SetStateAction<number>>
  let set_map_modes: React.Dispatch<React.SetStateAction<MapModeItem[]>>
  let set_max_val_override: React.Dispatch<React.SetStateAction<string>>
  let set_min_val_override: React.Dispatch<React.SetStateAction<string>>
  let set_opacity: React.Dispatch<React.SetStateAction<number>>
  let set_percentile_list: React.Dispatch<React.SetStateAction<string>>
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
  let settings_drawer_open: boolean
  let sidebar_width: number

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

  deferred_selected_countries = useDeferredValue(selected_countries)

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
        />

        {/* ECharts Analytical View Panel (Top Right) */}
        <AnalyticsDrawer
          isOpen={analytics_open}
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
        />
      </div>

      {/* Floating Sidebar Controls Dock */}
      <SidebarControls
        appMode={app_mode}
        dataFormat={data_format}
        setDataFormat={set_data_format}
        scaleType={scale_type}
        setScaleType={set_scale_type}
        logSigma={log_sigma}
        setLogSigma={set_log_sigma}
        colorPalette={color_palette}
        setColorPalette={set_color_palette}
        invertPalette={invert_palette}
        setInvertPalette={set_invert_palette}
        boundsMode={bounds_mode}
        setBoundsMode={set_bounds_mode}
        minValOverride={min_val_override}
        setMinValOverride={set_min_val_override}
        maxValOverride={max_val_override}
        setMaxValOverride={set_max_val_override}
        percentileList={percentile_list}
        setPercentileList={set_percentile_list}
        absoluteBreaks={absolute_breaks}
        setAbsoluteBreaks={set_absolute_breaks}
        legendTitle={legend_title}
        setLegendTitle={set_legend_title}
        legendSubtitle={legend_subtitle}
        setLegendSubtitle={set_legend_subtitle}
        opacity={opacity}
        setOpacity={set_opacity}
        onFileUpload={handle_file_upload}
        activeFileName={active_file_name}
        diffNameA={diff_name_a}
        diffNameB={diff_name_b}
        setAppMode={set_app_mode}
        binningConfig={binning_config}
        setBinningConfig={set_binning_config}
        mapModes={map_modes}
        heightmapConfig={heightmap_config}
        circleOverlayConfig={circle_overlay_config}
        selectedCountries={deferred_selected_countries}
        onToggleMapMode={handle_toggle_map_mode}
        width={sidebar_width}
        onWidthChange={set_sidebar_width}
        infoPanelOpen={info_panel_open}
        onToggleInfoPanel={() => set_info_panel_open((arg0_prev) => !arg0_prev)}
      />
    </div>
  )
}

export default App
