import React from 'react'
import type { HistoricalBorderFeature } from '@/server/atlasBordersService'
import type { CountryStats } from '@/lib/geopng/polygonBinning'
import { Icon } from '@/components/ui/icon'
import { UfDate } from '@/lib/ufDate'

export interface HistoricalBorderDetailsPanelProps {
  anchorPos?: { x: number; y: number } | null
  countryStats?: CountryStats | null
  currentYear: number
  feature: HistoricalBorderFeature | null
  isCalculatingStats?: boolean
  onClose: () => void
  onJumpToYear?: (arg0_year: number) => void
  onOpenAnalytics?: () => void
  sidebarWidth?: number
}

/**
 * Historical country details panel displaying temporally sliced attributes,
 * SVEA/CShapes keyframe timelines, and regional raster statistics.
 * Anchored to the map click location with sidebar collision avoidance.
 *
 * @param {HistoricalBorderDetailsPanelProps} arg0_props
 *
 * @returns {React.ReactElement | null}
 */
export const HistoricalBorderDetailsPanel: React.FC<HistoricalBorderDetailsPanelProps> = function (arg0_props) {
  //Convert from parameters
  let props = arg0_props
  let anchor_pos = props.anchorPos
  let country_stats = props.countryStats
  let current_year = props.currentYear
  let feature = props.feature
  let is_calculating_stats = props.isCalculatingStats
  let on_close = props.onClose
  let on_jump_to_year = props.onJumpToYear
  let on_open_analytics = props.onOpenAnalytics
  let sidebar_width = props.sidebarWidth

  //Declare local instance variables
  let active_kf_index = -1
  let alt_names_str: string | undefined
  let area_val_str: string
  let cap_name: string | undefined
  let country_name: string
  let current_date: { day: number; month: number; year: number }
  let current_ts: number
  let display_year: string
  let end_year: number | undefined
  let keyframes_list: any[]
  let max_x: number
  let max_y: number
  let min_x: number
  let panel_h: number
  let panel_style: React.CSSProperties
  let panel_w: number
  let raster_metric_str: string
  let source_label: string
  let start_year: number | undefined
  let target_x: number
  let target_y: number
  let validity_str: string

  //Guard clauses
  if (!feature)
    return null

  //Function body
  cap_name = feature.properties?.capname
  country_name = feature.properties?.name || 'Historical Entity'
  current_date = UfDate.fromFractionalYear(current_year)
  current_ts = UfDate.getTimestamp(current_date)
  display_year = (current_year !== Math.floor(current_year))
    ? UfDate.formatDate(current_date)
    : UfDate.formatYear(current_year)
  end_year = feature.properties?.endYear
  keyframes_list = feature.properties?.keyframes || []
  start_year = feature.properties?.startYear

  //Determine the single active keyframe index for current timeline timestamp
  active_kf_index = -1
  for (let i = 0; i < keyframes_list.length; i++) {
    let kf = keyframes_list[i]
    let kf_ts = kf.timestamp !== undefined
      ? kf.timestamp
      : UfDate.getTimestamp({
          day: kf.day || 1,
          month: kf.month || 1,
          year: kf.year,
        })
    if (kf_ts <= current_ts) {
      active_kf_index = i
    } else {
      break
    }
  }
  if (active_kf_index === -1 && keyframes_list.length > 0)
    active_kf_index = 0

  if (feature.id?.toString().startsWith('cshapes') || feature.properties?.gwcode) {
    source_label = 'CShapes-2.0'
  } else {
    source_label = 'atlas.naissance'
  }

  if (start_year !== undefined && end_year !== undefined) {
    validity_str = `${UfDate.formatYear(start_year)} – ${UfDate.formatYear(end_year)}`
  } else if (feature.properties?.date) {
    validity_str = feature.properties.date
  } else {
    validity_str = `Active at ${display_year}`
  }

  //Assemble recorded names if distinct
  if (feature.properties?.name_long && feature.properties.name_long !== country_name) {
    alt_names_str = feature.properties.name_long
  } else if (feature.properties?.adm0_a3 && feature.properties.adm0_a3 !== country_name) {
    alt_names_str = feature.properties.adm0_a3
  }

  //Format area value
  if (feature.properties?.area && typeof feature.properties.area === 'number') {
    area_val_str = `${Math.round(feature.properties.area).toLocaleString('de-DE')} km²`
  } else if (country_stats?.validCount) {
    area_val_str = `${country_stats.validCount.toLocaleString('de-DE')} cells`
  } else {
    area_val_str = 'Estimated'
  }

  //Format raster statistic value
  if (country_stats) {
    raster_metric_str = country_stats.mean.toLocaleString('de-DE', { maximumFractionDigits: 2 })
  } else if (is_calculating_stats) {
    raster_metric_str = 'Computing...'
  } else {
    raster_metric_str = 'Overlay Active'
  }

  //Anchored positioning calculations with strict sidebar collision avoidance
  min_x = (sidebar_width !== undefined ? sidebar_width : 336) + 16
  panel_w = 384
  panel_h = 420
  target_x = anchor_pos ? anchor_pos.x + 24 : min_x
  target_y = anchor_pos ? anchor_pos.y - 120 : 60

  max_x = (typeof window !== 'undefined') ? window.innerWidth - panel_w - 16 : 800
  max_y = (typeof window !== 'undefined') ? window.innerHeight - panel_h - 70 : 600

  if (anchor_pos) {
    if (target_x > max_x)
      target_x = anchor_pos.x - panel_w - 24
    if (target_x < min_x)
      target_x = min_x

    if (target_y > max_y)
      target_y = max_y
    if (target_y < 16)
      target_y = 16
  }

  panel_style = {
    left: `${Math.round(target_x)}px`,
    position: 'fixed',
    top: `${Math.round(target_y)}px`,
  }

  //Return statement
  return (
    <div
      id="dataview-historical-border-panel"
      style={panel_style}
      className="z-15 w-96 max-w-[calc(100vw-32px)] bg-card/95 backdrop-blur-md border border-border shadow-2xl p-3 text-foreground select-none font-sans animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border/70 pb-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-none bg-muted/40 border border-border flex items-center justify-center shrink-0">
            <Icon name="flag" className="text-white text-base" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground truncate" title={country_name}>
              {country_name}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
              <span className="text-foreground font-semibold">{source_label}</span>
              <span>•</span>
              <span className="truncate">{validity_str}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={on_close}
          className="p-1 text-muted-foreground hover:text-foreground cursor-pointer shrink-0 transition-colors"
          title="Close historical details panel"
        >
          <Icon name="close" className="text-sm" />
        </button>
      </div>

      {/* Alternate names & Capital info */}
      {(alt_names_str || cap_name) && (
        <div className="text-[11px] text-muted-foreground mb-2.5 space-y-0.5">
          {alt_names_str && (
            <div>
              <span className="text-muted-foreground/80">Also recorded as: </span>
              <span className="text-foreground font-medium">{alt_names_str}</span>
            </div>
          )}
          {cap_name && (
            <div className="flex items-center gap-1">
              <Icon name="location_city" className="text-xs text-white" />
              <span>Capital: </span>
              <span className="text-foreground font-semibold">{cap_name}</span>
            </div>
          )}
        </div>
      )}

      {/* Primary Statistics Grid (3 Cards matching Image 1 layout) */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {/* Metric 1: Area */}
        <div className="border border-border/60 bg-muted/20 p-2 text-center">
          <div className="text-[9px] text-muted-foreground uppercase font-mono tracking-wider">
            Area (km²)
          </div>
          <div className="text-sm font-bold text-foreground font-mono mt-0.5 truncate" title={area_val_str}>
            {area_val_str}
          </div>
          <div className="text-[9px] text-muted-foreground/70 truncate mt-0.5">
            {feature.properties?.area ? 'Territorial' : 'Calculated'}
          </div>
        </div>

        {/* Metric 2: Raster Mean or Status */}
        <div className="border border-border/60 bg-muted/20 p-2 text-center">
          <div className="text-[9px] text-muted-foreground uppercase font-mono tracking-wider">
            {country_stats ? 'Raster Mean' : 'Status'}
          </div>
          <div className="text-sm font-bold text-primary font-mono mt-0.5 truncate" title={raster_metric_str}>
            {raster_metric_str}
          </div>
          <div className="text-[9px] text-muted-foreground/70 truncate mt-0.5">
            {display_year}
          </div>
        </div>

        {/* Metric 3: Keyframes or Span */}
        <div className="border border-border/60 bg-muted/20 p-2 text-center">
          <div className="text-[9px] text-muted-foreground uppercase font-mono tracking-wider">
            Keyframes
          </div>
          <div className="text-sm font-bold text-foreground font-mono mt-0.5">
            {keyframes_list.length > 0 ? keyframes_list.length : 1}
          </div>
          <div className="text-[9px] text-muted-foreground/70 truncate mt-0.5">
            Historical Records
          </div>
        </div>
      </div>

      {/* Raster Statistics & Full Calculator Header */}
      {country_stats && (
        <div className="mb-2.5 p-2 bg-muted/20 border border-border/50 text-xs space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
            <span className="flex items-center gap-1">
              <Icon name="bar_chart" className="text-xs text-primary" />
              <span>Regional Raster Metrics ({display_year})</span>
            </span>
            {on_open_analytics && (
              <button
                type="button"
                onClick={on_open_analytics}
                className="text-[10px] text-red-500 hover:text-red-400 hover:underline cursor-pointer"
              >
                Full Calculator
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px] font-mono pt-1">
            <div>
              <span className="text-muted-foreground">Median: </span>
              <span className="font-bold text-foreground">
                {country_stats.median.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Std Dev: </span>
              <span className="font-bold text-foreground">
                {country_stats.stdDev.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Min / Max: </span>
              <span className="font-bold text-foreground">
                {country_stats.min.toFixed(1)} / {country_stats.max.toFixed(1)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Total: </span>
              <span className="font-bold text-foreground">
                {country_stats.total.toLocaleString('de-DE', { maximumFractionDigits: 1 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe Timeline Trajectory Header */}
      <div className="flex items-center justify-between text-[11px] font-semibold text-foreground mb-1.5 border-t border-border/50 pt-2">
        <span className="flex items-center gap-1.5">
          <Icon name="timeline" className="text-xs text-white" />
          <span className="uppercase tracking-wider font-mono text-[10px]">Historical Trajectory</span>
        </span>
        {on_open_analytics && !country_stats && (
          <button
            type="button"
            onClick={on_open_analytics}
            className="text-[10px] text-red-500 hover:text-red-400 hover:underline cursor-pointer"
          >
            Analytics Drawer
          </button>
        )}
      </div>

      {/* Interactive Keyframes List */}
      {keyframes_list.length > 0 ? (
        <div className="max-h-44 overflow-y-auto custom-scrollbar space-y-1 pr-0.5">
          {keyframes_list.map((arg0_kf: any, arg1_idx: number) => {
            let is_curr = arg1_idx === active_kf_index
            let is_unrecorded = Boolean(arg0_kf.label?.toLowerCase().includes('unrecorded') || arg0_kf.label?.toLowerCase().includes('hidden') || arg0_kf.label?.toLowerCase().includes('dissolved') || arg0_kf.label?.toLowerCase().includes('deleted'))
            let kf = arg0_kf
            let kf_date_str = kf.date || UfDate.formatYear(kf.year)
            let kf_label = kf.label || 'Boundary updated'

            return (
              <button
                key={`${kf.timestamp || kf.year}-${arg1_idx}`}
                type="button"
                onClick={() => {
                  if (on_jump_to_year) {
                    if (kf.timestamp !== undefined) {
                      let kf_date_obj = UfDate.convertTimestampToDate(kf.timestamp)
                      let kf_frac = UfDate.toFractionalYear(kf_date_obj)
                      on_jump_to_year(kf_frac)
                    } else if (kf.year !== undefined) {
                      let kf_frac = UfDate.toFractionalYear({
                        day: kf.day || 1,
                        month: kf.month || 1,
                        year: kf.year,
                      })
                      on_jump_to_year(kf_frac)
                    }
                  }
                }}
                className={`w-full text-left px-2 py-1.5 text-[11px] flex items-center justify-between transition-colors cursor-pointer border ${
                  is_curr
                    ? 'bg-red-500/20 border-red-500/60 text-red-400 font-bold shadow-xs'
                    : is_unrecorded
                      ? 'bg-muted/30 border-border/40 hover:bg-muted/50 text-muted-foreground'
                      : 'bg-card hover:bg-muted/50 border-border/40 text-muted-foreground hover:text-foreground'
                }`}
                title={`Jump timeline to ${kf_date_str}`}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      is_curr ? 'bg-red-500' : (is_unrecorded ? 'bg-muted-foreground/40' : 'bg-muted-foreground/60')
                    }`}
                  />
                  <span className="font-mono font-semibold shrink-0 text-foreground">{kf_date_str}</span>
                  <span className="truncate text-[10px] text-muted-foreground ml-1">{kf_label}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {is_unrecorded && (
                    <span className="text-[9px] px-1 py-0.2 bg-muted text-muted-foreground border border-border/60 font-mono">
                      Unrecorded
                    </span>
                  )}
                  <span className="text-[10px] text-red-500 hover:text-red-400 hover:underline font-mono">
                    Jump →
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground italic py-1 text-center bg-muted/20 border border-border/40">
          No keyframe events recorded for this boundary slice.
        </div>
      )}
    </div>
  )
}
