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
import {
  invertEqualEarth,
  transformGeometryToEqualEarth,
  generateEqualEarthGraticule,
} from '@/lib/geopng/equalEarth'
import {
  DecodedRaster,
  InspectionData,
  ProjectionType,
  HeightmapConfig,
  CircleOverlayConfig,
  MapModeItem,
  MapModeId,
} from '@/lib/geopng/types'
import { MAP_CONFIG, getPixelOffset } from '@config'
import { UI_LAYOUT } from '@/lib/uiLayout'
import { ClickInfoPanel } from './ClickInfoPanel'
import { ColorBarLegend } from './ColorBarLegend'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'
import { MapmodesTray } from './MapmodesTray'
import { InfoFlyoutPanel } from './InfoFlyoutPanel'
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
  legendTitle: string
  legendSubtitle?: string
  scaleType: string
  logSigma: number
  breaks?: number[]
  onUpdateBreaks?: (breaks: number[]) => void
  mapModes: MapModeItem[]
  onToggleMapMode: (id: MapModeId) => void
  onReorderMapModes: (newModes: MapModeItem[]) => void
  heightmapConfig: HeightmapConfig
  setHeightmapConfig?: React.Dispatch<React.SetStateAction<HeightmapConfig>>
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
  uiVisible?: boolean
  onToggleUi?: () => void
  userRole?: UserRole
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
  let on_toggle_ui = props.onToggleUi
  let ui_visible = props.uiVisible !== undefined ? props.uiVisible : true

  //Declare local instance variables
  let active_layer: ParsedDataLayer | null = null
  let analytics_open = props.analyticsOpen
  let breaks = props.breaks
  let camera_tilt: number
  let circle_overlay_config = props.circleOverlayConfig
  let circle_pixel_data: any
  let colourbar_width = props.colourbarWidth
  let countries_mode = props.countriesMode
  let country_stats = props.countryStats
  let elevation_spikes_data: any
  let equal_earth_land_geo_json: any
  let flyout_open: boolean
  let graticule_paths: { path: [number, number][] }[]
  let handle_container_pointer_move: (e: React.PointerEvent<HTMLDivElement>) => void
  let handle_double_click: () => void
  let handle_hover: (info: any) => void
  let handle_click: (info: any) => void
  let handle_view_state_change: (e: any) => void
  let heightmap_config = props.heightmapConfig
  let hovered_country = props.hoveredCountry
  let info_panel_open = props.infoPanelOpen ?? false
  let invert_palette = props.invertPalette
  let is_calculating_stats = props.isCalculatingStats
  let last_country_ref = useRef<CountryFeature | null>(null)
  let last_hovered_country_code_ref = useRef<string | null | undefined>(null)
  let layers: any[]
  let legend_subtitle = props.legendSubtitle
  let legend_title = props.legendTitle
  let log_sigma = props.logSigma
  let map_modes = props.mapModes
  let max_val = props.maxVal
  let min_val = props.minVal
  let on_clear_countries = props.onClearCountries
  let on_close_info_panel = props.onCloseInfoPanel
  let on_hover_country = props.onHoverCountry
  let on_inspect = props.onInspect
  let on_reorder_map_modes = props.onReorderMapModes
  let on_resize_colourbar_width = props.onResizeColourbarWidth
  let on_select_country = props.onSelectCountry
  let on_toggle_analytics = props.onToggleAnalytics
  let on_toggle_countries_mode = props.onToggleCountriesMode
  let on_toggle_country = props.onToggleCountry
  let on_toggle_map_mode = props.onToggleMapMode
  let on_toggle_settings_drawer = props.onToggleSettingsDrawer
  let on_update_breaks = props.onUpdateBreaks
  let opacity = props.opacity
  let palette = props.palette
  let projection = props.projection
  let raster = props.raster
  let raster_bounds = props.rasterBounds
  let rendered_canvas = props.renderedCanvas
  let sample_raster_at: (coordX: number, coordY: number) => InspectionData | null
  let scale_type = props.scaleType
  let selected_countries = props.selectedCountries
  let selected_country = props.selectedCountry
  let set_circle_overlay_config = props.setCircleOverlayConfig
  let set_flyout_open: (open: boolean) => void
  let set_heightmap_config = props.setHeightmapConfig
  let set_projection = props.setProjection
  let sidebar_width = props.sidebarWidth
  let views: any

  //Function body
  let [internal_flyout_open, set_internal_flyout_open] = useState(false)
  flyout_open = (props.settingsDrawerOpen !== undefined) ? props.settingsDrawerOpen : internal_flyout_open
  set_flyout_open = on_toggle_settings_drawer || set_internal_flyout_open

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
    Equirectangular: MAP_CONFIG.mapDefines?.initialEquirectangular || {
      target: [0, 0, 0],
      zoom: 2.0,
      minZoom: 0.2,
      maxZoom: 10,
      rotationX: 0,
      rotationOrbit: 0,
      minRotationX: -85,
      maxRotationX: 0,
    },
    EqualEarth: MAP_CONFIG.mapDefines?.initialEqualEarth || {
      target: [0, 0, 0],
      zoom: 2.0,
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

  let [basemap, set_basemap] = useState<string>(MAP_CONFIG.basemapLayers[0]?.id || 'dark')
  let [show_graticule, set_show_graticule] = useState(true)
  let [inspect_data, set_inspect_data] = useState<InspectionData | null>(null)
  let [cursor_pos, set_cursor_pos] = useState<{ x: number; y: number } | null>(null)

  handle_container_pointer_move = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    let local_rect = e.currentTarget.getBoundingClientRect()
    set_cursor_pos({ x: e.clientX - local_rect.left, y: e.clientY - local_rect.top })
  }, [set_cursor_pos])

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

  sample_raster_at = useCallback(
    (coordX: number, coordY: number): InspectionData | null => {
      let cached_country: CountryFeature | null
      let clamped_x: number
      let clamped_y: number
      let country_name: string | null = null
      let eff_lat: number
      let lat = coordY
      let lng = coordX
      let offset: number
      let pixel_height: number
      let pixel_offset: number
      let pixel_x: number
      let pixel_y: number
      let raster_val: number

      if (!raster)
        return null

      if (projection === 'EqualEarth') {
        let local_inverted = invertEqualEarth(coordX, coordY)
        lng = local_inverted[0]
        lat = local_inverted[1]
      }

      if (lng < -180 || lng > 180 || lat < -90 || lat > 90)
        return null

      pixel_height = 180/raster.height
      pixel_x = Math.floor(((lng + 180)/360)*raster.width)
      pixel_offset = getPixelOffset(projection)
      offset = pixel_offset*pixel_height
      eff_lat = lat - offset
      pixel_y = Math.floor(((90 - eff_lat)/180)*raster.height)

      clamped_x = Math.max(0, Math.min(raster.width - 1, pixel_x))
      clamped_y = Math.max(0, Math.min(raster.height - 1, pixel_y))

      raster_val = raster.data[clamped_y*raster.width + clamped_x]

      if (country_features.length > 0) {
        cached_country = last_country_ref.current
        if (cached_country && cached_country.bbox) {
          let local_b_max_x = cached_country.bbox[2]
          let local_b_max_y = cached_country.bbox[3]
          let local_b_min_x = cached_country.bbox[0]
          let local_b_min_y = cached_country.bbox[1]
          if (lng >= local_b_min_x && lng <= local_b_max_x && lat >= local_b_min_y && lat <= local_b_max_y && isPointInGeometry(lng, lat, cached_country.geometry))
            country_name = cached_country.properties.name || cached_country.properties.name_long || null
        }
        if (!country_name) {
          let local_c = findCountryAtLngLat(lng, lat, country_features)
          last_country_ref.current = local_c
          if (local_c)
            country_name = local_c.properties.name || local_c.properties.name_long || null
        }
      }

      return {
        pixelX: clamped_x,
        pixelY: clamped_y,
        lng,
        lat,
        value: Number.isNaN(raster_val) ? null : raster_val,
        countryName: country_name,
      }
    },
    [raster, country_features, projection]
  )

  handle_click = useCallback(
    (info: any) => {
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
      let insp: InspectionData | null
      let x_coord: number
      let y_coord: number

      if (!info.coordinate) {
        set_inspect_data(null)
        set_cursor_pos(null)
        last_hovered_country_code_ref.current = null
        if (countries_mode && on_hover_country)
          on_hover_country(null)
        return
      }

      x_coord = info.coordinate[0]
      y_coord = info.coordinate[1]
      insp = sample_raster_at(x_coord, y_coord)
      set_inspect_data(insp)

      if (info.x !== undefined && info.y !== undefined)
        set_cursor_pos({ x: info.x, y: info.y })
      if (on_inspect)
        on_inspect(insp)

      if (countries_mode && insp && country_features.length > 0 && on_hover_country) {
        let next_code = insp.countryName
        if (last_hovered_country_code_ref.current !== next_code) {
          last_hovered_country_code_ref.current = next_code
          let local_country = findCountryAtLngLat(insp.lng, insp.lat, country_features)
          on_hover_country(local_country)
        }
      }
    },
    [sample_raster_at, on_inspect, countries_mode, country_features, on_hover_country, set_inspect_data, set_cursor_pos]
  )

  handle_double_click = useCallback(() => {
    set_proj_view_states((prev) => ({
      ...prev,
      [projection]:
        (projection === 'Equirectangular' || projection === 'EqualEarth')
          ? { target: [0, 0, 0], zoom: 2.0, minZoom: 0.2, maxZoom: 10, rotationX: 0, rotationOrbit: 0, minRotationX: -85, maxRotationX: 0 }
          : (projection === 'Globe')
            ? { longitude: 0, latitude: 20, zoom: 0, pitch: 0, bearing: 0, maxZoom: 18, minZoom: 0, minPitch: 0, maxPitch: 85 }
            : { longitude: 0, latitude: 20, zoom: 1.2, pitch: 0, bearing: 0, maxZoom: 18, minZoom: 0, minPitch: 0, maxPitch: 85 },
    }))
  }, [projection, set_proj_view_states])

  handle_view_state_change = useCallback(
    (e: any) => {
      let next_view_state = e.viewState
      if (projection === 'Globe') {
        let bearing = next_view_state.bearing ?? 0
        let clamped_lat = Math.max(-85, Math.min(85, next_view_state.latitude ?? 0))
        bearing = ((bearing + 180)%360 + 360)%360 - 180

        next_view_state = {
          ...next_view_state,
          latitude: clamped_lat,
          bearing,
        }
      }
      set_proj_view_states((prev) => ({
        ...prev,
        [projection]: next_view_state,
      }))
    },
    [projection, set_proj_view_states]
  )

  views = useMemo(() => {
    if (projection === 'Globe') {
      return new SmoothGlobeView({
        id: 'globe-view',
        resolution: 1,
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

  //Return statement
  return (
    <div
      className="relative w-full h-full overflow-hidden select-none bg-background font-sans"
      style={{ imageRendering: 'pixelated' }}
      onDoubleClick={handle_double_click}
      onContextMenu={(e) => e.preventDefault()}
      onPointerMove={handle_container_pointer_move}
    >
      <DeckGL
        id="deckgl-overlay"
        views={views}
        viewState={proj_view_states[projection]}
        onViewStateChange={handle_view_state_change}
        controller={false}
        layers={layers}
        onClick={handle_click}
        onHover={handle_hover}
        getCursor={({ isHovering }) => ((isHovering) ? 'crosshair' : 'grab')}
      />

      {/* Floating HUD Inspector */}
      {ui_visible && (
        <ClickInfoPanel
          info={inspect_data}
          pos={cursor_pos}
          activeLayer={active_layer}
          activeVariableSelectors={props.activeVariableSelectors}
        />
      )}

      {/* Top Left: Value Colourbar & Information Flyout Container */}
      {ui_visible && (Boolean(rendered_canvas) || info_panel_open) &&
        (() => {
          let has_canvas = Boolean(rendered_canvas)
          let is_country_relative = Boolean(
            countries_mode &&
            country_stats &&
            country_stats.validCount > 0 &&
            Number.isFinite(country_stats.min) &&
            Number.isFinite(country_stats.max)
          )
          let legend_min = (is_country_relative) ? country_stats!.min : min_val
          let legend_max = (is_country_relative) ? country_stats!.max : max_val
          let legend_breaks = (is_country_relative) ? undefined : breaks
          let legend_country_name = (is_country_relative) ? country_stats!.name : null

          let current_sidebar_width = sidebar_width ?? UI_LAYOUT.sidebarWidth
          let current_colourbar_width = colourbar_width ?? 336
          let colourbar_left = UI_LAYOUT.margin + current_sidebar_width + UI_LAYOUT.gap

          return (
            <div
              style={{
                top: `${UI_LAYOUT.margin}px`,
                left: `${colourbar_left}px`,
                width: `${current_colourbar_width}px`,
              }}
              className="absolute z-20 flex flex-col gap-3 pointer-events-none"
            >
              {/* Value Colourbar (when canvas/raster is available) */}
              {has_canvas && (
                <div className="pointer-events-auto">
                  <ColorBarLegend
                    palette={palette}
                    invertPalette={invert_palette}
                    minVal={legend_min}
                    maxVal={legend_max}
                    legendTitle={legend_title}
                    legendSubtitle={legend_subtitle}
                    scaleType={scale_type}
                    logSigma={log_sigma}
                    currentVal={inspect_data?.value ?? null}
                    breaks={legend_breaks}
                    countryName={legend_country_name}
                    onUpdateBreaks={on_update_breaks}
                    width={current_colourbar_width}
                    onResizeWidth={on_resize_colourbar_width}
                  />
                </div>
              )}

              {/* Information & Controls Flyout Panel */}
              {info_panel_open && (
                <div className="pointer-events-auto">
                  <InfoFlyoutPanel
                    isOpen={info_panel_open}
                    onClose={on_close_info_panel || (() => {})}
                    mapModes={map_modes}
                    heightmapConfig={heightmap_config}
                    circleOverlayConfig={circle_overlay_config}
                    selectedCountries={selected_countries || []}
                    projection={projection}
                    cameraTilt={camera_tilt}
                    width={current_colourbar_width}
                  />
                </div>
              )}
            </div>
          )
        })()}

      {/* Map Control Tools Toolbar (Top Right) */}
      <TooltipProvider delayDuration={150}>
        <div
          style={{ top: `${UI_LAYOUT.margin}px`, right: `${UI_LAYOUT.margin}px` }}
          className="absolute z-30 flex flex-col gap-[var(--cell-padding)] bg-card/95 backdrop-blur-md p-[var(--cell-padding)] rounded-none border border-border shadow-md"
        >
          {/* Map Display Settings Toggle (Basemaps & Projections) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={(flyout_open) ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => set_flyout_open(!flyout_open)}
                className="h-7 w-7 rounded-none text-white"
                aria-label="Map Display Settings"
              >
                <Icon name="settings" className="text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <span>Map Display Settings (Basemap & Projection)</span>
            </TooltipContent>
          </Tooltip>

          {/* Toggle Raster Calculator View Panel */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={(analytics_open) ? 'secondary' : 'ghost'}
                size="icon"
                onClick={on_toggle_analytics}
                className="h-7 w-7 rounded-none text-white"
                aria-label="Toggle Raster Calculator"
              >
                <Icon name="analytics" className="text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <span>Toggle Raster Calculator (Top Right View Panel)</span>
            </TooltipContent>
          </Tooltip>

          {/* Toggle Graticule Grid Lines */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={(show_graticule) ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => set_show_graticule(!show_graticule)}
                className="h-7 w-7 rounded-none text-white"
                aria-label="Toggle Graticule Grid"
              >
                <Icon name="grid_on" className="text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <span>Toggle Graticule Grid (Parallels & Meridians)</span>
            </TooltipContent>
          </Tooltip>

          {/* Reset Map View (Centre & Zoom) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handle_double_click}
                className="h-7 w-7 rounded-none text-white"
                aria-label="Reset View"
              >
                <Icon name="restart_alt" className="text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <span>Reset Map View (Centre & Zoom)</span>
            </TooltipContent>
          </Tooltip>

          {/* Toggle Fullscreen / UI Visibility */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={ui_visible ? 'ghost' : 'secondary'}
                size="icon"
                onClick={on_toggle_ui}
                className="h-7 w-7 rounded-none text-white cursor-pointer"
                aria-label={ui_visible ? 'Hide UI (Full Map View)' : 'Show UI'}
              >
                <Icon name={ui_visible ? 'visibility' : 'visibility_off'} className="text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <span>{ui_visible ? 'Hide UI (Full Map View)' : 'Show UI'}</span>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Map Display Settings Flyout Panel */}
        {flyout_open && (
          <div
            style={{
              top: `${UI_LAYOUT.margin}px`,
              right: `${UI_LAYOUT.settingsDrawerRight}px`,
              width: `${UI_LAYOUT.settingsDrawerWidth}px`,
            }}
            className="absolute z-35 bg-card/98 backdrop-blur-md border border-border rounded-none p-[var(--padding)] shadow-2xl text-[var(--body-font-size)] text-card-foreground animate-in fade-in-0 zoom-in-95 duration-100 font-sans space-y-[var(--padding)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <span className="text-[var(--body-font-size)] font-bold text-foreground flex items-center gap-1.5">
                <Icon name="settings" />
                <span>Map Display Settings</span>
              </span>
              <button
                type="button"
                onClick={() => set_flyout_open(false)}
                className="text-muted-foreground hover:text-foreground text-[var(--body-font-size)] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Projection Selection Section */}
            <div className="space-y-1.5">
              <span className="text-[var(--body-font-size)] font-bold text-foreground">Projection Mode</span>
              <div className="grid grid-cols-2 gap-1 bg-background/60 p-[var(--cell-padding)] rounded-none border border-border">
                {(['Mercator', 'Equirectangular', 'Globe', 'EqualEarth'] as ProjectionType[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set_projection(p)}
                    className={`px-2 py-1 rounded-none text-[var(--body-font-size)] transition-colors cursor-pointer text-center ${(projection === p)
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground font-light'
                      }`}
                  >
                    {(p === 'Equirectangular') ? 'Equirect.' : (p === 'EqualEarth') ? 'Equal Earth' : p}
                  </button>
                ))}
              </div>
            </div>

            {/* Basemap Selection Section */}
            <div className="space-y-1.5">
              <span className="text-[var(--body-font-size)] font-bold text-foreground">Basemap Layer</span>

              <div className="space-y-1 bg-background/60 p-[var(--cell-padding)] rounded-none border border-border">
                {MAP_CONFIG.basemapLayers.map((item: { id: string; label: string }) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => set_basemap(item.id)}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded-none text-[var(--body-font-size)] transition-colors cursor-pointer text-left ${(basemap === item.id)
                      ? 'bg-muted text-foreground font-bold'
                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground font-light'
                      }`}
                  >
                    <span>{item.label}</span>
                    {basemap === item.id && (
                      <span className="w-1.5 h-1.5 rounded-none bg-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </TooltipProvider>

      {/* Bottom Right Tray: Unified Mapmodes with Inline Settings */}
      {ui_visible && (
        <MapmodesTray
          activeLayerId={props.activeLayerId}
          activeVariableSelectors={props.activeVariableSelectors}
          allCountries={country_features}
          analyticsOpen={props.analyticsOpen}
          circleOverlayConfig={circle_overlay_config}
          countriesMode={Boolean(countries_mode)}
          countryStats={country_stats}
          heightmapConfig={heightmap_config}
          isCalculatingStats={is_calculating_stats}
          isLoadingLayers={props.isLoadingLayers}
          layers={props.dataLayers}
          mapModes={map_modes}
          onChangeVariableSelector={props.onChangeVariableSelector}
          onClearCountries={on_clear_countries || (() => { })}
          onReorderMapModes={on_reorder_map_modes}
          onSelectLayer={props.onSelectLayer}
          onToggleCountriesMode={on_toggle_countries_mode}
          onToggleCountry={on_toggle_country || (() => { })}
          onToggleMapMode={on_toggle_map_mode}
          selectedCountries={selected_countries || []}
          setCircleOverlayConfig={set_circle_overlay_config || (() => { })}
          setHeightmapConfig={set_heightmap_config || (() => { })}
          settingsOpen={flyout_open}
          userRole={props.userRole}
        />
      )}
    </div>
  )
}

export default MapViewer
