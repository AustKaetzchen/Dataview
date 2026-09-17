import React, { useState, useMemo, useCallback } from 'react'
import {
  MapModeItem,
  MapModeId,
  HeightmapConfig,
  CircleOverlayConfig,
  HistoricalBordersConfig,
  StadesterConfig,
} from '@framework/geopng/types.ts'
import { CountryFeature, CountryStats } from '@framework/geopng/polygon_binning.ts'
import { Icon } from '@ui/components/icon'
import { TooltipProvider } from '@ui/components/tooltip'
import { UserRole, isPublicBuild } from '@common'
import { useLocalisation } from '@localisation'
import { CountryModeSettings } from './mapmodes/country_mode_settings'
import {
  SpikeMapSettings,
  SPIKE_RESOLUTION_OPTIONS,
  formatSpikeResolution,
  strengthToSliderPos,
  sliderPosToStrength,
} from './mapmodes/spike_map_settings'
import { CircleOverlaySettings } from './mapmodes/circle_overlay_settings'
import { DatasetFolderNode } from './mapmodes/dataset_folder_node'
import { HistoricalBordersSettings } from './mapmodes/historical_borders_settings'
import { MapmodeTooltip } from './mapmodes/mapmode_tooltip'
import { ParsedDataLayer } from '@server/layer_parser'

export {
  SPIKE_RESOLUTION_OPTIONS,
  formatSpikeResolution,
  strengthToSliderPos,
  sliderPosToStrength,
}

export interface MapmodesTrayProps {
  activeLayerId?: string | null
  activeVariableSelectors?: Record<string, string | string[]>
  allCountries: CountryFeature[]
  analyticsOpen?: boolean
  bottomClearance?: number
  cameraTilt?: number
  circleOverlayConfig: CircleOverlayConfig
  countriesMode: boolean
  countryStats?: CountryStats | null
  heightmapConfig: HeightmapConfig
  historicalBordersConfig?: HistoricalBordersConfig
  isCalculatingStats?: boolean
  isLoadingLayers?: boolean
  isMobile?: boolean
  layers?: Record<string, ParsedDataLayer>
  mapModes: MapModeItem[]
  onChangeVariableSelector?: (arg0_key: string, arg1_option: string | string[]) => void
  onClearCountries: () => void
  onReorderMapModes: (newModes: MapModeItem[]) => void
  onSelectLayer?: (arg0_layer_id: string) => void
  onSetCameraTilt?: (tilt: number) => void
  onToggleCountriesMode?: (enabled: boolean) => void
  onToggleCountry: (country: CountryFeature) => void
  onToggleMapMode: (id: MapModeId) => void
  selectedCountries: CountryFeature[]
  setCircleOverlayConfig: React.Dispatch<React.SetStateAction<CircleOverlayConfig>>
  setHeightmapConfig: React.Dispatch<React.SetStateAction<HeightmapConfig>>
  setHistoricalBordersConfig?: React.Dispatch<React.SetStateAction<HistoricalBordersConfig>>
  setStadesterConfig?: React.Dispatch<React.SetStateAction<StadesterConfig>>
  settingsOpen?: boolean
  stadesterCityCount?: number
  stadesterConfig?: StadesterConfig
  userRole?: UserRole
}

/**
 * MapmodesTray interactive UI tray structured as a nested tree of mapmodes and overlays with a searchbar.
 *
 * @param {MapmodesTrayProps} arg0_props
 *
 * @returns {React.ReactElement}
 */
