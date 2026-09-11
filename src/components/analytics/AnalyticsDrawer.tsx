import React, { useState, useEffect } from 'react'
import { DecodedRaster, ScaleType } from '@/lib/geopng/types'
import { CountryFeature, CountryStats } from '@/lib/geopng/polygonBinning'
import { HistogramChart } from './HistogramChart'
import { StatsSummary } from './StatsSummary'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'

interface AnalyticsDrawerProps {
  raster: DecodedRaster | null
  scaleType: ScaleType
  logSigma: number
  minOverride?: number
  maxOverride?: number
  selectedCountry?: CountryFeature | null
  onSelectCountry?: (country: CountryFeature | null) => void
  countriesMode?: boolean
  onToggleCountriesMode?: (enabled: boolean) => void
  hoveredCountry?: CountryFeature | null
  countryStats?: CountryStats | null
}

export const AnalyticsDrawer: React.FC<AnalyticsDrawerProps> = ({
  raster,
  scaleType,
  logSigma,
  minOverride,
  maxOverride,
  selectedCountry,
  onSelectCountry,
  countryStats,
}) => {
  const [isOpen, setIsOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'histogram' | 'stats'>('histogram')

  // Staggered resize events when opening drawer to synchronize with 200ms height transition
  useEffect(() => {
    if (isOpen) {
      const t1 = setTimeout(() => window.dispatchEvent(new Event('resize')), 60)
      const t2 = setTimeout(() => window.dispatchEvent(new Event('resize')), 220)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
  }, [isOpen])

  return (
    <div
      onTransitionEnd={() => {
        window.dispatchEvent(new Event('resize'))
      }}
      className={`absolute bottom-0 right-4 z-30 w-[740px] max-w-[calc(100vw-340px)] transition-all duration-200 ease-in-out ${
        isOpen ? 'h-68' : 'h-8'
      } bg-card/95 backdrop-blur-md border-t border-x border-border rounded-t-[5px] text-card-foreground shadow-2xl flex flex-col font-sans`}
    >
      {/* Drawer Header - Clean, spacious, and uncompressed */}
      <div className="h-8 px-3.5 flex items-center justify-between border-b border-border select-none gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 shrink-0">
            <Icon name="bar_chart" size="1rem" className="text-white" />
            <span>Raster Analytics</span>
          </span>

          {isOpen && (
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-[3px] shrink-0">
              <button
                onClick={() => setActiveTab('histogram')}
                className={`px-2.5 py-0.5 text-xs font-medium rounded-[3px] transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'histogram'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name="bar_chart" size="0.85rem" className="text-white" />
                Distribution
              </button>

              <button
                onClick={() => setActiveTab('stats')}
                className={`px-2.5 py-0.5 text-xs font-medium rounded-[3px] transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'stats'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name="info" size="0.85rem" className="text-white" />
                Statistics
              </button>
            </div>
          )}

          {/* If a country filter is active, show an unobtrusive badge with clear button */}
          {isOpen && selectedCountry && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-medium border border-primary/30 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              <span className="truncate max-w-[140px]">{selectedCountry.properties.name}</span>
              {onSelectCountry && (
                <button
                  type="button"
                  onClick={() => onSelectCountry(null)}
                  className="ml-0.5 hover:text-foreground opacity-70 hover:opacity-100 cursor-pointer text-[10px]"
                  title="Clear country filter"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-white hover:text-white flex items-center gap-1 px-2 shrink-0 cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? (
            <>
              <span>Collapse</span>
              <Icon name="expand_more" size="1rem" className="text-white" />
            </>
          ) : (
            <>
              <span>Expand Analytics</span>
              <Icon name="expand_less" size="1rem" className="text-white" />
            </>
          )}
        </Button>
      </div>

      {/* Drawer Content */}
      <div
        className={`flex-1 p-3 overflow-hidden bg-background/50 flex flex-col min-h-0 ${
          isOpen ? 'block' : 'hidden'
        }`}
      >
        {!raster ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs space-y-1">
            <Icon name="upload_file" size="1.5rem" className="text-white/60 mb-1" />
            <span>No GeoPNG raster loaded.</span>
            <span className="text-[11px] text-muted-foreground/70">
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
                <div className="w-full max-w-4xl">
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
