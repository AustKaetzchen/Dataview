import React, { useMemo } from 'react'
import { StadesterConfig } from '@/lib/geopng/types'
import { Icon } from '@/components/ui/icon'

export interface StadesterLegendCardProps {
  config: StadesterConfig
  settlementCount?: number
  width?: number | string
}

const REGION_CHIPS = [
  { name: 'East Asia', colour: '#ef4444' },
  { name: 'Europe', colour: '#6366f1' },
  { name: 'Africa', colour: '#f97316' },
  { name: 'N. America', colour: '#0ea5e9' },
  { name: 'Latin America', colour: '#10b981' },
  { name: 'Mid East', colour: '#eab308' },
  { name: 'S. Asia', colour: '#ec4899' },
  { name: 'Oceania', colour: '#14b8a6' },
]

/**
 * Information card displayed beneath the main colourbar whenever Stadestér Historical Settlements is toggled on.
 * Informs the user of what metric is displaying, active colour scheme, gradient scale stops, and bubble sizing parameters.
 *
 * @param {StadesterLegendCardProps} arg0_props
 *
 * @returns {React.ReactElement}
 */
export const StadesterLegendCard: React.FC<StadesterLegendCardProps> = function (arg0_props) {
  //Convert from parameters
  let props = (arg0_props) ? arg0_props : ({} as StadesterLegendCardProps)
  let config = props.config
  let settlement_count = props.settlementCount
  let width = props.width ?? 336

  //Declare local instance variables
  let bubble_size = (config.bubbleSize !== undefined) ? config.bubbleSize : 1
  let colour_mode = config.colorMode || 'growth'
  let dataset_version = (config.dataset === 'stadester_1.0') ? 'Stadestér 1.0' : 'Stadestér 1.1'
  let gradient_style: string
  let growth_palette = config.growthPalette || 'Rainbow'
  let is_halo = config.halo !== false && !config.filled
  let metric_subtitle: string
  let metric_title: string
  let palette_label: string

  //Function body
  if (colour_mode === 'growth') {
    metric_title = 'Annual Population Growth Rate (%/yr)'
    metric_subtitle = 'Logarithmic CAGR slope between keyframe settlement censuses'
    palette_label = `${growth_palette} (Heat / Cool Spectrum)`
    gradient_style = 'linear-gradient(to right, rgb(93, 96, 226), rgb(72, 156, 240), rgb(69, 207, 119), rgb(198, 219, 85), rgb(253, 224, 71), rgb(251, 146, 60), rgb(239, 68, 68), rgb(232, 121, 249))'
  } else if (colour_mode === 'population') {
    metric_title = 'Settlement Population'
    metric_subtitle = 'Continuous logarithmic population domain (5k to 10M+)'
    palette_label = 'Logarithmic Scale (Blue to Warm Gold)'
    gradient_style = 'linear-gradient(to right, rgb(13, 8, 135), rgb(80, 18, 170), rgb(140, 41, 129), rgb(200, 72, 73), rgb(245, 125, 21), rgb(240, 249, 33))'
  } else {
    metric_title = 'World Continental Macro-Region'
    metric_subtitle = 'Categorical grouping by global geographical region'
    palette_label = 'Continental Categorical Palette'
    gradient_style = ''
  }

  //Return statement
  return (
    <div
      id="dataview-stadester-legend-card"
      style={{ width: (typeof width === 'number') ? `${width}px` : width }}
      className="relative rounded-none border border-border bg-card/95 backdrop-blur-md p-[var(--padding)] pb-2.5 shadow-lg text-[var(--body-font-size)] text-card-foreground select-none font-sans"
    >
      {/* Header: Title, Dataset Tag, and Rendered Count */}
      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border/50 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon name="location_city" className="text-primary text-xs shrink-0" />
          <span className="font-bold text-white text-xs truncate">Stadestér Settlements</span>
          <span className="text-[10px] px-1 py-0.2 bg-muted text-muted-foreground border border-border shrink-0 font-mono">
            {dataset_version}
          </span>
        </div>

        {settlement_count !== undefined && (
          <span className="text-[10px] px-1.5 py-0.2 bg-primary/20 text-white font-bold border border-primary/40 shrink-0 font-mono">
            {settlement_count.toLocaleString('de-DE')} cities
          </span>
        )}
      </div>

      {/* Metric Display Information */}
      <div className="flex flex-col gap-0.5 mb-2">
        <div className="flex items-center justify-between gap-1 text-[11px]">
          <span className="text-muted-foreground">Displaying:</span>
          <span className="font-semibold text-white truncate text-right">{metric_title}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/80 font-light leading-tight">
          {metric_subtitle}
        </p>
      </div>

      {/* Colour Scheme Information & Gradient Bar */}
      <div className="space-y-1 mb-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Colour Scheme:</span>
          <span className="font-mono text-[10px] text-primary">{palette_label}</span>
        </div>

        {colour_mode === 'continent' ? (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {REGION_CHIPS.map((chip) => (
              <span
                key={chip.name}
                className="flex items-center gap-1 text-[9px] px-1 py-0.5 bg-background border border-border text-white"
              >
                <span className="w-1.5 h-1.5 rounded-none shrink-0" style={{ backgroundColor: chip.colour }} />
                {chip.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            <div
              className="h-3 w-full border border-border/80 shadow-inner"
              style={{ background: gradient_style }}
            />
            {colour_mode === 'growth' ? (
              <div className="flex justify-between items-center text-[9px] text-muted-foreground font-mono">
                <span>&le; -5%/yr (Loss)</span>
                <span className="text-white font-bold">0%/yr (Stable)</span>
                <span>&ge; +8%/yr (Surge)</span>
              </div>
            ) : (
              <div className="flex justify-between items-center text-[9px] text-muted-foreground font-mono">
                <span>5.000 (Small)</span>
                <span className="text-white font-bold">500.000</span>
                <span>10.000.000+ (Megacity)</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bubble Geometry & Collision Status Footer */}
      <div className="pt-1.5 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
        <span>Radius &prop; &radic;pop (min 4,5px &bull; {bubble_size.toFixed(2)}x)</span>
        <span className="text-white">
          {is_halo ? 'Halo Ring' : 'Solid Circle'} &bull; {config.showLabels ? 'Labels Active' : 'No Labels'}
        </span>
      </div>
    </div>
  )
}

export default StadesterLegendCard
