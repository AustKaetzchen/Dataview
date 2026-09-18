import React from 'react'
import {
  CountryFeature,
  ProjectionType,
  HeightmapConfig,
  CircleOverlayConfig,
  MapModeItem,
  CityPoint,
  StadesterConfig,
} from '@framework/geopng/types.ts'
import { UI_LAYOUT } from '@framework/utils/ui_layout'
import { MAP_CONFIG } from '@common'
import { useLocalisation, type SupportedLocale } from '@localisation'
import { ColorBarLegend } from './color_bar_legend'
import { StadesterLegendCard } from './stadester_legend_card'
import { InfoFlyoutPanel } from './info_flyout_panel'
import { Button } from '@ui/components/button'
import { Icon } from '@ui/components/icon'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@ui/components/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@ui/components/tooltip'

export interface MapViewerHUDProps {
  activeLayerId?: string | null
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
  hideColourbar?: boolean
  hoveredCity?: CityPoint | null
  infoPanelOpen?: boolean
  inspectData?: any
  invertPalette?: boolean
  isMobile?: boolean
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
  onDoubleClick?: () => void
  onResizeColourbarWidth?: (arg0_w: number) => void
  onToggleAnalytics: () => void
  onTogglePerformantMode?: (arg0_enabled: boolean) => void
  onToggleTooltips?: () => void
  onToggleUi?: () => void
  onUpdateBreaks?: (arg0_breaks: number[]) => void
  performantMode: boolean
  projection: ProjectionType
  raster?: any
  rasterVersion?: number
  scaleType: string
  selectedCountries?: CountryFeature[]
  setBasemap: (arg0_id: string) => void
  setFlyoutOpen: (arg0_open: boolean) => void
  setProjection: (arg0_p: ProjectionType) => void
  setShowGraticule: React.Dispatch<React.SetStateAction<boolean>>
  showGraticule: boolean
  showTooltips?: boolean
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
export let MapViewerHUD: React.FC<MapViewerHUDProps> = React.memo(function (
  arg0_props: MapViewerHUDProps
) {
  //Convert from parameters
  let props = arg0_props
  let active_layer_id = props.activeLayerId
  let analytics_open = props.analyticsOpen
  let basemap = props.basemap
  let camera_tilt = props.cameraTilt
  let circle_overlay_config = props.circleOverlayConfig
  let color_palette = props.colorPalette
  let colourbar_left = props.colourbarLeft ?? 24
  let is_mobile = props.isMobile ?? false
  let current_colourbar_width = is_mobile
    ? Math.min(props.colourbarWidth ?? 336, typeof window !== 'undefined' ? window.innerWidth - 32 : 320)
    : (props.colourbarWidth ?? 336)
  let flyout_open = props.flyoutOpen
  let has_canvas = Boolean(props.hasCanvas)
  let heightmap_config = props.heightmapConfig
  let hide_colourbar = Boolean(props.hideColourbar)
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
  let on_toggle_tooltips = props.onToggleTooltips
  let on_toggle_ui = props.onToggleUi
  let on_update_breaks = props.onUpdateBreaks
  let performant_mode = props.performantMode
  let projection = props.projection
  let raster = props.raster
  let raster_version = props.rasterVersion ?? 0
  let scale_type = props.scaleType
  let selected_countries = props.selectedCountries
  let set_basemap = props.setBasemap
  let set_flyout_open = props.setFlyoutOpen
  let set_projection = props.setProjection
  let set_show_graticule = props.setShowGraticule
  let show_graticule = props.showGraticule
  let show_tooltips = props.showTooltips ?? true
  let stadester_cities = props.stadesterCities
  let stadester_config = props.stadesterConfig
  let timeline_bounds = props.timelineBounds
  let timeline_clearance = props.timelineClearance ?? 128
  let top_right_taken = props.topRightTaken ?? 0
  let ui_visible = props.uiVisible

  let { locale, setLocale, t } = useLocalisation()

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
      {!is_timelapse_exporting && ui_visible && ((!hide_colourbar && (Boolean(raster) || Boolean(has_canvas))) || Boolean(stadester_config?.enabled) || Boolean(info_panel_open)) && (
        <div
          id="dataview-legend-card-container"
          style={container_style}
          className={`absolute z-30 pointer-events-none flex flex-col gap-2 ${is_bottom ? 'justify-end' : 'justify-start'
            }`}
        >
          {/* Main Raster ColourBar Legend */}
          {!hide_colourbar && legend_title !== 'None' && (Boolean(raster) || Boolean(has_canvas)) && (
            <div className="pointer-events-auto">
              <ColorBarLegend
                key={`colorbar-${active_layer_id ?? 'layer'}-${raster_version}-${legend_title}-${legend_subtitle}-${color_palette}`}
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
          {info_panel_open && !is_mobile && (
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
            style={{ right: `${UI_LAYOUT.margin}px`, top: is_mobile ? '54px' : `${UI_LAYOUT.margin}px` }}
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
                  aria-label={t.settings.title}
                >
                  <Icon name="settings" className="text-white" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <span>{t.settings.title}</span>
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
                  aria-label={t.analytics.title}
                >
                  <Icon name="analytics" className="text-white" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <span>{t.analytics.title}</span>
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
                  aria-label={t.hud.graticule}
                >
                  <Icon name="grid_on" className="text-white" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <span>{t.hud.graticule}</span>
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
                  aria-label={t.hud.resetView}
                >
                  <Icon name="restart_alt" className="text-white" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <span>{t.hud.resetView}</span>
              </TooltipContent>
            </Tooltip>

            {/* Toggle On-Map Inspection Tooltips */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={show_tooltips ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={on_toggle_tooltips}
                  className="h-7 w-7 rounded-none text-white cursor-pointer"
                  aria-label={show_tooltips ? (t.hud.hideTooltips || 'Disable Tooltips') : (t.hud.showTooltips || 'Enable Tooltips')}
                >
                  <Icon
                    name={show_tooltips ? 'chat_bubble' : 'chat_bubble_outline'}
                    className={show_tooltips ? 'text-white' : 'text-muted-foreground'}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <span>{show_tooltips ? (t.hud.hideTooltips || 'Disable Tooltips') : (t.hud.showTooltips || 'Enable Tooltips')}</span>
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
                  aria-label={ui_visible ? t.hud.hideUi : t.hud.showUi}
                >
                  <Icon name={ui_visible ? 'visibility' : 'visibility_off'} className="text-white" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <span>{ui_visible ? t.hud.hideUi : t.hud.showUi}</span>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Map Display Settings Flyout Panel */}
          {flyout_open && ui_visible && (
            <>
              <div
                id="dataview-settings-drawer"
                style={is_mobile ? {
                  bottom: '0px',
                  left: '0px',
                  maxHeight: 'calc(var(--app-height, 100dvh) - 54px)',
                  right: '0px',
                } : {
                  maxHeight: 'calc(100dvh - 60px)',
                  right: `${UI_LAYOUT.settingsDrawerRight}px`,
                  top: `${UI_LAYOUT.margin}px`,
                  width: `${UI_LAYOUT.settingsDrawerWidth}px`,
                }}
                className={is_mobile
                  ? 'fixed z-50 bg-card/98 backdrop-blur-md border-t border-border rounded-t-lg p-[var(--padding)] pb-3 shadow-2xl text-[var(--body-font-size)] text-card-foreground font-sans space-y-[var(--padding)] overflow-y-auto custom-scrollbar'
                  : 'absolute z-35 bg-card/98 backdrop-blur-md border border-border rounded-none p-[var(--padding)] shadow-2xl text-[var(--body-font-size)] text-card-foreground font-sans space-y-[var(--padding)] overflow-y-auto custom-scrollbar'
                }
              >
                <div className="flex items-center justify-between pb-1.5 border-b border-border">
                  <span className="text-[var(--body-font-size)] font-bold text-foreground flex items-center gap-1.5">
                    <Icon name="settings" />
                    <span>{t.settings.title}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => set_flyout_open(false)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-center"
                    title={t.settings.close}
                    aria-label={t.settings.close}
                  >
                    <Icon name="close" size="1.2rem" />
                  </button>
                </div>

                {/* Projection Mode */}
                <div className="space-y-1.5">
                  <span className="text-[var(--body-font-size)] font-bold text-foreground">{t.settings.projectionMode}</span>
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
                        {p === 'Equirectangular' ? t.settings.projections.equirectangular : p === 'EqualEarth' ? t.settings.projections.equalEarth : p === 'Globe' ? t.settings.projections.globe : t.settings.projections.mercator}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Basemap Layer */}
                <div className="space-y-1.5">
                  <span className="text-[var(--body-font-size)] font-bold text-foreground">{t.settings.basemapLayer}</span>
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
                  <span className="text-[var(--body-font-size)] font-bold text-foreground">{t.settings.colourbarPosition}</span>
                  <div className="grid grid-cols-3 gap-1 bg-background/60 p-[var(--cell-padding)] rounded-none border border-border">
                    {[
                      { id: 'top-left', label: t.settings.positions.topLeft },
                      { id: 'top-center', label: t.settings.positions.topCenter },
                      { id: 'top-right', label: t.settings.positions.topRight },
                      { id: 'bottom-left', label: t.settings.positions.bottomLeft },
                      { id: 'bottom-center', label: t.settings.positions.bottomCenter },
                      { id: 'bottom-right', label: t.settings.positions.bottomRight },
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

                {/* Language Selector (Endonymic Select) */}
                <div className="space-y-1.5">
                  <span className="text-[var(--body-font-size)] font-bold text-foreground flex items-center gap-1.5">
                    <Icon name="translate" className="text-xs" />
                    <span>{t.settings.language}</span>
                  </span>
                  <Select value={locale} onValueChange={(arg0_val) => setLocale(arg0_val as SupportedLocale)}>
                    <SelectTrigger className="w-full rounded-none h-8 text-[var(--body-font-size)] bg-background/80 border border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border border-border bg-card">
                      <SelectItem value="en-GB">English (EN-GB)</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Performant Mode (Optimization Logic) */}
                <div className="space-y-1.5 pt-1 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--body-font-size)] font-bold text-foreground">{t.settings.performantMode}</span>
                    <button
                      type="button"
                      onClick={() => on_toggle_performant_mode && on_toggle_performant_mode(!performant_mode)}
                      className={`px-2 py-0.5 rounded-none text-[10px] font-mono font-bold cursor-pointer transition-colors ${performant_mode
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      {performant_mode ? t.settings.enabled : t.settings.disabled}
                    </button>
                  </div>
                  <span className="text-[10px] text-muted-foreground block leading-normal">
                    {t.settings.performantDesc}
                  </span>
                </div>
              </div>
            </>
          )}
        </TooltipProvider>
      )}
    </>
  )
})
