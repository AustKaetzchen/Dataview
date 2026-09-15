import React from 'react'
import {
  CountryFeature,
  ProjectionType,
  HeightmapConfig,
  CircleOverlayConfig,
  MapModeItem,
  CityPoint,
  StadesterConfig,
} from '@/lib/geopng/types'
import { UI_LAYOUT } from '@/lib/uiLayout'
import { MAP_CONFIG } from '@config'
import { ColorBarLegend } from './ColorBarLegend'
import { StadesterLegendCard } from './StadesterLegendCard'
import { InfoFlyoutPanel } from './InfoFlyoutPanel'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'

export interface MapViewerHUDProps {
  analyticsOpen: boolean
  basemap: string
  cameraTilt: number
  circleOverlayConfig: CircleOverlayConfig
  colorPalette: any
  colourbarLeft?: number
  colourbarWidth?: number
  flyoutOpen: boolean
  hasCanvas?: boolean
  heightmapConfig: HeightmapConfig
  hoveredCity?: CityPoint | null
  infoPanelOpen?: boolean
  inspectData?: any
  invertPalette?: boolean
  isTimelapseExporting?: boolean
  legendBreaks?: number[]
  legendCountryName?: string
  legendMax: number
  legendMin: number
  legendPosition: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  legendSubtitle?: string
  legendTitle: string
  logSigma: number
  mapModes: MapModeItem[]
  mapmodesTakenRight?: number
  onChangeLegendPosition?: (arg0_pos: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right') => void
  onCloseInfoPanel?: () => void
  onDoubleClick: () => void
  onResizeColourbarWidth?: (arg0_w: number) => void
  onToggleAnalytics: () => void
  onTogglePerformantMode?: (arg0_enabled: boolean) => void
  onToggleUi?: () => void
  onUpdateBreaks?: (arg0_breaks: number[]) => void
  performantMode: boolean
  projection: ProjectionType
  raster?: any
  scaleType: string
  selectedCountries?: CountryFeature[]
  setBasemap: (arg0_id: string) => void
  setFlyoutOpen: (arg0_open: boolean) => void
  setProjection: (arg0_p: ProjectionType) => void
  setShowGraticule: React.Dispatch<React.SetStateAction<boolean>>
  showGraticule: boolean
  stadesterCities?: CityPoint[]
  stadesterConfig?: StadesterConfig
  timelineBounds?: { left: number; right: number; top: number } | null
  timelineClearance?: number
  topRightTaken?: number
  uiVisible: boolean
}

/**
 * HUD overlays component containing legend bars, top-right tools, and map settings flyout.
 *
 * @param {MapViewerHUDProps} arg0_props
 *
 * @returns {React.ReactElement}
 */
export const MapViewerHUD: React.FC<MapViewerHUDProps> = React.memo(function (
  arg0_props: MapViewerHUDProps
) {
  //Convert from parameters
  let props = arg0_props
  let analytics_open = props.analyticsOpen
  let basemap = props.basemap
  let camera_tilt = props.cameraTilt
  let circle_overlay_config = props.circleOverlayConfig
  let color_palette = props.colorPalette
  let colourbar_left = props.colourbarLeft ?? 24
  let current_colourbar_width = props.colourbarWidth ?? 336
  let flyout_open = props.flyoutOpen
  let has_canvas = Boolean(props.hasCanvas)
  let heightmap_config = props.heightmapConfig
  let hovered_city = props.hoveredCity
  let info_panel_open = props.infoPanelOpen
  let inspect_data = props.inspectData
  let invert_palette = props.invertPalette
  let is_timelapse_exporting = props.isTimelapseExporting
  let legend_breaks = props.legendBreaks
  let legend_country_name = props.legendCountryName
  let legend_max = props.legendMax
  let legend_min = props.legendMin
  let legend_position = props.legendPosition
  let legend_subtitle = props.legendSubtitle
  let legend_title = props.legendTitle
  let log_sigma = props.logSigma
  let map_modes = props.mapModes
  let mapmodes_taken_right = props.mapmodesTakenRight ?? 352
  let on_change_legend_position = props.onChangeLegendPosition
  let on_close_info_panel = props.onCloseInfoPanel
  let on_double_click = props.onDoubleClick
  let on_resize_colourbar_width = props.onResizeColourbarWidth
  let on_toggle_analytics = props.onToggleAnalytics
  let on_toggle_performant_mode = props.onTogglePerformantMode
  let on_toggle_ui = props.onToggleUi
  let on_update_breaks = props.onUpdateBreaks
  let performant_mode = props.performantMode
  let projection = props.projection
  let raster = props.raster
  let scale_type = props.scaleType
  let selected_countries = props.selectedCountries
  let set_basemap = props.setBasemap
  let set_flyout_open = props.setFlyoutOpen
  let set_projection = props.setProjection
  let set_show_graticule = props.setShowGraticule
  let show_graticule = props.showGraticule
  let stadester_cities = props.stadesterCities
  let stadester_config = props.stadesterConfig
  let timeline_bounds = props.timelineBounds
  let timeline_clearance = props.timelineClearance ?? 128
  let top_right_taken = props.topRightTaken ?? 0
  let ui_visible = props.uiVisible

  //Declare local instance variables
  let container_style: React.CSSProperties = {}
  let is_bottom = legend_position.startsWith('bottom')
  let is_center_pos = legend_position.includes('center') || legend_position.includes('centre')
  let window_w = (typeof window !== 'undefined') ? window.innerWidth : 1920

  //Function body
  let effective_timeline_left = timeline_bounds ? timeline_bounds.left : ((window_w - Math.min(1100, window_w - 64)) / 2)
  let effective_timeline_right = timeline_bounds ? timeline_bounds.right : (effective_timeline_left + Math.min(1100, window_w - 64))
  let has_timeline = Boolean(timeline_bounds) || ui_visible || is_timelapse_exporting

  if (legend_position === 'bottom-center') {
    container_style.bottom = `${timeline_clearance}px`
    container_style.left = '50%'
    container_style.transform = 'translateX(-50%)'
    container_style.width = 'min(1100px, calc(100vw - 64px))'
  } else if (legend_position === 'bottom-left') {
    let cb_x1 = colourbar_left
    let cb_x2 = colourbar_left + current_colourbar_width
    let overlaps_timeline = has_timeline && (cb_x1 < effective_timeline_right && cb_x2 > effective_timeline_left)
    container_style.bottom = overlaps_timeline ? `${timeline_clearance}px` : `${UI_LAYOUT.margin}px`
    container_style.left = `${colourbar_left}px`
    container_style.width = `${current_colourbar_width}px`
  } else if (legend_position === 'bottom-right') {
    let effective_mapmodes_taken = (ui_visible && !is_timelapse_exporting) ? Math.max(mapmodes_taken_right, 352) : 0
    let bottom_right_offset = (effective_mapmodes_taken > 0) ? (effective_mapmodes_taken + UI_LAYOUT.gap) : UI_LAYOUT.margin
    let cb_x1 = window_w - bottom_right_offset - current_colourbar_width
    let cb_x2 = window_w - bottom_right_offset
    let overlaps_timeline = has_timeline && (cb_x1 < effective_timeline_right && cb_x2 > effective_timeline_left)
    container_style.bottom = overlaps_timeline ? `${timeline_clearance}px` : `${UI_LAYOUT.margin}px`
    container_style.right = `${bottom_right_offset}px`
    container_style.width = `${current_colourbar_width}px`
  } else if (legend_position === 'top-center') {
    container_style.top = `${UI_LAYOUT.margin}px`
    container_style.left = '50%'
    container_style.transform = 'translateX(-50%)'
    container_style.width = 'min(1100px, calc(100vw - 64px))'
  } else if (legend_position === 'top-right') {
    let top_right_offset = (top_right_taken > 0) ? (top_right_taken + UI_LAYOUT.gap) : UI_LAYOUT.margin
    container_style.top = `${UI_LAYOUT.margin}px`
    container_style.right = `${top_right_offset}px`
    container_style.width = `${current_colourbar_width}px`
  } else {
    // 'top-left'
    container_style.top = `${UI_LAYOUT.margin}px`
    container_style.left = `${colourbar_left}px`
    container_style.width = `${current_colourbar_width}px`
  }

  //Return statement
  return (
    <>
      {/* Floating Legend Container */}
      {!is_timelapse_exporting && ui_visible && (
        <div
          id="dataview-legend-card-container"
          style={container_style}
          className={`absolute z-30 pointer-events-none flex flex-col gap-2 ${is_bottom ? 'justify-end' : 'justify-start'
            }`}
        >
          {/* Main Raster ColourBar Legend */}
          {legend_title !== 'None' && (
            <div className="pointer-events-auto">
              <ColorBarLegend
                palette={color_palette}
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
                width={is_center_pos ? '100%' : current_colourbar_width}
                onResizeWidth={is_center_pos ? undefined : on_resize_colourbar_width}
              />
            </div>
          )}

          {/* Stadestér Settlements Legend Card */}
          {stadester_config?.enabled && (
            <div className="pointer-events-auto">
              <StadesterLegendCard
                config={stadester_config}
                hoveredCity={hovered_city}
                settlementCount={stadester_cities?.length ?? 0}
                width={is_center_pos ? '100%' : current_colourbar_width}
              />
            </div>
          )}

          {/* Information & Controls Flyout Panel */}
          {info_panel_open && (
            <div className="pointer-events-auto">
              <InfoFlyoutPanel
                isOpen={info_panel_open}
                onClose={on_close_info_panel || (() => { })}
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
      )}

      {/* Map Control Tools Toolbar (Top Right) */}
      {!is_timelapse_exporting && (
        <TooltipProvider delayDuration={150}>
          <div
            id="dataview-top-right-toolbar"
            style={{ right: `${UI_LAYOUT.margin}px`, top: `${UI_LAYOUT.margin}px` }}
            className="absolute z-30 flex flex-col gap-[var(--cell-padding)] bg-card/95 backdrop-blur-md p-[var(--cell-padding)] rounded-none border border-border shadow-md"
          >
            {/* Map Display Settings Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={flyout_open ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => set_flyout_open(!flyout_open)}
                  className="h-7 w-7 rounded-none text-white cursor-pointer"
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
                  variant={analytics_open ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={on_toggle_analytics}
                  className="h-7 w-7 rounded-none text-white cursor-pointer"
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
                  variant={show_graticule ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => set_show_graticule(!show_graticule)}
                  className="h-7 w-7 rounded-none text-white cursor-pointer"
                  aria-label="Toggle Graticule Grid"
                >
                  <Icon name="grid_on" className="text-white" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <span>Toggle Graticule Grid (Parallels & Meridians)</span>
              </TooltipContent>
            </Tooltip>

            {/* Reset Map View */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={on_double_click}
                  className="h-7 w-7 rounded-none text-white cursor-pointer"
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
          {flyout_open && ui_visible && (
            <div
              id="dataview-settings-drawer"
              style={{
                right: `${UI_LAYOUT.settingsDrawerRight}px`,
                top: `${UI_LAYOUT.margin}px`,
                width: `${UI_LAYOUT.settingsDrawerWidth}px`,
              }}
              className="absolute z-35 bg-card/98 backdrop-blur-md border border-border rounded-none p-[var(--padding)] shadow-2xl text-[var(--body-font-size)] text-card-foreground animate-in fade-in-0 zoom-in-95 duration-100 font-sans space-y-[var(--padding)] max-h-[340px] overflow-y-auto custom-scrollbar"
            >
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

              {/* Projection Mode */}
              <div className="space-y-1.5">
                <span className="text-[var(--body-font-size)] font-bold text-foreground">Projection Mode</span>
                <div className="grid grid-cols-2 gap-1 bg-background/60 p-[var(--cell-padding)] rounded-none border border-border">
                  {(['Mercator', 'Equirectangular', 'Globe', 'EqualEarth'] as ProjectionType[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => set_projection(p)}
                      className={`px-2 py-1 rounded-none text-[var(--body-font-size)] transition-colors cursor-pointer text-center ${projection === p
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground font-light'
                        }`}
                    >
                      {p === 'Equirectangular' ? 'Equirect.' : p === 'EqualEarth' ? 'Equal Earth' : p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Basemap Layer */}
              <div className="space-y-1.5">
                <span className="text-[var(--body-font-size)] font-bold text-foreground">Basemap Layer</span>
                <div className="space-y-1 bg-background/60 p-[var(--cell-padding)] rounded-none border border-border">
                  {MAP_CONFIG.basemapLayers.map((arg0_item: { id: string; label: string }) => (
                    <button
                      key={arg0_item.id}
                      type="button"
                      onClick={() => set_basemap(arg0_item.id)}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded-none text-[var(--body-font-size)] transition-colors cursor-pointer text-left ${basemap === arg0_item.id
                        ? 'bg-muted text-foreground font-bold'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground font-light'
                        }`}
                    >
                      <span>{arg0_item.label}</span>
                      {basemap === arg0_item.id && <span className="w-1.5 h-1.5 rounded-none bg-primary" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colourbar Position */}
              <div className="space-y-1.5">
                <span className="text-[var(--body-font-size)] font-bold text-foreground">Colourbar Position</span>
                <div className="grid grid-cols-3 gap-1 bg-background/60 p-[var(--cell-padding)] rounded-none border border-border">
                  {[
                    { id: 'top-left', label: 'Top Left' },
                    { id: 'top-center', label: 'Top Centre' },
                    { id: 'top-right', label: 'Top Right' },
                    { id: 'bottom-left', label: 'Bottom Left' },
                    { id: 'bottom-center', label: 'Bottom Centre' },
                    { id: 'bottom-right', label: 'Bottom Right' },
                  ].map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => on_change_legend_position && on_change_legend_position(pos.id as any)}
                      className={`px-1.5 py-1 rounded-none text-[10px] transition-colors cursor-pointer text-center ${legend_position === pos.id
                        ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground font-light'
                        }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Performant Mode (Optimization Logic) */}
              <div className="space-y-1.5 pt-1 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--body-font-size)] font-bold text-foreground">Performant Mode</span>
                  <button
                    type="button"
                    onClick={() => on_toggle_performant_mode && on_toggle_performant_mode(!performant_mode)}
                    className={`px-2 py-0.5 rounded-none text-[10px] font-mono font-bold cursor-pointer transition-colors ${performant_mode
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    {performant_mode ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground block leading-normal">
                  Actively culls RAM cache to 1 keyframe and disables background prefetch to cap memory usage.
                </span>
              </div>
            </div>
          )}
        </TooltipProvider>
      )}
    </>
  )
})
