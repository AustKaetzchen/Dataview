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
  activeVariableSelectors?: Record<string, string>
  allCountries: CountryFeature[]
  cameraTilt?: number
  circleOverlayConfig: CircleOverlayConfig
  countriesMode: boolean
  countryStats?: CountryStats | null
  heightmapConfig: HeightmapConfig
  isCalculatingStats?: boolean
  isLoadingLayers?: boolean
  layers?: Record<string, ParsedDataLayer>
  mapModes: MapModeItem[]
  onChangeVariableSelector?: (arg0_key: string, arg1_option: string) => void
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
    userRole: user_role = 'developer',
  } = props

  //Declare local instance variables
  let all_layer_entries: ParsedDataLayer[]
  let expanded_nodes: Record<string, boolean>
  let filtered_layers: ParsedDataLayer[]
  let filtered_overlays: MapModeItem[]
  let is_layer_accessible: (arg0_layer: ParsedDataLayer) => boolean
  let is_tray_collapsed: boolean
  let render_data_layer_node: (arg0_layer: ParsedDataLayer, arg1_depth?: number) => React.ReactNode
  let render_variable_selectors: (arg0_layer: ParsedDataLayer) => React.ReactNode
  let search_query: string
  let set_expanded_nodes: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  let set_is_tray_collapsed: React.Dispatch<React.SetStateAction<boolean>>
  let set_search_query: React.Dispatch<React.SetStateAction<string>>
  let toggle_node: (arg0_id: string) => void

  //Function body
  ;[is_tray_collapsed, set_is_tray_collapsed] = useState<boolean>(false)
  ;[search_query, set_search_query] = useState<string>('')
  ;[expanded_nodes, set_expanded_nodes] = useState<Record<string, boolean>>({
    data_layers: true,
    overlays: true,
  })

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

  //Filter layers by search
  filtered_layers = useMemo(() => {
    let q = search_query.toLowerCase().trim()
    if (!q)
      return all_layer_entries

    return all_layer_entries.filter((arg0_layer) => {
      let matches_name = arg0_layer.name.toLowerCase().includes(q)
      let matches_id = arg0_layer.id.toLowerCase().includes(q)
      let matches_sub = arg0_layer.sub_layers?.some(
        (arg0_sub) => arg0_sub.name.toLowerCase().includes(q) || arg0_sub.id.toLowerCase().includes(q)
      )
      return matches_name || matches_id || matches_sub
    })
  }, [all_layer_entries, search_query])

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
      <div className="mt-1 p-1.5 border-t border-border/60 bg-muted/20 space-y-1.5 text-[11px]">
        {selector_keys.map((arg0_key) => {
          let sel = layer.variable_selectors![arg0_key]
          let opts = Object.entries(sel.options)
          let current_val = active_variable_selectors[arg0_key] || opts[0]?.[0] || ''

          return (
            <div key={arg0_key} className="space-y-1">
              <span className="text-muted-foreground uppercase font-bold text-[10px] tracking-wider block">
                {sel.name || arg0_key}
              </span>
              <Select
                value={current_val}
                onValueChange={(arg0_v) => on_change_variable_selector && on_change_variable_selector(arg0_key, arg0_v)}
              >
                <SelectTrigger className="h-6 rounded-none text-[11px] bg-card border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none">
                  {opts.map(([arg0_opt_key, arg0_opt]) => (
                    <SelectItem key={arg0_opt_key} value={arg0_opt_key} className="rounded-none text-[11px]">
                      {arg0_opt.name || arg0_opt_key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
    let is_node_expanded = expanded_nodes[layer.id] ?? true

    return (
      <div key={layer.id} className="space-y-1" style={{ paddingLeft: `${depth*12}px` }}>
        {has_sub_layers ? (
          <div>
            <div
              onClick={() => toggle_node(layer.id)}
              className="flex items-center justify-between px-2 py-1 bg-muted/30 hover:bg-muted/60 cursor-pointer border border-border/60 transition-colors"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Icon name="folder" className="text-primary text-xs shrink-0" />
                <span className="text-xs font-bold text-foreground truncate">{layer.name}</span>
              </div>
              <Icon
                name={is_node_expanded ? 'expand_less' : 'expand_more'}
                className="text-xs text-muted-foreground shrink-0"
              />
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
                      <span className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${
                        is_active ? 'border-primary bg-primary' : 'border-muted-foreground/60'
                      }`}>
                        {is_active && <span className="w-1 h-1 rounded-full bg-primary-foreground" />}
                      </span>
                      <span className="text-xs truncate">
                        {layer.name.endsWith('(Total)') ? layer.name : `${layer.name} (Total)`}
                      </span>
                    </div>
                    {layer.unit && (
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{layer.unit}</span>
                    )}
                  </button>
                )}

                {is_active && render_variable_selectors(layer)}

                {/* Child sub-layers */}
                {layer.sub_layers!.map((arg0_sub) => render_data_layer_node(arg0_sub, depth + 1))}
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
                <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{layer.unit}</span>
              )}
            </button>

            {is_active && render_variable_selectors(layer)}
          </div>
        )}
      </div>
    )
  }

  //Return statement
  return (
    <TooltipProvider delayDuration={150}>
      <div className="absolute bottom-3 right-3 z-20 w-80 max-h-[calc(100vh-140px)] flex flex-col bg-card/95 backdrop-blur-md border border-border shadow-2xl p-2.5 space-y-2 text-[var(--body-font-size)] select-none font-sans overflow-hidden transition-all">
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
                    {filtered_layers.length === 0 && !is_loading_layers && (
                      <div className="p-2 text-center text-xs text-muted-foreground">
                        No matching layers found.
                      </div>
                    )}
                    {filtered_layers.map((arg0_layer) => render_data_layer_node(arg0_layer))}
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
