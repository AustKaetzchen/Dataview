import React, { useState, useEffect } from 'react'
import { DecodedRaster, ScaleType } from '@/lib/geopng/types'
import { CountryFeature, CountryStats } from '@/lib/geopng/polygonBinning'
import { getAnalyticsPanelRightOffset, UI_LAYOUT } from '@/lib/uiLayout'
import { HistogramChart } from './HistogramChart'
import { StatsSummary } from './StatsSummary'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'

interface AnalyticsDrawerProps {
  isOpen: boolean
  onToggleOpen: () => void
  raster: DecodedRaster | null
  scaleType: ScaleType
  logSigma: number
  minOverride?: number
  maxOverride?: number
  selectedCountry?: CountryFeature | null
  selectedCountries?: CountryFeature[]
  onSelectCountry?: (country: CountryFeature | null) => void
  onClearCountries?: () => void
  countryStats?: CountryStats | null
  isSettingsDrawerOpen?: boolean
}

export const AnalyticsDrawer: React.FC<AnalyticsDrawerProps> = ({
  isOpen,
  onToggleOpen,
  raster,
  scaleType,
  logSigma,
  minOverride,
  maxOverride,
  selectedCountry,
  selectedCountries,
  onSelectCountry,
  onClearCountries,
  countryStats,
  isSettingsDrawerOpen = false,
}) => {
  const [activeTab, setActiveTab] = useState<'histogram' | 'stats'>('histogram')
  const rightOffset = getAnalyticsPanelRightOffset(isSettingsDrawerOpen)

  // Staggered resize events when opening panel to notify ECharts
  useEffect(() => {
    if (isOpen) {
      const t1 = setTimeout(() => window.dispatchEvent(new Event('resize')), 50)
      const t2 = setTimeout(() => window.dispatchEvent(new Event('resize')), 200)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
  }, [isOpen, rightOffset])

  if (!isOpen) return null

  const effectiveCountries =
    selectedCountries && selectedCountries.length > 0
      ? selectedCountries
      : selectedCountry
        ? [selectedCountry]
        : []

  const handleClear = () => {
    if (onClearCountries) {
      onClearCountries()
    } else if (onSelectCountry) {
      onSelectCountry(null)
    }
  }

  return (
    <div
      onTransitionEnd={() => {
        window.dispatchEvent(new Event('resize'))
      }}
      style={{
        top: `${UI_LAYOUT.margin}px`,
        right: `${rightOffset}px`,
      }}
      className="absolute z-30 w-[640px] max-w-[calc(100vw-720px)] h-[340px] bg-card/95 backdrop-blur-md border border-border rounded-none text-card-foreground shadow-2xl flex flex-col font-sans transition-all duration-200 ease-out animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {/* Panel Header */}
      <div className="h-[var(--navbar-height)] px-[var(--padding)] flex items-center justify-between border-b border-border select-none gap-[var(--padding)] bg-card/90">
        <div className="flex items-center gap-[var(--padding)] min-w-0">
          <span className="text-[var(--header-font-size)] font-bold text-foreground flex items-center gap-1.5 shrink-0">
            <Icon name="bar_chart" />
            <span>Raster Calculator</span>
          </span>

          <div className="flex items-center gap-1 bg-muted p-[var(--cell-padding)] rounded-none shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('histogram')}
              className={`px-2 py-0.5 text-[var(--body-font-size)] rounded-none transition-colors flex items-center gap-1.5 cursor-pointer ${activeTab === 'histogram'
                  ? 'bg-background text-foreground shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground font-light'
                }`}
            >
              <Icon name="bar_chart" className="text-white" />
              Distribution
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('stats')}
              className={`px-2 py-0.5 text-[var(--body-font-size)] rounded-none transition-colors flex items-center gap-1.5 cursor-pointer ${activeTab === 'stats'
                  ? 'bg-background text-foreground shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground font-light'
                }`}
            >
              <Icon name="info" className="text-white" />
              Statistics
            </button>
          </div>

          {/* Active country filter badge */}
          {effectiveCountries.length > 0 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-none bg-primary/15 text-primary text-[var(--body-font-size)] font-medium border border-primary/30 truncate">
              <span className="w-1.5 h-1.5 rounded-none bg-primary shrink-0" />
              <span className="truncate max-w-[140px]">
                {effectiveCountries.length === 1
                  ? effectiveCountries[0].properties.name
                  : `${effectiveCountries[0].properties.name} (+${effectiveCountries.length - 1})`}
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="ml-0.5 hover:text-foreground opacity-70 hover:opacity-100 cursor-pointer text-xs rounded-none"
                title="Clear country filter"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 rounded-none text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={onToggleOpen}
          title="Close Analytics Panel"
        >
          <Icon name="close" className="text-white" />
        </Button>
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
        ) : (
          <>
            {activeTab === 'histogram' && (
              <HistogramChart
                raster={raster}
                scaleType={scaleType}
                logSigma={logSigma}
                minOverride={minOverride}
                maxOverride={maxOverride}
                countryStats={countryStats}
              />
            )}

            {activeTab === 'stats' && (
              <div className="h-full w-full p-[var(--padding)] overflow-y-auto">
                <StatsSummary raster={raster} countryStats={countryStats} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AnalyticsDrawer
