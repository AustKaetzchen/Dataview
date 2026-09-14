import React, { useState, useEffect } from 'react'
import { DecodedRaster, ScaleType } from '@/lib/geopng/types'
import { CountryFeature, CountryStats } from '@/lib/geopng/polygonBinning'
import { getAnalyticsPanelRightOffset, UI_LAYOUT } from '@/lib/uiLayout'
import { HistogramChart } from './HistogramChart'
import { StatsSummary } from './StatsSummary'
import { PopulationPyramidChart } from './PopulationPyramidChart'
import { CategoryBreakdownChart } from './CategoryBreakdownChart'
import { ParsedDataLayer } from '@/server/layerParser'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'

export interface AnalyticsDrawerProps {
  activeLayer?: ParsedDataLayer | null
  activeVariableSelectors?: Record<string, string | string[]>
  countryStats?: CountryStats | null
  currentYear?: number
  inspectData?: {
    countryName?: string
    lat: number
    lng: number
    pixelX: number
    pixelY: number
    value: number | null
  } | null
  isCalculatingStats?: boolean
  isOpen: boolean
  isSettingsDrawerOpen?: boolean
  logSigma: number
  maxOverride?: number
  minOverride?: number
  onClearCountries?: () => void
  onForceRefresh?: () => void
  onSelectCountry?: (country: CountryFeature | null) => void
  onToggleOpen: () => void
  raster: DecodedRaster | null
  rasterKey?: string | number
  scaleType: ScaleType
  selectedCountries?: CountryFeature[]
  selectedCountry?: CountryFeature | null
}

/**
 * AnalyticsDrawer slide-in container providing raster metrics, distribution histograms, and summary statistics.
 *
 * @param {AnalyticsDrawerProps} arg0_props
 *
 * @returns {React.ReactElement | null}
 */
export const AnalyticsDrawer: React.FC<AnalyticsDrawerProps> = function (arg0_props) {
  //Convert from parameters
  let props = arg0_props
  let {
    activeLayer: active_layer = null,
    activeVariableSelectors: active_variable_selectors = {},
    countryStats: country_stats,
    currentYear: current_year = 1950,
    inspectData: inspect_data = null,
    isCalculatingStats: is_calculating_stats = false,
    isOpen: is_open,
    isSettingsDrawerOpen: is_settings_drawer_open = false,
    logSigma: log_sigma,
    maxOverride: max_override,
    minOverride: min_override,
    onClearCountries: on_clear_countries,
    onForceRefresh: on_force_refresh,
    onSelectCountry: on_select_country,
    onToggleOpen: on_toggle_open,
    raster,
    rasterKey: raster_key,
    scaleType: scale_type,
    selectedCountries: selected_countries,
    selectedCountry: selected_country,
  } = props

  //Declare local instance variables
  let active_tab: 'pyramid' | 'breakdown' | 'histogram' | 'stats'
  let effective_countries: CountryFeature[]
  let handle_clear: () => void
  let has_category_breakdown = Boolean(
    active_layer?.type === 'raster.category_profession' ||
    active_layer?.id?.includes('profession')
  )
  let has_population_pyramid = Boolean(
    active_layer?.type === 'raster.age_sex' ||
    active_layer?.id === 'age_sex'
  )
  let right_offset = getAnalyticsPanelRightOffset(is_settings_drawer_open)
  let set_active_tab: React.Dispatch<React.SetStateAction<'pyramid' | 'breakdown' | 'histogram' | 'stats'>>

  //Function body
  let initial_tab: 'pyramid' | 'breakdown' | 'histogram' | 'stats' = has_population_pyramid
    ? 'pyramid'
    : has_category_breakdown
      ? 'breakdown'
      : 'histogram'

  ;[active_tab, set_active_tab] = useState<'pyramid' | 'breakdown' | 'histogram' | 'stats'>(initial_tab)

  //Update active tab automatically when layer type transitions
  useEffect(() => {
    if (has_population_pyramid) {
      set_active_tab('pyramid')
    } else if (has_category_breakdown) {
      set_active_tab('breakdown')
    } else if (active_tab === 'pyramid' || active_tab === 'breakdown') {
      set_active_tab('histogram')
    }
  }, [active_layer?.id, active_layer?.type, has_population_pyramid, has_category_breakdown])

  //Staggered resize events when opening panel or when raster changes to notify ECharts
  useEffect(() => {
    if (is_open) {
      let t1 = setTimeout(() => window.dispatchEvent(new Event('resize')), 50)
      let t2 = setTimeout(() => window.dispatchEvent(new Event('resize')), 200)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
  }, [is_open, right_offset, raster, raster_key, active_tab])

  //Guard clauses
  if (!is_open)
    return null

  effective_countries =
    selected_countries && selected_countries.length > 0
      ? selected_countries
      : selected_country
        ? [selected_country]
        : []

  handle_clear = function () {
    if (on_clear_countries) {
      on_clear_countries()
    } else if (on_select_country) {
      on_select_country(null)
    }
  }

  //Return statement
  return (
    <div
      id="dataview-analytics-drawer"
      onTransitionEnd={() => {
        window.dispatchEvent(new Event('resize'))
      }}
      style={{
        right: `${right_offset}px`,
        top: `${UI_LAYOUT.margin}px`,
      }}
      className="absolute z-40 w-[640px] max-w-[calc(100vw-720px)] h-[340px] bg-card/95 backdrop-blur-md border border-border rounded-none text-card-foreground shadow-2xl flex flex-col font-sans transition-all duration-200 ease-out animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {/* Panel Header */}
      <div className="h-[var(--navbar-height)] px-[var(--padding)] flex items-center justify-between border-b border-border select-none gap-[var(--padding)] bg-card/90">
        <div className="flex items-center gap-[var(--padding)] min-w-0">
          <span className="text-[var(--header-font-size)] font-bold text-foreground flex items-center gap-1.5 shrink-0">
            <Icon name="bar_chart" />
            <span>Raster Calculator</span>
          </span>

          <div className="flex items-center gap-1 bg-muted p-[var(--cell-padding)] rounded-none shrink-0">
            {/* Population Pyramid Tab for raster.age_sex */}
            {has_population_pyramid && (
              <button
                type="button"
                onClick={() => set_active_tab('pyramid')}
                className={`px-2 py-0.5 text-[var(--body-font-size)] rounded-none transition-colors flex items-center gap-1.5 cursor-pointer ${
                  active_tab === 'pyramid'
                    ? 'bg-background text-foreground shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground font-light'
                }`}
              >
                <Icon name="people" className="text-white text-xs" />
                Pyramid
              </button>
            )}

            {/* Sector Breakdown Tab for raster.category_profession */}
            {has_category_breakdown && (
              <button
                type="button"
                onClick={() => set_active_tab('breakdown')}
                className={`px-2 py-0.5 text-[var(--body-font-size)] rounded-none transition-colors flex items-center gap-1.5 cursor-pointer ${
                  active_tab === 'breakdown'
                    ? 'bg-background text-foreground shadow-sm font-bold'
                    : 'text-muted-foreground hover:text-foreground font-light'
                }`}
              >
                <Icon name="briefcase" className="text-white text-xs" />
                Sectors
              </button>
            )}

            <button
              type="button"
              onClick={() => set_active_tab('histogram')}
              className={`px-2 py-0.5 text-[var(--body-font-size)] rounded-none transition-colors flex items-center gap-1.5 cursor-pointer ${
                active_tab === 'histogram'
                  ? 'bg-background text-foreground shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground font-light'
              }`}
            >
              <Icon name="bar_chart" className="text-white text-xs" />
              Distribution
            </button>

            <button
              type="button"
              onClick={() => set_active_tab('stats')}
              className={`px-2 py-0.5 text-[var(--body-font-size)] rounded-none transition-colors flex items-center gap-1.5 cursor-pointer ${
                active_tab === 'stats'
                  ? 'bg-background text-foreground shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground font-light'
              }`}
            >
              <Icon name="info" className="text-white text-xs" />
              Statistics
            </button>
          </div>

          {/* Active country filter badge */}
          {effective_countries.length > 0 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-none bg-primary/15 text-primary text-[var(--body-font-size)] font-medium border border-primary/30 truncate">
              <span className={`w-1.5 h-1.5 rounded-none ${is_calculating_stats ? 'bg-amber-400 animate-pulse' : 'bg-primary'} shrink-0`} />
              <span className="truncate max-w-[140px]">
                {effective_countries.length === 1
                  ? effective_countries[0].properties.name
                  : `${effective_countries[0].properties.name} (+${effective_countries.length - 1})`}
              </span>
              {is_calculating_stats && (
                <span className="text-[10px] text-amber-400 font-normal ml-0.5 animate-pulse shrink-0">
                  (calculating...)
                </span>
              )}
              <button
                type="button"
                onClick={handle_clear}
                className="ml-0.5 hover:text-foreground opacity-70 hover:opacity-100 cursor-pointer text-xs rounded-none"
                title="Clear country filter"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 rounded-none text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => {
              if (on_force_refresh)
                on_force_refresh()
              window.dispatchEvent(new Event('resize'))
            }}
            title="Force Refresh Raster Calculator"
            aria-label="Force Refresh Raster Calculator"
          >
            <Icon name="refresh" className="text-white text-xs" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 rounded-none text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={on_toggle_open}
            title="Close Analytics Panel"
          >
            <Icon name="close" className="text-white" />
          </Button>
        </div>
      </div>

      {/* Panel Body */}
      <div className="flex-1 p-[var(--padding)] overflow-hidden bg-background/50 flex flex-col min-h-0">
        {!raster ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-[var(--body-font-size)] space-y-1">
            <Icon name="upload_file" className="text-white/60 mb-1" />
            <span>No GeoPNG raster loaded.</span>
            <span className="text-[var(--body-font-size)] text-muted-foreground/70">
              Upload a GeoPNG file in the sidebar to inspect statistics & distributions.
            </span>
          </div>
        ) : is_calculating_stats && !country_stats ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-[var(--body-font-size)] space-y-2">
            <div className="flex items-center gap-2 text-primary font-medium">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span>Calculating country statistics...</span>
            </div>
            <span className="text-[var(--body-font-size)] text-muted-foreground/70">
              Processing raster cells in background worker.
            </span>
          </div>
        ) : (
          (() => {
            let country_id_str = effective_countries.map((arg0_c) => arg0_c.properties.name).join('_') || (country_stats ? country_stats.name : 'all')
            let derived_key = `${raster_key ?? ''}-${raster ? `${raster.width}x${raster.height}-${raster.min}-${raster.max}` : 'none'}-${country_id_str}-${active_layer?.id ?? 'default'}`
            return (
              <>
                {active_tab === 'pyramid' && (
                  <PopulationPyramidChart
                    key={`pyramid-${derived_key}-${current_year}`}
                    raster={raster}
                    countryStats={country_stats}
                    selectedCountries={effective_countries}
                    selectedCountry={selected_country}
                    currentYear={current_year}
                    activeVariableSelectors={active_variable_selectors}
                    inspectData={inspect_data}
                  />
                )}

                {active_tab === 'breakdown' && (
                  <CategoryBreakdownChart
                    key={`breakdown-${derived_key}-${current_year}`}
                    raster={raster}
                    countryStats={country_stats}
                    selectedCountries={effective_countries}
                    selectedCountry={selected_country}
                    currentYear={current_year}
                    layerId={active_layer?.id}
                    activeVariableSelectors={active_variable_selectors}
                    inspectData={inspect_data}
                  />
                )}

                {active_tab === 'histogram' && (
                  <HistogramChart
                    key={`hist-${derived_key}`}
                    raster={raster}
                    scaleType={scale_type}
                    logSigma={log_sigma}
                    minOverride={min_override}
                    maxOverride={max_override}
                    countryStats={country_stats}
                  />
                )}

                {active_tab === 'stats' && (
                  <div className="h-full w-full p-[var(--padding)] overflow-y-auto">
                    <StatsSummary key={`stats-${derived_key}`} raster={raster} countryStats={country_stats} />
                  </div>
                )}
              </>
            )
          })()
        )}
      </div>
    </div>
  )
}

export default AnalyticsDrawer
