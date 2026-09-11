import React, { useState, useEffect, useMemo } from 'react'
import { DecodedRaster, ScaleType } from '@/lib/geopng/types'
import {
  CountryFeature,
  CountryStats,
  loadCountriesGeoJson,
} from '@/lib/geopng/polygonBinning'
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
  countriesMode = false,
  onToggleCountriesMode,
  hoveredCountry,
  countryStats,
}) => {
  const [isOpen, setIsOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'histogram' | 'stats'>('histogram')
  const [allCountries, setAllCountries] = useState<CountryFeature[]>([])

  useEffect(() => {
    loadCountriesGeoJson().then((feats) => {
      const sorted = [...feats].sort((a, b) =>
        (a.properties.name || '').localeCompare(b.properties.name || '')
      )
      setAllCountries(sorted)
    })
  }, [])

  const getCountryCode = (c: CountryFeature) => {
    const iso = c.properties.iso_a3
    if (iso && iso !== '-99') return iso
    return c.properties.adm0_a3 || c.properties.name || ''
  }

  const selectedCountryKey = useMemo(() => {
    if (!selectedCountry) return ''
    return getCountryCode(selectedCountry)
  }, [selectedCountry])

  return (
    <div
      className={`absolute bottom-0 right-4 z-30 w-[740px] max-w-[calc(100vw-340px)] transition-all duration-200 ease-in-out ${
        isOpen ? 'h-68' : 'h-8'
      } bg-card/95 backdrop-blur-md border-t border-x border-border rounded-t-[5px] text-card-foreground shadow-2xl flex flex-col font-sans`}
    >
      {/* Drawer Header */}
      <div className="h-8 px-3.5 flex items-center justify-between border-b border-border select-none gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 shrink-0">
            <Icon name="bar_chart" size="1rem" className="text-white" />
            <span>Raster Analytics</span>
          </span>

          {isOpen && (
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-[3px] shrink-0">
              <button
                onClick={() => setActiveTab('histogram')}
                className={`px-2 py-0.5 text-xs font-medium rounded-[3px] transition-colors flex items-center gap-1 cursor-pointer ${
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
                className={`px-2 py-0.5 text-xs font-medium rounded-[3px] transition-colors flex items-center gap-1 cursor-pointer ${
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

          {/* Countries Mode Toggle Button */}
          {isOpen && (
            <button
              type="button"
              onClick={() => onToggleCountriesMode && onToggleCountriesMode(!countriesMode)}
              className={`h-6 px-2 text-[11px] font-medium rounded-[3px] transition-colors flex items-center gap-1.5 cursor-pointer border shrink-0 ${
                countriesMode
                  ? 'bg-primary/20 text-primary border-primary/50 shadow-sm font-semibold'
                  : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-input'
              }`}
              title="Toggle Countries Mode: When active, hover over any country on the map to inspect its live statistics and distribution"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  countriesMode ? 'bg-primary animate-pulse' : 'bg-muted-foreground/60'
                }`}
              />
              <span>Countries Mode</span>
            </button>
          )}

          {/* If Countries Mode is active: show real-time hover readout */}
          {isOpen && countriesMode && (
            <div className="flex items-center gap-1 min-w-0">
              {hoveredCountry ? (
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/80 text-foreground font-medium border border-border text-[11px] truncate max-w-[170px]">
                  <span className="text-primary font-bold text-[10px]">●</span>
                  <span className="text-muted-foreground text-[10px]">Hover:</span>
                  <span className="font-semibold truncate">{hoveredCountry.properties.name}</span>
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground italic truncate">
                  Hover country on map
                </span>
              )}
            </div>
          )}

          {/* If Countries Mode is OFF: show manual Country Dropdown & Clear Pill */}
          {isOpen && !countriesMode && (
            <div className="flex items-center gap-1.5 min-w-0">
              <select
                aria-label="Filter raster statistics by country"
                value={selectedCountryKey}
                onChange={(e) => {
                  const val = e.target.value
                  if (!val) {
                    if (onSelectCountry) onSelectCountry(null)
                    return
                  }
                  const match = allCountries.find((c) => getCountryCode(c) === val)
                  if (match && onSelectCountry) onSelectCountry(match)
                }}
                className="h-6 px-1.5 py-0 text-[11px] bg-background border border-input rounded-[3px] text-foreground focus:outline-none cursor-pointer max-w-[130px] truncate"
              >
                <option value="">Global (All)</option>
                {allCountries.map((c, idx) => {
                  const code = getCountryCode(c) || `country-${idx}`
                  return (
                    <option key={`${code}-${idx}`} value={code}>
                      {c.properties.name}
                    </option>
                  )
                })}
              </select>

              {selectedCountry && onSelectCountry && (
                <button
                  type="button"
                  onClick={() => onSelectCountry(null)}
                  className="px-1.5 py-0.5 text-[10px] rounded bg-muted hover:bg-muted/80 text-foreground flex items-center gap-1 cursor-pointer border border-border shrink-0"
                  title="Clear country filter and return to global"
                >
                  <span className="font-semibold text-primary">●</span>
                  <span className="truncate max-w-[80px]">{selectedCountry.properties.name}</span>
                  <span className="opacity-70 hover:opacity-100 font-bold">✕</span>
                </button>
              )}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-white hover:text-white flex items-center gap-1 px-1.5 shrink-0"
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
      {isOpen && (
        <div className="flex-1 p-3 overflow-hidden bg-background/50">
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
                <div className="h-full flex items-center justify-center p-2">
                  <div className="w-full max-w-4xl">
                    <StatsSummary raster={raster} countryStats={countryStats} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default AnalyticsDrawer
