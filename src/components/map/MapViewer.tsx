import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import DeckGL from '@deck.gl/react'
import { MapView, OrbitView } from '@deck.gl/core'
import {
  CountryFeature,
  CountryStats,
  loadCountriesGeoJson,
  findCountryAtLngLat,
  isPointInGeometry,
} from '@/lib/geopng/polygonBinning'
import { sampleRasterAt } from '@/lib/geopng/sampleRaster'
import {
  invertEqualEarth,
  projectEqualEarth,
  transformGeometryToEqualEarth,
  generateEqualEarthGraticule,
} from '@/lib/geopng/equalEarth'
import { isGlobePointVisible } from '@/lib/stadester/stadesterHeuristics'
import {
  DecodedRaster,
  InspectionData,
  ProjectionType,
  HeightmapConfig,
  CircleOverlayConfig,
  MapModeItem,
  MapModeId,
  CityPoint,
  CityFullRecord,
  HistoricalBordersConfig,
  StadesterConfig,
} from '@/lib/geopng/types'
import { MAP_CONFIG, getPixelOffset } from '@config'
import { UI_LAYOUT } from '@/lib/uiLayout'
import { ClickInfoPanel } from './ClickInfoPanel'
import { CityDetailsPanel } from './CityDetailsPanel'
import { MapmodesTray } from './MapmodesTray'
import { MapViewerHUD } from './MapViewerHUD'
import {
  SmoothMapController,
  SmoothOrbitController,
  SmoothGlobeController,
  SmoothGlobeView,
} from './SmoothControllers'
import { useElevationSpikes } from './useElevationSpikes'
import { ParsedDataLayer } from '@/server/layerParser'
import { UserRole } from '../controls/DataLayersTab'
import { useCircleOverlay } from './useCircleOverlay'
import { useDeckLayers } from './useDeckLayers'
import { useStadesterWorker } from '@/lib/stadester/useStadesterWorker'
import { useHistoricalBorders } from './useHistoricalBorders'
import { HistoricalBorderDetailsPanel } from './HistoricalBorderDetailsPanel'
import type { HistoricalBorderFeature } from '@/server/atlasBordersService'

let EMPTY_ARRAY: any[] = [], NOOP_FN = () => { }

