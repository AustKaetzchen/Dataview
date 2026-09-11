import React, { useState, useEffect } from 'react'
import { DecodedRaster, ScaleType } from '@/lib/geopng/types'
import { CountryFeature, CountryStats } from '@/lib/geopng/polygonBinning'
import { getAnalyticsPanelRightOffset } from '@/lib/uiLayout'
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
      style={{ right: `${rightOffset}px` }}
      className="absolute top-4 z-30 w-[620px] max-w-[calc(100vw-720px)] h-[320px] bg-card/95 backdrop-blur-md border border-border rounded-none text-card-foreground shadow-2xl flex flex-col font-sans transition-all duration-200 ease-out animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {/* Panel Header */}
      <div className="h-8 px-3 flex items-center justify-between border-b border-border select-none gap-2 bg-card/90">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 shrink-0">
            <Icon name="bar_chart" size="0.95rem" />
            <span>Raster Analytics</span>
          </span>

          <div className="flex items-center gap-1 bg-muted p-0.5 rounded-none shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('histogram')}
              className={`px-2 py-0.5 text-xs font-medium rounded-none transition-colors flex items-center gap-1 cursor-pointer ${
                activeTab === 'histogram'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="bar_chart" size="0.8rem" className="text-white" />
              Distribution
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('stats')}
              className={`px-2 py-0.5 text-xs font-medium rounded-none transition-colors flex items-center gap-1 cursor-pointer ${
                activeTab === 'stats'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="info" size="0.8rem" className="text-white" />
              Statistics
            </button>
          </div>

          {/* Active country filter badge */}
          {effectiveCountries.length > 0 && (
            <div className="flex items-center gap-1 px-1.5 py-0.2 rounded-none bg-primary/15 text-primary text-[10px] font-medium border border-primary/30 truncate">
              <span className="w-1.5 h-1.5 rounded-none bg-primary shrink-0" />
              <span className="truncate max-w-[140px]">
                {effectiveCountries.length === 1
                  ? effectiveCountries[0].properties.name
                  : `${effectiveCountries[0].properties.name} (+${effectiveCountries.length - 1})`}
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="ml-0.5 hover:text-foreground opacity-70 hover:opacity-100 cursor-pointer text-[9px]"
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
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
          onClick={onToggleOpen}
          title="Close Analytics Panel"
        >
          <Icon name="close" size="0.9rem" className="text-white" />
        </Button>
      </div>

      {/* Panel Body */}
      <div className="flex-1 p-2.5 overflow-hidden bg-background/50 flex flex-col min-h-0">
        {!raster ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs space-y-1">
            <Icon name="upload_file" size="1.4rem" className="text-white/60 mb-1" />
            <span>No GeoPNG raster loaded.</span>
            <span className="text-[10px] text-muted-foreground/70">
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
              <div className="h-full flex items-center justify-center p-2 overflow-y-auto">
                <div className="w-full">
                  <StatsSummary raster={raster} countryStats={countryStats} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default AnalyticsDrawer
