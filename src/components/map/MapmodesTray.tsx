import React, { useState, useMemo, useCallback } from 'react'
import {
  MapModeItem,
  MapModeId,
  HeightmapConfig,
  CircleOverlayConfig,
} from '@/lib/geopng/types'
import { CountryFeature, CountryStats } from '@/lib/geopng/polygonBinning'
import { Icon } from '@/components/ui/icon'
import { TooltipProvider } from '@/components/ui/tooltip'
import { LOCALISATION_CONFIG, UserRole } from '@config'
import { CountryModeSettings } from './mapmodes/CountryModeSettings'
import {
  SpikeMapSettings,
  SPIKE_RESOLUTION_OPTIONS,
  formatSpikeResolution,
  strengthToSliderPos,
  sliderPosToStrength,
} from './mapmodes/SpikeMapSettings'
import { CircleOverlaySettings } from './mapmodes/CircleOverlaySettings'
import { ParsedDataLayer } from '@/server/layerParser'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'

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
  cameraTilt?: number
  circleOverlayConfig: CircleOverlayConfig
  countriesMode: boolean
  countryStats?: CountryStats | null
  heightmapConfig: HeightmapConfig
  isCalculatingStats?: boolean
  isLoadingLayers?: boolean
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
  settingsOpen?: boolean
  userRole?: UserRole
}

/**
 * MapmodesTray interactive UI tray structured as a nested tree of mapmodes and overlays with a searchbar.
 *
 * @param {MapmodesTrayProps} arg0_props
 *
 * @returns {React.ReactElement}
 */
export const MapmodesTray: React.FC<MapmodesTrayProps> = function (arg0_props) {
  //Convert from parameters
  let props = arg0_props
  let {
    activeLayerId: active_layer_id = null,
    activeVariableSelectors: active_variable_selectors = {},
    allCountries: all_countries,
    analyticsOpen: analytics_open = false,
    cameraTilt: camera_tilt,
    circleOverlayConfig: circle_overlay_config,
    countriesMode: countries_mode,
    countryStats: country_stats,
    heightmapConfig: heightmap_config,
    isCalculatingStats: is_calculating_stats,
    isLoadingLayers: is_loading_layers = false,
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
    settingsOpen: settings_open = false,
    userRole: user_role = 'developer',
  } = props

  //Declare local instance variables
  let all_layer_entries: ParsedDataLayer[]
  let dataset_folders: Record<string, ParsedDataLayer[]>
  let expanded_nodes: Record<string, boolean>
  let filtered_layers: ParsedDataLayer[]
  let filtered_overlays: MapModeItem[]
  let handle_resize_left: (e: React.MouseEvent) => void
  let handle_resize_top: (e: React.MouseEvent) => void
  let handle_resize_top_left: (e: React.MouseEvent) => void
  let is_layer_accessible: (arg0_layer: ParsedDataLayer) => boolean
  let is_tray_collapsed: boolean
  let max_height_style: string
  let render_data_layer_node: (arg0_layer: ParsedDataLayer, arg1_depth?: number) => React.ReactNode
  let render_dataset_folder_node: (arg0_folder_name: string, arg1_folder_layers: ParsedDataLayer[]) => React.ReactNode
  let render_variable_selectors: (arg0_layer: ParsedDataLayer) => React.ReactNode
  let search_query: string
  let set_expanded_nodes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  let set_is_tray_collapsed: React.Dispatch<React.SetStateAction<boolean>>
  let set_search_query: React.Dispatch<React.SetStateAction<string>>
  let set_tray_height: React.Dispatch<React.SetStateAction<number>>
  let set_tray_width: React.Dispatch<React.SetStateAction<number>>
  let toggle_node: (arg0_id: string) => void
  let tray_height: number
  let tray_width: number

  //Function body
  ;[is_tray_collapsed, set_is_tray_collapsed] = useState<boolean>(false)
  ;[search_query, set_search_query] = useState<string>('')
  ;[expanded_nodes, set_expanded_nodes] = useState<Record<string, boolean>>({
    data_layers: true,
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
      if (user_role === 'developer')
        return true
      if (user_role === 'privileged')
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
        (arg0_sub) => arg0_sub.name.toLowerCase().includes(q) || arg0_sub.id.toLowerCase().includes(q)
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

  //Filter overlays by search
  filtered_overlays = useMemo(() => {
    let q = search_query.toLowerCase().trim()
    let list = map_modes.filter((arg0_m) => arg0_m.id !== 'default')
    if (!q)
      return list
    return list.filter((arg0_m) => arg0_m.label.toLowerCase().includes(q))
  }, [map_modes, search_query])

  //Render variable selector dropdowns directly within the active layer node
  render_variable_selectors = function (arg0_layer: ParsedDataLayer) {
    let layer = arg0_layer
    if (!layer.variable_selectors || Object.keys(layer.variable_selectors).length === 0)
      return null

    let selector_keys = Object.keys(layer.variable_selectors)

    return (
      <div className="mt-1 p-1.5 border-t border-border/60 bg-muted/20 space-y-2 text-[11px]">
        {selector_keys.map((arg0_key) => {
          let sel = layer.variable_selectors![arg0_key]
          let opts = Object.entries(sel.options)
          if (opts.length > 0 && opts.every(([arg0_k]) => !Number.isNaN(parseInt(arg0_k, 10)))) {
            opts.sort((arg0_a, arg0_b) => parseInt(arg0_a[0], 10) - parseInt(arg0_b[0], 10))
          }
          let raw_val = active_variable_selectors[arg0_key]
          let selected_vals: string[] = []
          if (Array.isArray(raw_val)) {
            selected_vals = raw_val
          } else if (typeof raw_val === 'string' && raw_val.length > 0) {
            selected_vals = [raw_val]
          } else if (opts[0]?.[0]) {
            selected_vals = [opts[0][0]]
          }

          return (
            <div key={arg0_key} className="space-y-1">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                <span>{sel.name || arg0_key}</span>
                <div className="flex items-center gap-1 font-mono">
                  <button
                    type="button"
                    onClick={() => {
                      let all_keys = opts.map(([k]) => k)
                      if (on_change_variable_selector)
                        on_change_variable_selector(arg0_key, all_keys)
                    }}
                    className="text-[9px] text-primary hover:underline cursor-pointer"
                  >
                    All
                  </button>
                  <span className="text-muted-foreground/40">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (on_change_variable_selector)
                        on_change_variable_selector(arg0_key, opts[0]?.[0] ? [opts[0][0]] : [])
                    }}
                    className="text-[9px] text-muted-foreground hover:underline cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {opts.map(([arg0_opt_key, arg0_opt]) => {
                  let is_selected = selected_vals.includes(arg0_opt_key)
                  return (
                    <button
                      key={arg0_opt_key}
                      type="button"
                      onClick={() => {
                        let next_vals: string[]
                        if (is_selected) {
                          next_vals = selected_vals.filter((v) => v !== arg0_opt_key)
                          if (next_vals.length === 0)
                            next_vals = [arg0_opt_key]
                        } else {
                          next_vals = [...selected_vals, arg0_opt_key]
                        }
                        if (on_change_variable_selector)
                          on_change_variable_selector(arg0_key, next_vals)
                      }}
                      className={`px-2 py-0.5 border text-left text-[10px] flex items-center gap-1.5 cursor-pointer transition-colors ${
                        is_selected
                          ? 'bg-primary/20 border-primary text-primary font-bold'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span
                        className={`w-3 h-3 border rounded-none flex items-center justify-center shrink-0 ${
                          is_selected
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-muted-foreground/60 bg-background/60'
                        }`}
                      >
                        {is_selected && <Icon name="check" className="text-[9px] text-white stroke-[3]" />}
                      </span>
                      <span>{arg0_opt.name || arg0_opt_key}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  //Recursive or leaf renderer for data layers in tree
  render_data_layer_node = function (arg0_layer: ParsedDataLayer, arg1_depth?: number) {
    let depth = arg1_depth || 0
    let layer = arg0_layer
    let is_active = active_layer_id === layer.id
    let is_accessible = is_layer_accessible(layer)
    let has_sub_layers = Boolean(layer.sub_layers && layer.sub_layers.length > 0)
    let has_variable_selectors = Boolean(layer.variable_selectors && Object.keys(layer.variable_selectors).length > 0)
    let is_searching = Boolean(search_query.trim())
    let is_node_expanded = is_searching || (expanded_nodes[layer.id] ?? true)

    return (
      <div key={layer.id} className="space-y-1" style={{ paddingLeft: `${depth*12}px` }}>
        {has_sub_layers ? (
          <div>
            <div
              className={`flex items-center justify-between px-2 py-1 cursor-pointer border border-border/60 transition-colors ${
                is_active ? 'bg-primary/20 border-primary text-primary font-bold shadow-xs' : 'bg-muted/30 hover:bg-muted/60'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={(arg0_e) => {
                    arg0_e.stopPropagation()
                    if (on_select_layer)
                      on_select_layer(layer.id)
                    if (!is_node_expanded)
                      toggle_node(layer.id)
                  }}
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                    is_active ? 'border-primary bg-primary' : 'border-muted-foreground/60 hover:border-primary'
                  }`}
                  title={`Select ${layer.name}`}
                >
                  {is_active && <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
                </button>
                <div
                  onClick={() => {
                    if (on_select_layer)
                      on_select_layer(layer.id)
                    if (!is_node_expanded)
                      toggle_node(layer.id)
                  }}
                  className="flex items-center gap-1.5 min-w-0 flex-1"
                >
                  <Icon name={is_node_expanded ? 'folder_open' : 'folder'} className="text-primary text-xs shrink-0" />
                  <span className="text-xs font-bold text-foreground truncate">{layer.name}</span>
                </div>
              </div>
              <div
                onClick={(arg0_e) => {
                  arg0_e.stopPropagation()
                  toggle_node(layer.id)
                }}
                className="flex items-center shrink-0 p-0.5"
              >
                <Icon
                  name={is_node_expanded ? 'expand_less' : 'expand_more'}
                  className="text-xs text-muted-foreground shrink-0"
                />
              </div>
            </div>

            {is_node_expanded && (
              <div className="mt-1 space-y-1 border-l-2 border-border/40 pl-1.5 ml-2">
                {/* Parent layer entry itself if it has an individual raster */}
                {layer.id !== 'lfpr' && (
                  <button
                    type="button"
                    disabled={!is_accessible}
                    onClick={() => on_select_layer && on_select_layer(layer.id)}
                    className={`w-full flex items-center justify-between px-2 py-1 text-left cursor-pointer border transition-colors ${
                      is_active
                        ? 'bg-primary/20 text-primary border-primary font-bold shadow-xs'
                        : 'hover:bg-muted/40 text-foreground border-transparent'
                    } ${!is_accessible ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                        is_active ? 'border-primary bg-primary' : 'border-muted-foreground/60'
                      }`}>
                        {is_active && <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
                      </span>
                      <span className="text-xs truncate">
                        {layer.name.endsWith('(Total)') ? layer.name : `${layer.name} (Total)`}
                      </span>
                    </div>
                    {layer.unit && (
                      <span
                        className="text-[10px] text-muted-foreground font-mono truncate max-w-[110px] shrink ml-1"
                        title={layer.unit}
                      >
                        {layer.unit}
                      </span>
                    )}
                  </button>
                )}

                {/* Child sub-layers */}
                {layer.sub_layers!.map((arg0_sub) => render_data_layer_node(arg0_sub, depth + 1))}
              </div>
            )}
          </div>
        ) : has_variable_selectors ? (
          <div>
            {/* Indicator with variable_selectors shows up as an expandable layer row */}
            <div
              className={`flex items-center justify-between px-2 py-1 cursor-pointer border transition-colors ${
                is_active
                  ? 'bg-primary/20 border-primary text-primary font-bold shadow-xs'
                  : 'bg-muted/30 hover:bg-muted/60 border-border/60 text-foreground'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={(arg0_e) => {
                    arg0_e.stopPropagation()
                    if (on_select_layer)
                      on_select_layer(layer.id)
                    if (!is_node_expanded)
                      toggle_node(layer.id)
                  }}
                  className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                    is_active ? 'border-primary bg-primary' : 'border-muted-foreground/60 hover:border-primary'
                  }`}
                  title={`Select ${layer.name}`}
                >
                  {is_active && <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
                </button>
                <div
                  onClick={() => {
                    if (on_select_layer)
                      on_select_layer(layer.id)
                    if (!is_node_expanded)
                      toggle_node(layer.id)
                  }}
                  className="flex items-center gap-1.5 min-w-0 flex-1"
                >
                  <Icon
                    name={is_node_expanded ? 'folder_open' : 'folder'}
                    className="text-primary text-xs shrink-0"
                  />
                  <span className="text-xs font-bold truncate">{layer.name}</span>
                </div>
              </div>
              <div
                onClick={(arg0_e) => {
                  arg0_e.stopPropagation()
                  toggle_node(layer.id)
                }}
                className="flex items-center gap-1 shrink-0 ml-1 cursor-pointer p-0.5"
              >
                {layer.unit && (
                  <span
                    className="text-[10px] text-muted-foreground font-mono truncate max-w-[110px] shrink ml-1"
                    title={layer.unit}
                  >
                    {layer.unit}
                  </span>
                )}
                <span className="text-[9px] px-1 py-0.2 bg-muted text-muted-foreground font-mono">
                  {Object.keys(layer.variable_selectors!).length} vars
                </span>
                <Icon
                  name={is_node_expanded ? 'expand_less' : 'expand_more'}
                  className="text-xs text-muted-foreground shrink-0"
                />
              </div>
            </div>

            {is_node_expanded && (
              <div className="mt-1 space-y-1.5 border-l-2 border-primary/40 pl-1.5 ml-2">
                {/* Separate box for each variable */}
                {Object.entries(layer.variable_selectors!).map(([arg0_var_key, arg0_sel]) => {
                  let var_node_id = `${layer.id}_var_${arg0_var_key}`
                  let is_var_open = is_searching || (expanded_nodes[var_node_id] ?? true)
                  let opts = Object.entries(arg0_sel.options)
                  if (opts.length > 0 && opts.every(([arg0_k]) => !Number.isNaN(parseInt(arg0_k, 10)))) {
                    opts.sort((arg0_a, arg0_b) => parseInt(arg0_a[0], 10) - parseInt(arg0_b[0], 10))
                  }
                  let raw_val = active_variable_selectors[arg0_var_key]
                  let selected_vals: string[] = []
                  if (Array.isArray(raw_val)) {
                    selected_vals = raw_val
                  } else if (typeof raw_val === 'string' && raw_val.length > 0) {
                    selected_vals = [raw_val]
                  } else if (opts[0]?.[0]) {
                    selected_vals = [opts[0][0]]
                  }

                  return (
                    <div key={arg0_var_key} className="border border-border/70 bg-muted/20">
                      {/* Box header for variable */}
                      <div
                        onClick={() => toggle_node(var_node_id)}
                        className="flex items-center justify-between px-2 py-1 bg-muted/40 hover:bg-muted/60 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Icon name="tune" className="text-primary text-[10px] shrink-0" />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground truncate">
                            {arg0_sel.name || arg0_var_key}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(arg0_e) => {
                              arg0_e.stopPropagation()
                              if (!is_active && on_select_layer)
                                on_select_layer(layer.id)
                              let all_keys = opts.map(([k]) => k)
                              if (on_change_variable_selector)
                                on_change_variable_selector(arg0_var_key, all_keys)
                            }}
                            className="text-[9px] text-primary hover:underline font-mono cursor-pointer"
                          >
                            All
                          </button>
                          <span className="text-[9px] text-muted-foreground/40">•</span>
                          <button
                            type="button"
                            onClick={(arg0_e) => {
                              arg0_e.stopPropagation()
                              if (!is_active && on_select_layer)
                                on_select_layer(layer.id)
                              if (on_change_variable_selector)
                                on_change_variable_selector(arg0_var_key, opts[0]?.[0] ? [opts[0][0]] : [])
                            }}
                            className="text-[9px] text-muted-foreground hover:underline font-mono cursor-pointer"
                          >
                            Reset
                          </button>
                          <span className="text-[9px] px-1 py-0.2 bg-muted text-muted-foreground font-mono ml-0.5">
                            {selected_vals.length}/{opts.length}
                          </span>
                          <Icon
                            name={is_var_open ? 'expand_less' : 'expand_more'}
                            className="text-[10px] text-muted-foreground"
                          />
                        </div>
                      </div>

                      {/* Box content: options as selectable checkboxes */}
                      {is_var_open && (
                        <div className="p-1 max-h-48 overflow-y-auto space-y-0.5 bg-card/30">
                          {opts.map(([arg0_opt_key, arg0_opt]) => {
                            let is_opt_selected = is_active && selected_vals.includes(arg0_opt_key)

                            return (
                              <button
                                key={arg0_opt_key}
                                type="button"
                                onClick={() => {
                                  if (!is_active && on_select_layer)
                                    on_select_layer(layer.id)
                                  let next_vals: string[]
                                  if (selected_vals.includes(arg0_opt_key)) {
                                    next_vals = selected_vals.filter((arg0_v) => arg0_v !== arg0_opt_key)
                                    if (next_vals.length === 0)
                                      next_vals = [arg0_opt_key]
                                  } else {
                                    next_vals = [...selected_vals, arg0_opt_key]
                                  }
                                  if (on_change_variable_selector)
                                    on_change_variable_selector(arg0_var_key, next_vals)
                                }}
                                className={`w-full flex items-center justify-between px-2 py-1 text-left cursor-pointer border transition-colors text-[11px] ${
                                  is_opt_selected
                                    ? 'bg-primary/20 text-primary border-primary font-bold shadow-xs'
                                    : 'hover:bg-muted/50 text-foreground border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className={`w-3.5 h-3.5 border rounded-none flex items-center justify-center shrink-0 transition-colors ${
                                      is_opt_selected
                                        ? 'bg-primary border-primary text-primary-foreground'
                                        : 'border-muted-foreground/60 bg-background/60'
                                    }`}
                                  >
                                    {is_opt_selected && (
                                      <Icon name="check" className="text-[9px] text-white stroke-[3]" />
                                    )}
                                  </span>
                                  <span className="truncate">{arg0_opt.name || arg0_opt_key}</span>
                                </div>
                                {is_opt_selected && (
                                  <span className="text-[9px] text-primary font-mono shrink-0">selected</span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            <button
              type="button"
              disabled={!is_accessible}
              onClick={() => on_select_layer && on_select_layer(layer.id)}
              className={`w-full flex items-center justify-between px-2 py-1 text-left cursor-pointer border transition-colors ${
                is_active
                  ? 'bg-primary/20 text-primary border-primary font-bold shadow-xs'
                  : 'hover:bg-muted/40 text-foreground border-transparent'
              } ${!is_accessible ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${
                  is_active ? 'border-primary bg-primary' : 'border-muted-foreground/60'
                }`}>
                  {is_active && <span className="w-1 h-1 rounded-full bg-primary-foreground" />}
                </span>
                <span className="text-xs truncate">{layer.name}</span>
              </div>
              {layer.unit && (
                <span
                  className="text-[10px] text-muted-foreground font-mono truncate max-w-[110px] shrink ml-1"
                  title={layer.unit}
                >
                  {layer.unit}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    )
  }

  render_dataset_folder_node = function (arg0_folder_name: string, arg1_folder_layers: ParsedDataLayer[]) {
    let folder_name = arg0_folder_name
    let folder_layers = arg1_folder_layers
    let node_id = `dataset_${folder_name}`
    let is_searching = Boolean(search_query.trim())
    let is_open = is_searching || (expanded_nodes[node_id] !== undefined ? expanded_nodes[node_id] : true)

    return (
      <div key={node_id} className="border border-border/60 bg-muted/10 mb-1">
        <div
          onClick={() => toggle_node(node_id)}
          className="flex items-center justify-between px-2 py-1 bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors select-none"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Icon
              name={is_open ? 'folder_open' : 'folder'}
              className="text-primary text-[11px] shrink-0"
            />
            <span className="font-semibold text-[11px] text-foreground truncate">
              {folder_name}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            <span className="text-[9px] text-muted-foreground font-mono">
              {folder_layers.length}
            </span>
            <Icon
              name={is_open ? 'expand_less' : 'expand_more'}
              className="text-[11px] text-muted-foreground"
            />
          </div>
        </div>

        {is_open && (
          <div className="p-1 space-y-1 bg-card/20">
            {folder_layers.map((arg0_l) => render_data_layer_node(arg0_l, 1))}
          </div>
        )}
      </div>
    )
  }

  //Return statement
  return (
    <TooltipProvider delayDuration={150}>
      <div
        id="dataview-mapmodes-tray"
        style={{
          bottom: '12px',
          height: is_tray_collapsed ? 'auto' : `${tray_height}px`,
          maxHeight: is_tray_collapsed ? 'auto' : 'calc(100vh - 40px)',
          maxWidth: 'calc(100vw - 40px)',
          right: '12px',
          width: `${tray_width}px`,
        }}
        className="absolute z-20 flex flex-col bg-card/95 backdrop-blur-md border border-border shadow-2xl p-2.5 space-y-2 text-[var(--body-font-size)] select-none font-sans overflow-hidden"
      >
        {/* Resize Handles (Active when tray is not collapsed) */}
        {!is_tray_collapsed && (
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
              {LOCALISATION_CONFIG.mapmodes.title}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/40 font-mono font-medium">
              {filtered_layers.length} Layers
            </span>
            <button
              type="button"
              onClick={() => set_is_tray_collapsed((arg0_prev) => !arg0_prev)}
              className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              title={is_tray_collapsed ? 'Expand Mapmodes Tray' : 'Collapse Mapmodes Tray'}
            >
              <Icon name={is_tray_collapsed ? 'expand_less' : 'expand_more'} className="text-sm" />
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
                placeholder="Search mapmodes & layers..."
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

            {/* Nested Tree List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {/* Branch 1: Data Layers (Base Mapmodes) */}
              <div className="border border-border/80 bg-card/40">
                <div
                  onClick={() => toggle_node('data_layers')}
                  className="flex items-center justify-between p-1.5 bg-muted/40 hover:bg-muted/70 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <Icon name="folder_open" className="text-primary text-xs" />
                    <span className="font-bold text-xs text-foreground uppercase tracking-wide">
                      Data Layers
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {filtered_layers.length}
                    </span>
                    <Icon
                      name={expanded_nodes.data_layers ? 'expand_less' : 'expand_more'}
                      className="text-xs text-muted-foreground"
                    />
                  </div>
                </div>

                {expanded_nodes.data_layers && (
                  <div className="p-1 space-y-1">
                    {is_loading_layers && (
                      <div className="p-2 text-center text-xs text-muted-foreground animate-pulse">
                        Loading raster layers...
                      </div>
                    )}
                    {Object.keys(dataset_folders).length === 0 && !is_loading_layers && (
                      <div className="p-2 text-center text-xs text-muted-foreground">
                        No matching layers found.
                      </div>
                    )}
                    {Object.entries(dataset_folders).map(([arg0_folder_name, arg0_folder_layers]) =>
                      render_dataset_folder_node(arg0_folder_name, arg0_folder_layers)
                    )}
                  </div>
                )}
              </div>

              {/* Branch 2: Analytical Overlays */}
              <div className="border border-border/80 bg-card/40">
                <div
                  onClick={() => toggle_node('overlays')}
                  className="flex items-center justify-between p-1.5 bg-muted/40 hover:bg-muted/70 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <Icon name="folder_open" className="text-primary text-xs" />
                    <span className="font-bold text-xs text-foreground uppercase tracking-wide">
                      Analytical Overlays
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
                          <button
                            type="button"
                            onClick={() => on_toggle_map_mode(arg0_mode.id)}
                            className={`w-full flex items-center justify-between px-2 py-1 text-left cursor-pointer border transition-colors ${
                              is_active
                                ? 'bg-primary/20 text-primary border-primary font-bold shadow-xs'
                                : 'hover:bg-muted/40 text-foreground border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-3.5 h-3.5 rounded-none border flex items-center justify-center shrink-0 ${
                                is_active ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/60'
                              }`}>
                                {is_active && <Icon name="check" className="text-[10px]" />}
                              </span>
                              <span className="text-xs truncate">{arg0_mode.label}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground uppercase font-mono">
                              {is_active ? 'ON' : 'OFF'}
                            </span>
                          </button>

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
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

export default MapmodesTray