export interface MapViewerProps {
  raster: DecodedRaster | null
  renderedCanvas: HTMLCanvasElement | null
  rasterBounds: [number, number, number, number]
  projection: ProjectionType
  setProjection: (p: ProjectionType) => void
  opacity: number
  palette: any
  invertPalette?: boolean
  minVal: number
  maxVal: number
  isTimelapseExporting?: boolean
  legendSubtitle?: string
  legendTitle: string
  scaleType: string
  logSigma: number
  breaks?: number[]
  onUpdateBreaks?: (breaks: number[]) => void
  mapModes: MapModeItem[]
  onToggleMapMode: (id: MapModeId) => void
  onReorderMapModes: (newModes: MapModeItem[]) => void
  heightmapConfig: HeightmapConfig
  setHeightmapConfig?: React.Dispatch<React.SetStateAction<HeightmapConfig>>
  historicalBordersConfig?: HistoricalBordersConfig
  historicalBordersEnabled?: boolean
  setHistoricalBordersConfig?: React.Dispatch<React.SetStateAction<HistoricalBordersConfig>>
  circleOverlayConfig: CircleOverlayConfig
  setCircleOverlayConfig?: React.Dispatch<React.SetStateAction<CircleOverlayConfig>>
  analyticsOpen: boolean
  onToggleAnalytics: () => void
  selectedCountry?: CountryFeature | null
  selectedCountries?: CountryFeature[]
  deferredSelectedCountries?: CountryFeature[]
  isCalculatingStats?: boolean
  onSelectCountry?: (country: CountryFeature | null) => void
  onToggleCountry?: (country: CountryFeature) => void
  onClearCountries?: () => void
  countriesMode?: boolean
  onToggleCountriesMode?: (enabled: boolean) => void
  hoveredCountry?: CountryFeature | null
  onHoverCountry?: (country: CountryFeature | null) => void
  countryStats?: CountryStats | null
  onInspect?: (data: InspectionData | null) => void
  settingsDrawerOpen?: boolean
  onToggleSettingsDrawer?: (open: boolean) => void
  sidebarWidth?: number
  colourbarWidth?: number
  onResizeColourbarWidth?: (width: number) => void
  infoPanelOpen?: boolean
  onToggleInfoPanel?: () => void
  onCloseInfoPanel?: () => void
  activeLayerId?: string | null
  activeVariableSelectors?: Record<string, string | string[]>
  dataLayers?: Record<string, ParsedDataLayer>
  isLoadingLayers?: boolean
  onChangeVariableSelector?: (arg0_key: string, arg1_option: string | string[]) => void
  onSelectLayer?: (arg0_layer_id: string) => void
  legendPosition?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-centre' | 'bottom-centre'
  onChangeLegendPosition?: (pos: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right') => void
  onCloseCityDetails?: () => void
  onHoverCity?: (city: CityPoint | null, x?: number, y?: number) => void
  onSelectCity?: (city: CityPoint) => void
  onTogglePerformantMode?: (enabled: boolean) => void
  onToggleUi?: () => void
  performantMode?: boolean
  selectedCity?: CityFullRecord | null
  selectedCityKey?: string | null
  setStadesterConfig?: React.Dispatch<React.SetStateAction<StadesterConfig>>
  stadesterCities?: CityPoint[]
  stadesterConfig?: StadesterConfig
  timelineYear?: number
  uiVisible?: boolean
  userRole?: UserRole
  onChangeYear?: (arg0_year: number) => void
  onToggleHistoricalBorders?: (arg0_enabled: boolean) => void
}

/**
 * Main map viewer component rendering multi-projection deck.gl views with 2D/3D overlays.
 *
 * @param {MapViewerProps} arg0_props
 * @returns {React.ReactElement}
 */
export const MapViewer: React.FC<MapViewerProps> = function (arg0_props: MapViewerProps) {
  //Convert from parameters
  let props = (arg0_props) ? arg0_props : ({} as MapViewerProps)
  let analytics_open = props.analyticsOpen
  let breaks = props.breaks
  let circle_overlay_config = props.circleOverlayConfig
  let colourbar_width = props.colourbarWidth
  let countries_mode = props.countriesMode
  let country_stats = props.countryStats
  let heightmap_config = props.heightmapConfig
  let historical_borders_config = props.historicalBordersConfig
  let hovered_country = props.hoveredCountry
  let info_panel_open = props.infoPanelOpen ?? false
  let invert_palette = props.invertPalette
  let is_calculating_stats = props.isCalculatingStats
  let is_timelapse_exporting = props.isTimelapseExporting ?? false
  let legend_position = ((props.legendPosition || 'top-left') as string).replace('centre', 'center') as 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  let legend_subtitle = props.legendSubtitle
  let legend_title = props.legendTitle
  let log_sigma = props.logSigma
  let map_modes = props.mapModes
  let max_val = props.maxVal
  let min_val = props.minVal
  let on_change_legend_position = props.onChangeLegendPosition
  let on_clear_countries = props.onClearCountries
  let on_close_city_details = props.onCloseCityDetails
  let on_close_info_panel = props.onCloseInfoPanel
  let on_hover_city = props.onHoverCity
  let on_hover_country = props.onHoverCountry
  let on_inspect = props.onInspect
  let on_reorder_map_modes = props.onReorderMapModes
  let on_resize_colourbar_width = props.onResizeColourbarWidth
  let on_select_city = props.onSelectCity
  let on_select_country = props.onSelectCountry
  let on_toggle_analytics = props.onToggleAnalytics
  let on_toggle_countries_mode = props.onToggleCountriesMode
  let on_toggle_country = props.onToggleCountry
  let on_toggle_map_mode = props.onToggleMapMode
  let on_toggle_performant_mode = props.onTogglePerformantMode
  let on_toggle_settings_drawer = props.onToggleSettingsDrawer
  let on_toggle_ui = props.onToggleUi
  let on_update_breaks = props.onUpdateBreaks
  let opacity = props.opacity
  let palette = props.palette
  let performant_mode = props.performantMode ?? false
  let projection = props.projection
  let raster = props.raster
  let raster_bounds = props.rasterBounds
  let rendered_canvas = props.renderedCanvas
  let scale_type = props.scaleType
  let selected_city = props.selectedCity
  let selected_city_key = props.selectedCityKey
  let selected_countries = props.selectedCountries
  let selected_country = props.selectedCountry
  let set_circle_overlay_config = props.setCircleOverlayConfig
  let set_heightmap_config = props.setHeightmapConfig
  let set_historical_borders_config = props.setHistoricalBordersConfig
  let set_projection = props.setProjection
  let set_stadester_config = props.setStadesterConfig
  let sidebar_width = props.sidebarWidth
  let stadester_cities = props.stadesterCities
  let stadester_config = props.stadesterConfig
  let timeline_year = props.timelineYear
  let ui_visible = props.uiVisible !== undefined ? props.uiVisible : true

  //Declare local instance variables
  let active_layer: any = null
  let camera_tilt: number
  let circle_pixel_data: any
  let deck_ref = useRef<any>(null)
  let elevation_spikes_data: any
  let equal_earth_land_geo_json: any
  let graticule_paths: { path: [number, number][] }[]
  let handle_click: (info: any) => void
  let handle_double_click: () => void
  let handle_hover: (info: any) => void
  let handle_view_state_change: (e: any) => void
  let hover_raf_ref = useRef<number | null>(null)
  let is_interacting_ref = useRef<boolean>(false)
  let last_country_ref = useRef<CountryFeature | null>(null)
  let last_hovered_country_code_ref = useRef<string | null | undefined>(null)
  let layers: any[]
  let pending_hover_info_ref = useRef<any>(null)
  let pending_view_state_ref = useRef<any>(null)
  let sample_raster_at: (coordX: number, coordY: number) => InspectionData | null
  let view_state_raf_ref = useRef<number | null>(null)
  let views: any

  //Function body
  let [internal_flyout_open, set_internal_flyout_open] = useState(false)
  let flyout_open = (props.settingsDrawerOpen !== undefined) ? props.settingsDrawerOpen : internal_flyout_open
  let set_flyout_open = on_toggle_settings_drawer || set_internal_flyout_open

  let [hovered_city, set_hovered_city] = useState<CityPoint | null>(null)
  let [hovered_city_pos, set_hovered_city_pos] = useState<{ x: number; y: number } | null>(null)
  let [hovered_historical_feature, set_hovered_historical_feature] = useState<HistoricalBorderFeature | null>(null)
  let [selected_historical_feature, set_selected_historical_feature] = useState<HistoricalBorderFeature | null>(null)
  let [selected_historical_anchor_coord, set_selected_historical_anchor_coord] = useState<[number, number] | null>(null)
  let [selected_historical_anchor_screen, set_selected_historical_anchor_screen] = useState<{ x: number; y: number } | null>(null)
  let [mapmodes_bounds, set_mapmodes_bounds] = useState<{ left: number; right: number; top: number } | null>(null)
  let [mapmodes_taken_right, set_mapmodes_taken_right] = useState<number>(352)
  let [timeline_bounds, set_timeline_bounds] = useState<{ left: number; right: number; top: number } | null>(null)
  let [timeline_clearance, set_timeline_clearance] = useState<number>(128)
  let [top_right_taken, set_top_right_taken] = useState<number>(0)

  let is_historical_borders_active = Boolean(
    historical_borders_config?.enabled ||
    props.historicalBordersEnabled ||
    props.activeLayerId === 'statistical_borders' ||
    (props.activeLayerId && props.activeLayerId.includes('border')) ||
    map_modes.find((arg0_m) => arg0_m.id === 'historical_borders')?.active
  )

  let historical_borders_result = useHistoricalBorders(
    props.activeLayerId,
    timeline_year || 1950,
    is_historical_borders_active
  )

  //Dismiss city hover tooltip when cities overlay is disabled or mode changes
  useEffect(() => {
    set_hovered_city(null)
    set_hovered_city_pos(null)
  }, [stadester_config?.enabled, props.activeLayerId, map_modes, projection])

  useEffect(() => {
    if (!selected_countries || selected_countries.length === 0) {
      if (!selected_country)
        set_selected_historical_feature(null)
    }
  }, [selected_countries, selected_country])

  useEffect(() => {
    let updateClearance = () => {
      //1. Timeline bounds and clearance
      let timeline_el = document.getElementById('dataview-timelinebar-container')
      if (timeline_el) {
        let rect = timeline_el.getBoundingClientRect()
        let from_bottom = window.innerHeight - rect.top
        let next_clearance = Math.max(from_bottom, 0) + UI_LAYOUT.margin
        set_timeline_clearance((arg0_prev) => (arg0_prev === next_clearance ? arg0_prev : next_clearance))
        set_timeline_bounds((arg0_prev) => {
          if (arg0_prev && arg0_prev.left === rect.left && arg0_prev.right === rect.right && arg0_prev.top === rect.top)
            return arg0_prev
          return { left: rect.left, right: rect.right, top: rect.top }
        })
      } else {
        set_timeline_clearance((arg0_prev) => (arg0_prev === UI_LAYOUT.margin ? arg0_prev : UI_LAYOUT.margin))
        set_timeline_bounds((arg0_prev) => (arg0_prev === null ? null : null))
      }

      //2. Mapmodes tray bounds
      let mapmodes_el = document.getElementById('dataview-mapmodes-tray')
      if (mapmodes_el) {
        let rect = mapmodes_el.getBoundingClientRect()
        if (rect.width > 0 && rect.left < window.innerWidth) {
          let next_taken = Math.max(window.innerWidth - rect.left, 0)
          set_mapmodes_taken_right((arg0_prev) => (arg0_prev === next_taken ? arg0_prev : next_taken))
          set_mapmodes_bounds((arg0_prev) => {
            if (arg0_prev && arg0_prev.left === rect.left && arg0_prev.right === rect.right && arg0_prev.top === rect.top)
              return arg0_prev
            return { left: rect.left, right: rect.right, top: rect.top }
          })
        } else {
          set_mapmodes_taken_right((arg0_prev) => (arg0_prev === 0 ? 0 : 0))
          set_mapmodes_bounds((arg0_prev) => (arg0_prev === null ? null : null))
        }
      } else {
        set_mapmodes_taken_right((arg0_prev) => (arg0_prev === 0 ? 0 : 0))
        set_mapmodes_bounds((arg0_prev) => (arg0_prev === null ? null : null))
      }

      //3. Top-right trays (AnalyticsDrawer, Settings, Toolbar)
      let current_top_right = 0
      let analytics_el = document.getElementById('dataview-analytics-drawer')
      let settings_el = document.getElementById('dataview-settings-drawer')
      let toolbar_el = document.getElementById('dataview-top-right-toolbar')

      if (analytics_el) {
        let rect = analytics_el.getBoundingClientRect()
        if (rect.width > 0 && rect.left < window.innerWidth)
          current_top_right = Math.max(current_top_right, window.innerWidth - rect.left)
      }
      if (settings_el) {
        let rect = settings_el.getBoundingClientRect()
        if (rect.width > 0 && rect.left < window.innerWidth)
          current_top_right = Math.max(current_top_right, window.innerWidth - rect.left)
      }
      if (toolbar_el) {
        let rect = toolbar_el.getBoundingClientRect()
        if (rect.width > 0 && rect.left < window.innerWidth)
          current_top_right = Math.max(current_top_right, window.innerWidth - rect.left)
      }
      set_top_right_taken((arg0_prev) => (arg0_prev === current_top_right ? arg0_prev : current_top_right))
    }

    updateClearance()
    window.addEventListener('resize', updateClearance)
    let ro = new ResizeObserver(updateClearance)
    let timeline_el = document.getElementById('dataview-timelinebar-container')
    let mapmodes_el = document.getElementById('dataview-mapmodes-tray')
    if (timeline_el)
      ro.observe(timeline_el)
    if (mapmodes_el)
      ro.observe(mapmodes_el)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateClearance)
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [flyout_open, analytics_open, ui_visible, map_modes])

  let [proj_view_states, set_proj_view_states] = useState<Record<ProjectionType, any>>({
    Mercator: MAP_CONFIG.mapDefines?.initialMercator || {
      longitude: 0,
      latitude: 20,
      zoom: 1.2,
      pitch: 0,
      bearing: 0,
      maxZoom: 18,
      minZoom: 0,
      minPitch: 0,
      maxPitch: 85,
    },
    Globe: MAP_CONFIG.mapDefines?.initialGlobe || {
      longitude: 0,
      latitude: 20,
      zoom: 0,
      pitch: 0,
      bearing: 0,
      maxZoom: 18,
      minZoom: 0,
      minPitch: 0,
      maxPitch: 85,
    },
    Equirectangular: {
      target: [0, 0, 0],
      zoom: typeof window !== 'undefined'
        ? Math.max(1.5, parseFloat(Math.log2(window.innerWidth / 360).toFixed(2)))
        : 2.83,
      minZoom: 0.2,
      maxZoom: 10,
      rotationX: 0,
      rotationOrbit: 0,
      minRotationX: -85,
      maxRotationX: 0,
    },
    EqualEarth: {
      target: [0, 0, 0],
      zoom: typeof window !== 'undefined'
        ? Math.max(1.5, parseFloat(Math.log2((window.innerHeight * 0.96) / 180).toFixed(2)))
        : 2.80,
      minZoom: 0.2,
      maxZoom: 10,
      rotationX: 0,
      rotationOrbit: 0,
      minRotationX: -85,
      maxRotationX: 0,
    },
  })

  useEffect(() => {
    if (heightmap_config.enabled) {
      set_proj_view_states((prev) => ({
        ...prev,
        Mercator: { ...prev.Mercator, pitch: Math.max(35, prev.Mercator?.pitch || 45) },
        Globe: { ...prev.Globe, pitch: Math.max(35, prev.Globe?.pitch || 45), bearing: 0 },
        Equirectangular: { ...prev.Equirectangular, rotationX: Math.min(-35, prev.Equirectangular?.rotationX || -45) },
        EqualEarth: { ...prev.EqualEarth, rotationX: Math.min(-35, prev.EqualEarth?.rotationX || -45) },
      }))
    }
  }, [heightmap_config.enabled, set_proj_view_states])

  useEffect(() => {
    let params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    let url_zoom = params?.get('zoom') ? parseFloat(params.get('zoom')!) : null
    if (url_zoom && !Number.isNaN(url_zoom)) {
      set_proj_view_states((prev) => ({
        ...prev,
        [projection]: {
          ...prev[projection],
          zoom: url_zoom,
        },
      }))
    }
    ; (window as any).__setMapZoom = (newZoom: number) => {
      set_proj_view_states((prev) => ({
        ...prev,
        [projection]: {
          ...prev[projection],
          zoom: newZoom,
        },
      }))
    }
  }, [projection, set_proj_view_states])


  let [basemap, set_basemap] = useState<string>(MAP_CONFIG.basemapLayers[0]?.id || 'dark')
  let [show_graticule, set_show_graticule] = useState(true)
  let [inspect_data, set_inspect_data] = useState<InspectionData | null>(null)
  let [cursor_pos, set_cursor_pos] = useState<{ x: number; y: number } | null>(null)

  let [land_geo_json, set_land_geo_json] = useState<any>(null)
  let [country_features, set_country_features] = useState<CountryFeature[]>([])

  useEffect(() => {
    fetch('/data/ne_50m_land.geojson')
      .then((r) => r.json())
      .then((data) => set_land_geo_json(data))
      .catch((err) => console.error('Failed to load land geojson:', err))

    loadCountriesGeoJson().then((feats) => set_country_features(feats))
  }, [])

  equal_earth_land_geo_json = useMemo(() => {
    if (!land_geo_json)
      return null
    try {
      return {
        type: 'FeatureCollection',
        features: land_geo_json.features.map((f: any) => ({
          ...f,
          geometry: transformGeometryToEqualEarth(f.geometry),
        })),
      }
    } catch {
      return land_geo_json
    }
  }, [land_geo_json])

  graticule_paths = useMemo(() => {
    if (projection === 'EqualEarth')
      return generateEqualEarthGraticule(10, 20)

    let lat_interval = MAP_CONFIG.mapDefines?.graticule?.latInterval || 10
    let lng_interval = MAP_CONFIG.mapDefines?.graticule?.lngInterval || 20
    let paths_array: { path: [number, number][] }[] = []

    for (let i = -80; i <= 80; i += lat_interval) {
      let local_line: [number, number][] = []
      for (let x = -180; x <= 180; x += 5)
        local_line.push([x, i])
      paths_array.push({ path: local_line })
    }

    for (let i = -180; i <= 180; i += lng_interval) {
      let local_line: [number, number][] = []
      for (let x = -85; x <= 85; x += 5)
        local_line.push([i, x])
      paths_array.push({ path: local_line })
    }

    return paths_array
  }, [projection])

  let effective_country_features = useMemo(() => {
    if (is_historical_borders_active && historical_borders_result.bordersData?.features && historical_borders_result.bordersData.features.length > 0)
      return historical_borders_result.bordersData.features as unknown as CountryFeature[]
    return country_features
  }, [is_historical_borders_active, historical_borders_result.bordersData, country_features])

  sample_raster_at = useCallback(
    (coordX: number, coordY: number): InspectionData | null => {
      return sampleRasterAt(
        coordX,
        coordY,
        raster,
        projection,
        effective_country_features,
        Boolean(countries_mode || is_historical_borders_active),
        last_country_ref.current
      )
    },
    [raster, effective_country_features, projection, countries_mode, is_historical_borders_active]
  )

  handle_click = useCallback(
    (info: any) => {
      // Guard clauses: if a city or higher z-index overlay was clicked, intercept and do not click the country behind it
      if (info.layer?.id?.includes('stadester') || (info.object && info.object.coords))
        return

      if (info.layer?.id?.includes('historical-borders') || (info.object && (info.object.properties?.gwcode !== undefined || info.object.properties?.keyframes !== undefined))) {
        let hist_feat = info.object as HistoricalBorderFeature
        set_selected_historical_feature(hist_feat)
        if (info.coordinate) {
          set_selected_historical_anchor_coord([info.coordinate[0], info.coordinate[1]])
        }
        if (info.x !== undefined && info.y !== undefined) {
          set_selected_historical_anchor_screen({ x: info.x, y: info.y })
        }
        if (on_toggle_country) {
          on_toggle_country(hist_feat as unknown as CountryFeature)
        } else if (on_select_country) {
          on_select_country(hist_feat as unknown as CountryFeature)
        }
        return
      }

      let insp: InspectionData | null
      let x_coord: number
      let y_coord: number

      if (!info.coordinate)
        return

      x_coord = info.coordinate[0]
      y_coord = info.coordinate[1]

      insp = sample_raster_at(x_coord, y_coord)
      set_inspect_data(insp)
      set_cursor_pos({ x: info.x, y: info.y })
      if (on_inspect)
        on_inspect(insp)

      if (insp && country_features.length > 0) {
        let local_country = findCountryAtLngLat(insp.lng, insp.lat, country_features)
        if (local_country) {
          if (on_toggle_country) {
            on_toggle_country(local_country)
          } else if (on_select_country) {
            on_select_country(local_country)
          }
        }
      }
    },
    [sample_raster_at, on_inspect, country_features, on_toggle_country, on_select_country, set_inspect_data, set_cursor_pos]
  )

  handle_hover = useCallback(
    (info: any) => {
      // Guard clauses: immediately ignore hover events when user is dragging or interacting
      if (is_interacting_ref.current)
        return

      pending_hover_info_ref.current = info
      if (hover_raf_ref.current !== null)
        return

      hover_raf_ref.current = requestAnimationFrame(() => {
        hover_raf_ref.current = null
        let cur_info = pending_hover_info_ref.current
        if (!cur_info || !cur_info.coordinate) {
          set_inspect_data(null)
          set_cursor_pos(null)
          last_hovered_country_code_ref.current = null
          if (countries_mode && on_hover_country)
            on_hover_country(null)
          return
        }

        let x_coord = cur_info.coordinate[0]
        let y_coord = cur_info.coordinate[1]
        let insp = sample_raster_at(x_coord, y_coord)
        set_inspect_data(insp)

        if (cur_info.x !== undefined && cur_info.y !== undefined)
          set_cursor_pos({ x: cur_info.x, y: cur_info.y })

        if (cur_info.layer?.id?.includes('historical-borders') || (cur_info.object && (cur_info.object.properties?.gwcode !== undefined || cur_info.object.properties?.keyframes !== undefined))) {
          set_hovered_historical_feature(cur_info.object || null)
        } else {
          set_hovered_historical_feature(null)
        }

        if (on_inspect)
          on_inspect(insp)

        if ((countries_mode || is_historical_borders_active) && insp && effective_country_features.length > 0 && on_hover_country) {
          let next_code = insp.countryName
          if (last_hovered_country_code_ref.current !== next_code) {
            last_hovered_country_code_ref.current = next_code
            let local_country = findCountryAtLngLat(insp.lng, insp.lat, effective_country_features)
            on_hover_country(local_country)
          }
        }
      })
    },
    [sample_raster_at, on_inspect, countries_mode, is_historical_borders_active, effective_country_features, on_hover_country, set_inspect_data, set_cursor_pos]
  )

  handle_double_click = useCallback(() => {
    let equal_earth_zoom = typeof window !== 'undefined'
      ? Math.max(1.5, parseFloat(Math.log2((window.innerHeight * 0.96) / 180).toFixed(2)))
      : 2.80
    let equirect_zoom = typeof window !== 'undefined'
      ? Math.max(1.5, parseFloat(Math.log2(window.innerWidth / 360).toFixed(2)))
      : 2.83

    set_proj_view_states((prev) => ({
      ...prev,
      [projection]:
        (projection === 'Equirectangular')
          ? { target: [0, 0, 0], zoom: equirect_zoom, minZoom: 0.2, maxZoom: 10, rotationX: 0, rotationOrbit: 0, minRotationX: -85, maxRotationX: 0 }
          : (projection === 'EqualEarth')
            ? { target: [0, 0, 0], zoom: equal_earth_zoom, minZoom: 0.2, maxZoom: 10, rotationX: 0, rotationOrbit: 0, minRotationX: -85, maxRotationX: 0 }
            : (projection === 'Globe')
              ? { longitude: 0, latitude: 20, zoom: 3, pitch: 0, bearing: 0, maxZoom: 18, minZoom: 0, minPitch: 0, maxPitch: 85 }
              : { longitude: 0, latitude: 20, zoom: 1.2, pitch: 0, bearing: 0, maxZoom: 18, minZoom: 0, minPitch: 0, maxPitch: 85 },
    }))
  }, [projection, set_proj_view_states])

  handle_view_state_change = useCallback(
    (e: any) => {
      //Convert from parameters
      let next_view_state = e.viewState

      //Function body
      if (projection === 'Globe') {
        let bearing = next_view_state.bearing ?? 0
        let clamped_lat = Math.max(-85, Math.min(85, next_view_state.latitude ?? 0))
        bearing = ((bearing + 180) % 360 + 360) % 360 - 180

        next_view_state = {
          ...next_view_state,
          latitude: clamped_lat,
          bearing,
        }
      }
      pending_view_state_ref.current = next_view_state

      if (view_state_raf_ref.current !== null)
        return

      view_state_raf_ref.current = requestAnimationFrame(() => {
        view_state_raf_ref.current = null
        if (pending_view_state_ref.current) {
          set_proj_view_states((prev) => ({
            ...prev,
            [projection]: pending_view_state_ref.current,
          }))
        }
      })
    },
    [projection, set_proj_view_states]
  )

  views = useMemo(() => {
    if (projection === 'Globe') {
      return new SmoothGlobeView({
        id: 'globe-view',
        resolution: 1,
        parameters: { cullMode: 'none' },
        controller: {
          type: SmoothGlobeController,
          doubleClickZoom: false,
          dragRotate: true,
          dragMode: 'pan',
        },
      })
    }
    if (projection === 'Equirectangular') {
      return new OrbitView({
        id: 'equirectangular-view',
        orbitAxis: 'Y',
        controller: {
          type: SmoothOrbitController,
          doubleClickZoom: false,
          dragRotate: true,
          dragMode: 'pan',
        },
      })
    }
    if (projection === 'EqualEarth') {
      return new OrbitView({
        id: 'equal-earth-view',
        orbitAxis: 'Y',
        controller: {
          type: SmoothOrbitController,
          doubleClickZoom: false,
          dragRotate: true,
          dragMode: 'pan',
        },
      })
    }
    return new MapView({
      id: 'map-view',
      repeat: false,
      controller: {
        type: SmoothMapController,
        doubleClickZoom: false,
        dragRotate: true,
        dragMode: 'pan',
      },
    })
  }, [projection])

  camera_tilt = (projection === 'Mercator' || projection === 'Globe')
    ? proj_view_states[projection]?.pitch || 0
    : Math.abs(proj_view_states[projection]?.rotationX || 0)

  elevation_spikes_data = useElevationSpikes({
    heightmapConfig: heightmap_config,
    raster,
    minVal: min_val,
    maxVal: max_val,
    scaleType: scale_type,
    logSigma: log_sigma,
    palette,
    invertPalette: invert_palette,
    projection,
    countriesMode: countries_mode,
    countryStats: country_stats,
    selectedCountries: selected_countries,
    selectedCountry: selected_country,
  })

  circle_pixel_data = useCircleOverlay({
    circleOverlayConfig: circle_overlay_config,
    raster,
    palette,
    invertPalette: invert_palette,
    minVal: min_val,
    maxVal: max_val,
    projection,
    heightmapConfig: heightmap_config,
    countriesMode: countries_mode,
    selectedCountries: selected_countries,
    selectedCountry: selected_country,
  })

  let worker_result = useStadesterWorker({
    cities: stadester_cities || [],
    config: stadester_config,
    projection,
    viewState: proj_view_states[projection],
    year: timeline_year || 1950,
  })

  layers = useDeckLayers({
    projection,
    basemap,
    landGeoJson: land_geo_json,
    equalEarthLandGeoJson: equal_earth_land_geo_json,
    showGraticule: show_graticule,
    graticulePaths: graticule_paths,
    renderedCanvas: rendered_canvas,
    rasterBounds: raster_bounds,
    opacity,
    heightmapConfig: heightmap_config,
    elevationSpikesData: elevation_spikes_data,
    circleOverlayConfig: circle_overlay_config,
    circlePixelData: circle_pixel_data,
    raster,
    palette,
    invertPalette: invert_palette,
    minVal: min_val,
    maxVal: max_val,
    selectedCountries: selected_countries,
    selectedCountry: selected_country,
    countriesMode: countries_mode,
    hoveredCountry: hovered_country,
    hoveredCity: hovered_city,
    onHoverCity: (arg0_city, arg1_x, arg2_y) => {
      set_hovered_city(arg0_city)
      if (arg1_x !== undefined && arg2_y !== undefined)
        set_hovered_city_pos({ x: arg1_x, y: arg2_y })
      if (on_hover_city)
        on_hover_city(arg0_city, arg1_x, arg2_y)
    },
    onSelectCity: on_select_city,
    selectedCityKey: selected_city_key,
    stadesterCities: stadester_cities,
    stadesterConfig: stadester_config,
    stadesterLabels: worker_result.labels,
    stadesterPoints: worker_result.points,
    historicalBordersConfig: historical_borders_config,
    historicalBordersData: is_historical_borders_active ? historical_borders_result.bordersData : null,
    selectedHistoricalFeature: selected_historical_feature,
    hoveredHistoricalFeature: hovered_historical_feature,
    onSelectHistoricalFeature: (feat, coord, x, y) => {
      set_selected_historical_feature(feat)
      if (coord) {
        set_selected_historical_anchor_coord([coord[0], coord[1]])
      }
      if (x !== undefined && y !== undefined) {
        set_selected_historical_anchor_screen({ x, y })
      }
      if (on_toggle_country) {
        on_toggle_country(feat as unknown as CountryFeature)
      } else if (on_select_country) {
        on_select_country(feat as unknown as CountryFeature)
      }
    },
    onHoverHistoricalFeature: (feat) => {
      set_hovered_historical_feature(feat)
    },
    timelineYear: timeline_year || 1950,
    viewState: proj_view_states[projection],
  })

  if (props.activeLayerId && props.dataLayers) {
    active_layer = props.dataLayers[props.activeLayerId] || null
    if (!active_layer && props.activeLayerId.includes('.')) {
      let parent_id = props.activeLayerId.split('.')[0]
      let parent = props.dataLayers[parent_id]
      if (parent && parent.sub_layers) {
        active_layer = parent.sub_layers.find((arg0_sub) => arg0_sub.id === props.activeLayerId) || null
      }
    }
  }

  //Compute screen anchor coordinates for selected city panel
  let selected_city_anchor = useMemo(() => {
    if (!selected_city || !selected_city.coords || !deck_ref.current)
      return null
    try {
      let vp = deck_ref.current.deck?.getViewports?.()[0]
      if (!vp)
        return null
      let c_lat = selected_city.coords[0]
      let c_lon = selected_city.coords[1]
      let px = c_lon
      let py = c_lat
      if (projection === 'EqualEarth') {
        let proj = projectEqualEarth(c_lon, c_lat)
        px = proj[0]
        py = proj[1]
      } else if (projection === 'Globe') {
        if (!isGlobePointVisible(c_lon, c_lat, proj_view_states.Globe, 0.02))
          return null
      }
      let projected = vp.project([px, py])
      if (projected && projected.length >= 2)
        return { x: projected[0], y: projected[1] }
    } catch (e) {
      // Ignore projection errors
    }
    return null
  }, [selected_city, projection, proj_view_states[projection]])

  //Compute screen anchor coordinates for selected historical borders panel
  let selected_historical_anchor = useMemo(() => {
    if (!selected_historical_feature || !deck_ref.current)
      return selected_historical_anchor_screen || null
    if (!selected_historical_anchor_coord)
      return selected_historical_anchor_screen || null
    try {
      let vp = deck_ref.current.deck?.getViewports?.()[0]
      if (!vp)
        return selected_historical_anchor_screen || null
      let [c_lon, c_lat] = selected_historical_anchor_coord
      let px = c_lon
      let py = c_lat
      if (projection === 'EqualEarth') {
        let proj = projectEqualEarth(c_lon, c_lat)
        px = proj[0]
        py = proj[1]
      } else if (projection === 'Globe') {
        if (!isGlobePointVisible(c_lon, c_lat, proj_view_states.Globe, 0.02))
          return null
      }
      let projected = vp.project([px, py])
      if (projected && projected.length >= 2)
        return { x: projected[0], y: projected[1] }
    } catch {
      // Ignore projection errors
    }
    return selected_historical_anchor_screen || null
  }, [selected_historical_feature, selected_historical_anchor_coord, selected_historical_anchor_screen, projection, proj_view_states[projection]])

  //Return statement
  return (
    <div
      className="relative w-full h-full overflow-hidden select-none bg-background font-sans"
      style={{ imageRendering: 'pixelated' }}
      onDoubleClick={handle_double_click}
      onContextMenu={(e) => e.preventDefault()}
      onPointerLeave={() => {
        set_hovered_city(null)
        set_hovered_city_pos(null)
      }}
    >
      <DeckGL
        ref={deck_ref}
        id="deckgl-overlay"
        views={views}
        viewState={proj_view_states[projection]}
        onViewStateChange={handle_view_state_change}
        onInteractionStateChange={(arg0_state: any) => {
          let state = arg0_state
          let is_active = Boolean(state.isDragging || state.isPanning || state.isRotating || state.isZooming)
          is_interacting_ref.current = is_active
          if (is_active) {
            if (hover_raf_ref.current !== null) {
              cancelAnimationFrame(hover_raf_ref.current)
              hover_raf_ref.current = null
            }
            set_inspect_data(null)
            set_cursor_pos(null)
          }
        }}
        controller={false}
        layers={layers}
        onClick={handle_click}
        onHover={handle_hover}
        onAfterRender={() => {
          if (typeof window !== 'undefined') {
            ; (window as any).__deckRendered = true
              ; (window as any).deck = deck_ref.current
          }
        }}
        getCursor={({ isHovering }) => ((isHovering) ? 'crosshair' : 'grab')}
      />

      {/* Unified Floating Tooltip Container (HUD Inspector & Stadestér City) */}
      {ui_visible && !selected_city && (
        <ClickInfoPanel
          activeLayer={active_layer}
          activeVariableSelectors={props.activeVariableSelectors}
          hoveredCity={hovered_city}
          hoveredHistoricalFeature={hovered_historical_feature}
          info={inspect_data}
          pos={cursor_pos || hovered_city_pos}
          stadesterConfig={stadester_config}
        />
      )}

      {/* Stadestér City Details Panel */}
      {ui_visible && selected_city && (
        <CityDetailsPanel
          anchorPos={selected_city_anchor}
          city={selected_city}
          currentYear={timeline_year || 2025}
          onClose={on_close_city_details || (() => { })}
        />
      )}

      {/* Historical Country Details Panel */}
      {ui_visible && selected_historical_feature && (
        <HistoricalBorderDetailsPanel
          anchorPos={selected_historical_anchor}
          countryStats={country_stats}
          currentYear={timeline_year || 1950}
          feature={selected_historical_feature}
          isCalculatingStats={is_calculating_stats}
          onClose={() => {
            set_selected_historical_feature(null)
            set_selected_historical_anchor_coord(null)
            set_selected_historical_anchor_screen(null)
            if (on_clear_countries) {
              on_clear_countries()
            } else if (on_select_country) {
              on_select_country(null)
            }
          }}
          onJumpToYear={(yr) => {
            if (props.onChangeYear)
              props.onChangeYear(yr)
          }}
          onOpenAnalytics={() => {
            if (!analytics_open && on_toggle_analytics)
              on_toggle_analytics()
          }}
          sidebarWidth={sidebar_width}
        />
      )}

      {/* Top Left: Value Colourbar & Information Flyout Container, Top Right Tools */}
      {(() => {
          let has_canvas = Boolean(rendered_canvas)
          let is_country_relative = Boolean(
            countries_mode &&
            ((selected_countries && selected_countries.length > 0) || Boolean(hovered_country)) &&
            country_stats &&
            country_stats.validCount > 0 &&
            Number.isFinite(country_stats.min) &&
            Number.isFinite(country_stats.max) &&
            country_stats.max > country_stats.min
          )
          let legend_min = (is_country_relative) ? country_stats!.min : min_val
          let legend_max = (is_country_relative) ? country_stats!.max : max_val
          let legend_breaks = (is_country_relative) ? undefined : breaks
          let legend_country_name = (is_country_relative) ? country_stats!.name : undefined

          let current_sidebar_width = sidebar_width ?? UI_LAYOUT.sidebarWidth
          if (is_timelapse_exporting)
            current_sidebar_width = 0
          let current_colourbar_width = colourbar_width ?? 336
          let colourbar_left = is_timelapse_exporting
            ? UI_LAYOUT.margin
            : UI_LAYOUT.margin + current_sidebar_width + UI_LAYOUT.gap

          return (
            <MapViewerHUD
              analyticsOpen={analytics_open}
              basemap={basemap}
              cameraTilt={camera_tilt}
              circleOverlayConfig={circle_overlay_config}
              colorPalette={palette}
              colourbarLeft={colourbar_left}
              colourbarWidth={current_colourbar_width}
              flyoutOpen={flyout_open}
              hasCanvas={has_canvas}
              heightmapConfig={heightmap_config}
              hoveredCity={hovered_city}
              infoPanelOpen={info_panel_open}
              inspectData={inspect_data}
              invertPalette={invert_palette}
              isTimelapseExporting={is_timelapse_exporting}
              legendBreaks={legend_breaks}
              legendCountryName={legend_country_name || undefined}
              legendMax={legend_max}
              legendMin={legend_min}
              legendPosition={legend_position}
              legendSubtitle={legend_subtitle}
              legendTitle={legend_title}
              logSigma={log_sigma}
              mapModes={map_modes}
              mapmodesTakenRight={mapmodes_taken_right}
              onChangeLegendPosition={on_change_legend_position}
              onCloseInfoPanel={on_close_info_panel}
              onDoubleClick={handle_double_click}
              onResizeColourbarWidth={on_resize_colourbar_width}
              onToggleAnalytics={on_toggle_analytics}
              onTogglePerformantMode={on_toggle_performant_mode}
              onToggleUi={on_toggle_ui}
              onUpdateBreaks={on_update_breaks}
              performantMode={performant_mode}
              projection={projection}
              raster={raster}
              scaleType={scale_type}
              selectedCountries={selected_countries}
              setBasemap={set_basemap}
              setFlyoutOpen={set_flyout_open}
              setProjection={set_projection}
              setShowGraticule={set_show_graticule}
              showGraticule={show_graticule}
              stadesterCities={stadester_cities}
              stadesterConfig={stadester_config}
              timelineBounds={timeline_bounds}
              timelineClearance={timeline_clearance}
              topRightTaken={top_right_taken}
              uiVisible={ui_visible}
            />
          )
        })()}

      {/* Bottom Right Tray: Unified Mapmodes with Inline Settings */}
      {ui_visible && (
        <MapmodesTray
          activeLayerId={props.activeLayerId}
          activeVariableSelectors={props.activeVariableSelectors}
          allCountries={country_features}
          analyticsOpen={props.analyticsOpen}
          bottomClearance={
            (window.innerHeight > window.innerWidth || Boolean(timeline_bounds && mapmodes_bounds && timeline_bounds.right > mapmodes_bounds.left)) && timeline_clearance > UI_LAYOUT.margin
              ? timeline_clearance
              : undefined
          }
          circleOverlayConfig={circle_overlay_config}
          countriesMode={Boolean(countries_mode)}
          countryStats={country_stats}
          heightmapConfig={heightmap_config}
          historicalBordersConfig={historical_borders_config}
          setHistoricalBordersConfig={set_historical_borders_config}
          isCalculatingStats={is_calculating_stats}
          isLoadingLayers={props.isLoadingLayers}
          layers={props.dataLayers}
          mapModes={map_modes}
          onChangeVariableSelector={props.onChangeVariableSelector}
          onClearCountries={on_clear_countries || NOOP_FN}
          onReorderMapModes={on_reorder_map_modes}
          onSelectLayer={props.onSelectLayer}
          onToggleCountriesMode={on_toggle_countries_mode}
          onToggleCountry={on_toggle_country || NOOP_FN}
          onToggleMapMode={on_toggle_map_mode}
          selectedCountries={selected_countries || EMPTY_ARRAY}
          setCircleOverlayConfig={set_circle_overlay_config || NOOP_FN}
          setHeightmapConfig={set_heightmap_config || NOOP_FN}
          setStadesterConfig={set_stadester_config}
          settingsOpen={flyout_open}
          stadesterCityCount={stadester_cities?.length || 0}
          stadesterConfig={stadester_config}
          userRole={props.userRole}
        />
      )}
    </div>
  )
}

export default MapViewer