export let MapmodesTray: React.FC<MapmodesTrayProps> = React.memo(function (arg0_props) {
  //Convert from parameters
  let props = arg0_props
  let {
    activeLayerId: active_layer_id = null,
    activeVariableSelectors: active_variable_selectors = {},
    allCountries: all_countries,
    analyticsOpen: analytics_open = false,
    bottomClearance: bottom_clearance,
    cameraTilt: camera_tilt,
    circleOverlayConfig: circle_overlay_config,
    countriesMode: countries_mode,
    countryStats: country_stats,
    heightmapConfig: heightmap_config,
    historicalBordersConfig: historical_borders_config,
    isCalculatingStats: is_calculating_stats,
    isLoadingLayers: is_loading_layers = false,
    isMobile: is_mobile = false,
    layers = {},
    mapModes: map_modes,
    onChangeVariableSelector: on_change_variable_selector,
    onClearCountries: on_clear_countries,
    onReorderMapModes: on_reorder_map_modes,
    onSelectLayer: on_select_layer,
    onSetCameraTilt: on_set_camera_tilt,
    onToggleCountriesMode: on_toggle_countries_mode,
    onToggleCountry: on_toggle_country,
    onToggleMapMode: on_toggle_map_mode,
    selectedCountries: selected_countries,
    setCircleOverlayConfig: set_circle_overlay_config,
    setHeightmapConfig: set_heightmap_config,
    setHistoricalBordersConfig: set_historical_borders_config,
    setStadesterConfig: set_stadester_config,
    settingsOpen: settings_open = false,
    stadesterCityCount: stadester_city_count = 0,
    stadesterConfig: stadester_config,
    userRole: user_role = 'default',
  } = props

  //Declare local instance variables
  let active_layers_count: number
  let all_layer_entries: ParsedDataLayer[]
  let dataset_folders: Record<string, ParsedDataLayer[]>
  let expanded_nodes: Record<string, boolean>
  let filtered_layers: ParsedDataLayer[]
  let filtered_overlays: MapModeItem[]
  let format_string: (template: string, ...args: any[]) => string
  let handle_resize_left: (e: React.MouseEvent) => void
  let handle_resize_top: (e: React.MouseEvent) => void
  let handle_resize_top_left: (e: React.MouseEvent) => void
  let is_layer_accessible: (arg0_layer: ParsedDataLayer) => boolean
  let is_tray_collapsed: boolean
  let localisation: ReturnType<typeof useLocalisation>
  let max_height_style: string
  let search_query: string
  let set_expanded_nodes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  let set_is_tray_collapsed: React.Dispatch<React.SetStateAction<boolean>>
  let set_search_query: React.Dispatch<React.SetStateAction<string>>
  let set_tray_height: React.Dispatch<React.SetStateAction<number>>
  let set_tray_width: React.Dispatch<React.SetStateAction<number>>
  let t: ReturnType<typeof useLocalisation>['t']
  let toggle_node: (arg0_id: string) => void
  let tray_height: number
  let tray_width: number

    localisation = useLocalisation()
    format_string = localisation.formatString
    t = localisation.t
    ;[is_tray_collapsed, set_is_tray_collapsed] = useState<boolean>(false)
    ;[search_query, set_search_query] = useState<string>('')
    ;[expanded_nodes, set_expanded_nodes] = useState<Record<string, boolean>>({
      'dataset_Atlas (Historical Borders)': true,
      overlays: true,
    })
    ;[tray_width, set_tray_width] = useState<number>(() => {
      let saved = typeof localStorage !== 'undefined' ? localStorage.getItem('dataview_mapmodes_width') : null
      return saved ? parseInt(saved, 10) : 340
    })
    ;[tray_height, set_tray_height] = useState<number>(() => {
      let saved = typeof localStorage !== 'undefined' ? localStorage.getItem('dataview_mapmodes_height') : null
      return saved ? parseInt(saved, 10) : 520
    })

  handle_resize_left = function (e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    let start_w = tray_width
    let start_x = e.clientX

    let on_mouse_move = function (move_e: MouseEvent) {
      let delta_x = start_x - move_e.clientX
      let max_w = Math.min(800, window.innerWidth - 40)
      let next_w = Math.max(280, Math.min(max_w, start_w + delta_x))
      set_tray_width(next_w)
      if (typeof localStorage !== 'undefined')
        localStorage.setItem('dataview_mapmodes_width', String(next_w))
    }

    let on_mouse_up = function () {
      window.removeEventListener('mousemove', on_mouse_move)
      window.removeEventListener('mouseup', on_mouse_up)
    }

    window.addEventListener('mousemove', on_mouse_move)
    window.addEventListener('mouseup', on_mouse_up)
  }

  handle_resize_top = function (e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    let start_h = tray_height
    let start_y = e.clientY

    let on_mouse_move = function (move_e: MouseEvent) {
      let delta_y = start_y - move_e.clientY
      let max_h = Math.min(900, window.innerHeight - 60)
      let next_h = Math.max(260, Math.min(max_h, start_h + delta_y))
      set_tray_height(next_h)
      if (typeof localStorage !== 'undefined')
        localStorage.setItem('dataview_mapmodes_height', String(next_h))
    }

    let on_mouse_up = function () {
      window.removeEventListener('mousemove', on_mouse_move)
      window.removeEventListener('mouseup', on_mouse_up)
    }

    window.addEventListener('mousemove', on_mouse_move)
    window.addEventListener('mouseup', on_mouse_up)
  }

  handle_resize_top_left = function (e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    let start_h = tray_height
    let start_w = tray_width
    let start_x = e.clientX
    let start_y = e.clientY

    let on_mouse_move = function (move_e: MouseEvent) {
      let delta_x = start_x - move_e.clientX
      let delta_y = start_y - move_e.clientY
      let max_h = Math.min(900, window.innerHeight - 60)
      let max_w = Math.min(800, window.innerWidth - 40)
      let next_h = Math.max(260, Math.min(max_h, start_h + delta_y))
      let next_w = Math.max(280, Math.min(max_w, start_w + delta_x))
      set_tray_width(next_w)
      set_tray_height(next_h)
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('dataview_mapmodes_width', String(next_w))
        localStorage.setItem('dataview_mapmodes_height', String(next_h))
      }
    }

    let on_mouse_up = function () {
      window.removeEventListener('mousemove', on_mouse_move)
      window.removeEventListener('mouseup', on_mouse_up)
    }

    window.addEventListener('mousemove', on_mouse_move)
    window.addEventListener('mouseup', on_mouse_up)
  }

  toggle_node = function (arg0_id: string) {
    let id = arg0_id
    set_expanded_nodes((arg0_prev) => ({
      ...arg0_prev,
      [id]: !arg0_prev[id],
    }))
  }

  is_layer_accessible = useCallback(
    function (arg0_layer: ParsedDataLayer) {
      let layer = arg0_layer
      if (user_role === 'developer' && !isPublicBuild())
        return true
      if (user_role === 'privileged' && !isPublicBuild())
        return !layer.permissions?.includes('developer')
      return layer.permissions?.includes('default') || !layer.permissions || layer.permissions.length === 0
    },
    [user_role]
  )

  all_layer_entries = useMemo(() => {
    return Object.values(layers)
  }, [layers])

  max_height_style = useMemo(() => {
    if (analytics_open)
      return 'calc(100vh - 376px - 24px)'
    if (settings_open)
      return 'calc(100vh - 300px - 24px)'
    return 'calc(100vh - 200px - 24px)'
  }, [analytics_open, settings_open])

  //Filter layers by search
  filtered_layers = useMemo(() => {
    let q = search_query.toLowerCase().trim()
    if (!q)
      return all_layer_entries

    return all_layer_entries.filter((arg0_layer) => {
      let matches_category = arg0_layer.category?.toLowerCase().includes(q)
      let matches_id = arg0_layer.id.toLowerCase().includes(q)
      let matches_name = arg0_layer.name.toLowerCase().includes(q)
      let matches_sub = arg0_layer.sub_layers?.some(
        (arg0_sub: any) => arg0_sub.name.toLowerCase().includes(q) || arg0_sub.id.toLowerCase().includes(q)
      )
      let matches_selectors = false
      if (arg0_layer.variable_selectors) {
        let sel_keys = Object.keys(arg0_layer.variable_selectors)
        for (let i = 0; i < sel_keys.length; i++) {
          let sel = arg0_layer.variable_selectors[sel_keys[i]]
          if (sel.name?.toLowerCase().includes(q) || sel_keys[i].toLowerCase().includes(q)) {
            matches_selectors = true
            break
          }
          let opt_keys = Object.keys(sel.options)
          for (let x = 0; x < opt_keys.length; x++) {
            let opt = sel.options[opt_keys[x]]
            if (opt.name?.toLowerCase().includes(q) || opt_keys[x].toLowerCase().includes(q)) {
              matches_selectors = true
              break
            }
          }
          if (matches_selectors)
            break
        }
      }
      return matches_name || matches_id || matches_sub || matches_category || matches_selectors
    })
  }, [all_layer_entries, search_query])

  //Group filtered layers by dataset folder name
  dataset_folders = useMemo(() => {
    let folders: Record<string, ParsedDataLayer[]> = {}
    for (let i = 0; i < filtered_layers.length; i++) {
      let layer = filtered_layers[i]
      let group_name = layer.category || 'Other Layers'
      if (!folders[group_name])
        folders[group_name] = []
      folders[group_name].push(layer)
    }
    return folders
  }, [filtered_layers])

  //Filter overlays by search (historical_borders is already integrated into Atlas Historical Borders folder)
  filtered_overlays = useMemo(() => {
    let q = search_query.toLowerCase().trim()
    let list = map_modes.filter((arg0_m) => arg0_m.id !== 'default' && arg0_m.id !== 'historical_borders')
    if (!q)
      return list
    return list.filter((arg0_m) => arg0_m.label.toLowerCase().includes(q))
  }, [map_modes, search_query])

  //Compute active layers and overlays count
  active_layers_count = useMemo(() => {
    let count = 0

    if (active_layer_id)
      count++

    if (historical_borders_config?.enabled)
      count++

    if (stadester_config?.enabled)
      count++

    for (let i = 0; i < map_modes.length; i++) {
      let mode = map_modes[i]
      if (mode.id !== 'default' && mode.id !== 'historical_borders' && mode.active)
        count++
    }

    return count
  }, [active_layer_id, historical_borders_config?.enabled, map_modes, stadester_config?.enabled])

  //Return statement
  if (is_tray_collapsed) {
    return (
      <TooltipProvider delayDuration={150}>
        <div
          id="dataview-mapmodes-tray"
          style={{
            bottom: (bottom_clearance !== undefined) ? `${bottom_clearance}px` : '12px',
            maxWidth: is_mobile ? 'calc(100vw - 24px)' : 'calc(100vw - 40px)',
            right: '12px',
            width: is_mobile ? 'min(340px, calc(100vw - 24px))' : `${tray_width}px`,
          }}
          className="absolute z-20"
        >
          <button
            type="button"
            onClick={() => set_is_tray_collapsed(false)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-card/95 border border-border hover:border-primary text-card-foreground shadow-2xl rounded-none cursor-pointer transition-colors select-none font-sans group"
            title={t.mapmodes.expand}
          >
            <div className="flex items-center gap-2">
              <Icon name="layers" className="text-primary text-sm group-hover:scale-105 transition-transform" />
              <span className="font-bold text-foreground text-xs uppercase tracking-wider">
                {t.mapmodes.title}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/40 font-mono font-medium">
                {format_string(t.mapmodes.activeCount, active_layers_count)}
              </span>
              <Icon name="expand_less" className="text-sm text-muted-foreground group-hover:text-foreground transition-colors ml-0.5" />
            </div>
          </button>
        </div>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div
        id="dataview-mapmodes-tray"
        style={{
          bottom: (bottom_clearance !== undefined) ? `${bottom_clearance}px` : '12px',
          height: `${tray_height}px`,
          maxHeight: is_mobile ? '50vh' : (bottom_clearance !== undefined ? `calc(100vh - ${bottom_clearance + 28}px)` : 'calc(100vh - 40px)'),
          maxWidth: is_mobile ? 'calc(100vw - 24px)' : 'calc(100vw - 40px)',
          right: '12px',
          width: is_mobile ? 'min(340px, calc(100vw - 24px))' : `${tray_width}px`,
        }}
        className="absolute z-20 flex flex-col bg-card/95 backdrop-blur-md border border-border shadow-2xl p-2.5 space-y-2 text-[var(--body-font-size)] select-none font-sans overflow-hidden transition-all duration-150 ease-out"
      >
        {/* Resize Handles (Active when tray is not collapsed and not mobile) */}
        {!is_mobile && (
          <>
            {/* Left Border Drag Handle */}
            <div
              onMouseDown={handle_resize_left}
              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-primary/40 active:bg-primary z-30 transition-colors"
              title="Drag left edge to resize width"
            />
            {/* Top Border Drag Handle */}
            <div
              onMouseDown={handle_resize_top}
              className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-primary/40 active:bg-primary z-30 transition-colors"
              title="Drag top edge to resize height"
            />
            {/* Top-Left Corner Drag Handle */}
            <div
              onMouseDown={handle_resize_top_left}
              className="absolute top-0 left-0 w-3.5 h-3.5 cursor-nwse-resize hover:bg-primary active:bg-primary z-40 transition-colors flex items-center justify-center group"
              title="Drag corner to resize width and height"
            >
              <div className="w-1.5 h-1.5 border-t-2 border-l-2 border-muted-foreground group-hover:border-primary-foreground" />
            </div>
          </>
        )}
        {/* Tray Header */}
        <div className="flex items-center justify-between border-b border-border pb-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <Icon name="layers" className="text-primary text-sm" />
            <span className="font-bold text-foreground text-xs uppercase tracking-wider">
              {t.mapmodes.title}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/40 font-mono font-medium">
              {format_string(t.mapmodes.activeCount, active_layers_count)}
            </span>
            <button
              type="button"
              onClick={() => set_is_tray_collapsed(true)}
              className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              title={t.mapmodes.collapse}
            >
              <Icon name={is_mobile ? 'close' : 'expand_more'} className="text-sm" />
            </button>
          </div>
        </div>

        {!is_tray_collapsed && (
          <div className="flex-1 flex flex-col min-h-0 space-y-2">
            {/* Unified Searchbar */}
            <div className="relative shrink-0">
              <Icon
                name="search"
                className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none"
              />
              <input
                type="text"
                placeholder={t.mapmodes.searchPlaceholder}
                value={search_query}
                onChange={(arg0_e) => set_search_query(arg0_e.target.value)}
                className="w-full h-7 pl-7 pr-6 bg-background border border-input rounded-none text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {search_query && (
                <button
                  type="button"
                  onClick={() => set_search_query('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <Icon name="close" className="text-xs" />
                </button>
              )}
            </div>

            {/* Unified Flat Tree List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {is_loading_layers && (
                <div className="p-2 text-center text-xs text-muted-foreground animate-pulse">
                  {t.mapmodes.loadingRaster}
                </div>
              )}
              {Object.keys(dataset_folders).length === 0 && !is_loading_layers && filtered_overlays.length === 0 && (
                <div className="p-2 text-center text-xs text-muted-foreground">
                  {t.mapmodes.noResults}
                </div>
              )}

              {/* Data Layer Dataset Folders (including Atlas Historical Borders) */}
              {Object.entries(dataset_folders).map(([arg0_folder_name, arg0_folder_layers]) => (
                <DatasetFolderNode
                  key={`dataset_${arg0_folder_name}`}
                  activeLayerId={active_layer_id}
                  activeVariableSelectors={active_variable_selectors}
                  expandedNodes={expanded_nodes}
                  folderLayers={arg0_folder_layers}
                  folderName={arg0_folder_name}
                  isLayerAccessible={is_layer_accessible}
                  historicalBordersConfig={historical_borders_config}
                  onChangeVariableSelector={on_change_variable_selector}
                  onSelectLayer={on_select_layer}
                  searchQuery={search_query}
                  setHistoricalBordersConfig={set_historical_borders_config}
                  setStadesterConfig={set_stadester_config}
                  stadesterCityCount={stadester_city_count}
                  stadesterConfig={stadester_config}
                  toggleNode={toggle_node}
                />
              ))}

              {/* Analytical Tools (Squished directly into the main list without historical borders redundancy) */}
              {filtered_overlays.length > 0 && (
                <div className="border border-border/80 bg-card/40">
                  <div
                    onClick={() => toggle_node('overlays')}
                    className="flex items-center justify-between p-1.5 bg-muted/40 hover:bg-muted/70 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon name="build" className="text-primary text-xs" />
                      <span className="font-bold text-xs text-foreground uppercase tracking-wide">
                        {t.mapmodes.analyticalTools}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {filtered_overlays.length}
                      </span>
                      <Icon
                        name={expanded_nodes.overlays ? 'expand_less' : 'expand_more'}
                        className="text-xs text-muted-foreground"
                      />
                    </div>
                  </div>

                  {expanded_nodes.overlays && (
                    <div className="p-1 space-y-1.5">
                      {filtered_overlays.map((arg0_mode) => {
                        let is_active = arg0_mode.active

                        return (
                          <div key={arg0_mode.id} className="space-y-1">
                            <MapmodeTooltip name={arg0_mode.label}>
                              <button
                                type="button"
                                onClick={() => on_toggle_map_mode(arg0_mode.id)}
                                className={`w-full flex items-center justify-between px-2 py-1 text-left cursor-pointer border transition-colors ${is_active
                                    ? 'bg-primary/20 text-primary border-primary font-bold shadow-xs'
                                    : 'hover:bg-muted/40 text-foreground border-transparent'
                                  }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`w-3.5 h-3.5 rounded-none border flex items-center justify-center shrink-0 ${is_active ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/60'
                                    }`}>
                                    {is_active && <Icon name="check" className="text-[10px]" />}
                                  </span>
                                  <span className="text-xs truncate">{arg0_mode.label}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground uppercase font-mono">
                                  {is_active ? t.mapmodes.on : t.mapmodes.off}
                                </span>
                              </button>
                            </MapmodeTooltip>

                            {/* Nested Overlay Settings */}
                            {is_active && arg0_mode.id === 'country_analysis' && (
                              <div className="mt-0.5 p-1 border-t border-border/60 bg-card/40 space-y-1 text-xs">
                                <CountryModeSettings
                                  allCountries={all_countries}
                                  countriesMode={countries_mode}
                                  countryStats={country_stats}
                                  isCalculatingStats={is_calculating_stats}
                                  onClearCountries={on_clear_countries}
                                  onToggleCountriesMode={on_toggle_countries_mode}
                                  onToggleCountry={on_toggle_country}
                                  selectedCountries={selected_countries}
                                />
                              </div>
                            )}

                            {is_active && arg0_mode.id === 'spike_map' && (
                              <div className="mt-0.5 p-1 border-t border-border/60 bg-card/40 space-y-1 text-xs">
                                <SpikeMapSettings
                                  cameraTilt={camera_tilt}
                                  heightmapConfig={heightmap_config}
                                  onSetCameraTilt={on_set_camera_tilt}
                                  setHeightmapConfig={set_heightmap_config}
                                />
                              </div>
                            )}

                            {is_active && arg0_mode.id === 'circle_sizing' && (
                              <div className="mt-0.5 p-1 border-t border-border/60 bg-card/40 space-y-1 text-xs">
                                <CircleOverlaySettings
                                  circleOverlayConfig={circle_overlay_config}
                                  setCircleOverlayConfig={set_circle_overlay_config}
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
})

export default MapmodesTray
