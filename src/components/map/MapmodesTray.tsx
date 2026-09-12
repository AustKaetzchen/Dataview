import React, { useState, useMemo } from 'react'
import {
  MapModeItem,
  MapModeId,
  HeightmapConfig,
  CircleOverlayConfig,
} from '@/lib/geopng/types'
import { CountryFeature, CountryStats } from '@/lib/geopng/polygonBinning'
import { Icon } from '@/components/ui/icon'
import { Slider } from '@/components/ui/slider'
import { MAPMODES_CONFIG, LOCALISATION_CONFIG } from '@config'
import { pseudoLogTransform, inversePseudoLogTransform } from '@/lib/geopng/scales'

interface MapmodesTrayProps {
  mapModes: MapModeItem[]
  onToggleMapMode: (id: MapModeId) => void
  onReorderMapModes: (newModes: MapModeItem[]) => void
  countriesMode: boolean
  onToggleCountriesMode?: (enabled: boolean) => void
  selectedCountries: CountryFeature[]
  onToggleCountry: (country: CountryFeature) => void
  onClearCountries: () => void
  countryStats?: CountryStats | null
  isCalculatingStats?: boolean
  heightmapConfig: HeightmapConfig
  setHeightmapConfig: React.Dispatch<React.SetStateAction<HeightmapConfig>>
  cameraTilt?: number
  onSetCameraTilt?: (tilt: number) => void
  circleOverlayConfig: CircleOverlayConfig
  setCircleOverlayConfig: React.Dispatch<React.SetStateAction<CircleOverlayConfig>>
  allCountries: CountryFeature[]
}

const MAX_PERCENTILE_STRENGTH = 10.0
const PERCENTILE_STRENGTH_SIGMA = 0.5
const T_MAX_PERCENTILE = pseudoLogTransform(MAX_PERCENTILE_STRENGTH, PERCENTILE_STRENGTH_SIGMA)

function strengthToSliderPos(strength: number): number {
  const clamped = Math.max(0, Math.min(MAX_PERCENTILE_STRENGTH, strength))
  const t = pseudoLogTransform(clamped, PERCENTILE_STRENGTH_SIGMA)
  const norm = t / T_MAX_PERCENTILE
  return Math.round(Math.max(0, Math.min(100, norm * 100)))
}

function sliderPosToStrength(pos: number): number {
  const norm = Math.max(0, Math.min(100, pos)) / 100
  const y = norm * T_MAX_PERCENTILE
  const strength = inversePseudoLogTransform(y, PERCENTILE_STRENGTH_SIGMA)
  return Math.max(0, Math.min(MAX_PERCENTILE_STRENGTH, Math.round(strength * 100) / 100))
}

export const MapmodesTray: React.FC<MapmodesTrayProps> = ({
  mapModes,
  onToggleMapMode,
  onReorderMapModes,
  countriesMode,
  onToggleCountriesMode,
  selectedCountries,
  onToggleCountry,
  onClearCountries,
  countryStats,
  isCalculatingStats,
  heightmapConfig,
  setHeightmapConfig,
  cameraTilt,
  onSetCameraTilt,
  circleOverlayConfig,
  setCircleOverlayConfig,
  allCountries,
}) => {
  // Currently expanded mapmode settings panel (null if all collapsed)
  const [expandedMode, setExpandedMode] = useState<MapModeId | null>(null)
  const [countrySearch, setCountrySearch] = useState('')
  const [mapmodeSearch, setMapmodeSearch] = useState('')

  const getCountryCode = (c: CountryFeature) => {
    const iso = c.properties.iso_a3
    if (iso && iso !== '-99') return iso
    return c.properties.adm0_a3 || c.properties.name || ''
  }

  // Filtered countries for checklist
  const filteredCountries = useMemo(() => {
    const q = countrySearch.toLowerCase().trim()
    if (!q) return allCountries
    return allCountries.filter((c) => {
      const name = (c.properties.name || '').toLowerCase()
      const code = getCountryCode(c).toLowerCase()
      return name.includes(q) || code.includes(q)
    })
  }, [allCountries, countrySearch])

  const selectedCountryCodeSet = useMemo(() => {
    return new Set(selectedCountries.map(getCountryCode))
  }, [selectedCountries])

  const toggleExpand = (id: MapModeId) => {
    setExpandedMode((prev) => (prev === id ? null : id))
  }

  // Filtered mapmodes based on search
  const filteredMapModes = useMemo(() => {
    const q = mapmodeSearch.toLowerCase().trim()
    if (!q) return mapModes
    return mapModes.filter((m) => m.label.toLowerCase().includes(q))
  }, [mapModes, mapmodeSearch])

  return (
    <div className="absolute bottom-[var(--padding)] right-[var(--padding)] z-20 w-80 max-h-[calc(100vh-140px)] flex flex-col bg-card/98 backdrop-blur-md border border-border shadow-2xl p-[var(--padding)] space-y-[var(--padding)] text-[var(--body-font-size)] select-none font-sans overflow-hidden">
      {/* Tray Header */}
      <div className="flex items-center justify-between border-b border-border pb-[var(--cell-padding)] shrink-0">
        <span className="font-bold text-foreground text-[var(--header-font-size)] flex items-center gap-2">
          <Icon name="layers" />
          <span>{LOCALISATION_CONFIG.mapmodes.title}</span>
        </span>
        <span className="text-[var(--body-font-size)] px-2 py-0.5 bg-muted text-muted-foreground border border-border font-medium">
          {mapModes.filter((m) => m.active).length} {LOCALISATION_CONFIG.mapmodes.activeSuffix}
        </span>
      </div>

      {/* Mapmodes Searchbar */}
      <div className="relative shrink-0">
        <Icon
          name="search"
          className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          type="text"
          value={mapmodeSearch}
          onChange={(e) => setMapmodeSearch(e.target.value)}
          placeholder={LOCALISATION_CONFIG.mapmodes.searchPlaceholder}
          className="w-full pl-7 pr-7 py-1 text-[var(--body-font-size)] bg-background/70 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary rounded-none"
        />
        {mapmodeSearch && (
          <button
            type="button"
            onClick={() => setMapmodeSearch('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--body-font-size)] text-muted-foreground hover:text-foreground cursor-pointer px-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* Composable Mode Items Stack */}
      <div className="space-y-1 overflow-y-auto max-h-[50vh] pr-0.5">
        {filteredMapModes.length === 0 && (
          <p className="text-[var(--body-font-size)] text-muted-foreground italic py-2 text-center">
            {LOCALISATION_CONFIG.mapmodes.noResults}
          </p>
        )}
        {filteredMapModes.map((mode) => {
          const index = mapModes.findIndex((m) => m.id === mode.id)
          const isExpanded = expandedMode === mode.id
          const hasSettings = mode.id !== 'default'

          return (
            <div key={mode.id} className="border border-border/80 bg-background/50">
              {/* Row Header */}
              <div
                className={`flex items-center justify-between px-[var(--padding)] py-1.5 transition-colors ${
                  mode.active
                    ? 'bg-muted/60 text-foreground'
                    : 'bg-background/40 text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={mode.active}
                    onChange={() => onToggleMapMode(mode.id)}
                    className="w-[var(--body-font-size)] h-[var(--body-font-size)] rounded-none accent-emerald-500 cursor-pointer shrink-0"
                  />
                  <button
                    type="button"
                    onClick={() => hasSettings && toggleExpand(mode.id)}
                    className="truncate text-[var(--body-font-size)] text-left cursor-pointer flex-1 flex items-center gap-1.5 hover:text-foreground"
                  >
                    <span className={mode.active ? 'font-bold text-foreground' : 'font-light'}>
                      {mode.label}
                    </span>
                    {mode.id === 'country_analysis' && selectedCountries.length > 0 && (
                      <span className="text-[var(--body-font-size)] px-1.5 py-0.2 bg-muted text-muted-foreground border border-border font-medium shrink-0">
                        {selectedCountries.length}
                      </span>
                    )}
                    {mode.id === 'spike_map' && mode.active && (
                      <span className="text-[var(--body-font-size)] px-1.5 py-0.2 bg-muted text-muted-foreground border border-border font-medium shrink-0">
                        {heightmapConfig.opacityByPercentile ? '3D • %' : '3D'}
                      </span>
                    )}
                    {mode.id === 'circle_sizing' && mode.active && (
                      <span className="text-[var(--body-font-size)] px-1.5 py-0.2 bg-muted text-muted-foreground border border-border font-medium shrink-0">
                        P{circleOverlayConfig.percentileCutoff}
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-1">
                  {hasSettings && (
                    <button
                      type="button"
                      onClick={() => toggleExpand(mode.id)}
                      className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Toggle Settings"
                    >
                      <Icon
                        name={isExpanded ? 'expand_less' : 'tune'}
                      />
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => {
                      if (index > 0) {
                        const updated = [...mapModes]
                        const temp = updated[index]
                        updated[index] = updated[index - 1]
                        updated[index - 1] = temp
                        onReorderMapModes(updated)
                      }
                    }}
                    className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <Icon name="arrow_upward" />
                  </button>
                  <button
                    type="button"
                    disabled={index === mapModes.length - 1}
                    onClick={() => {
                      if (index < mapModes.length - 1) {
                        const updated = [...mapModes]
                        const temp = updated[index]
                        updated[index] = updated[index + 1]
                        updated[index + 1] = temp
                        onReorderMapModes(updated)
                      }
                    }}
                    className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <Icon name="arrow_downward" />
                  </button>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* SETTINGS: COUNTRY ANALYSIS */}
              {/* ========================================================================= */}
              {isExpanded && mode.id === 'country_analysis' && (
                <div className="p-[var(--padding)] border-t border-border space-y-2 bg-card/80 animate-in fade-in-0 duration-100">
                  <div className="flex items-center justify-between pb-1 border-b border-border/60">
                    <span className="text-[var(--body-font-size)] font-bold text-foreground flex items-center gap-1.5">
                      <Icon name="flag" />
                      <span>Country Analysis Settings</span>
                    </span>
                    {selectedCountries.length > 0 && (
                      <div className="flex items-center gap-2">
                        {isCalculatingStats && (
                          <span className="text-[10px] text-amber-400 font-medium animate-pulse">
                            Calculating stats...
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={onClearCountries}
                          className="text-[var(--body-font-size)] text-destructive hover:underline cursor-pointer"
                        >
                          Clear all ({selectedCountries.length})
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bitmap Isolation Mode Toggle */}
                  <div className="flex items-center justify-between p-[var(--cell-padding)] bg-background border border-border">
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground text-[var(--body-font-size)]">
                        Bitmap Isolation Mode
                      </span>
                      <span className="text-[var(--body-font-size)] text-muted-foreground font-light">
                        Clip raster pixels strictly to selected countries
                      </span>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={countriesMode}
                        onChange={(e) => onToggleCountriesMode && onToggleCountriesMode(e.target.checked)}
                        className="w-[var(--body-font-size)] h-[var(--body-font-size)] rounded-none accent-emerald-500 cursor-pointer"
                      />
                      <span
                        className={`text-[var(--body-font-size)] font-bold uppercase ${
                          countriesMode ? 'text-emerald-400' : 'text-muted-foreground'
                        }`}
                      >
                        {countriesMode ? 'ON' : 'OFF'}
                      </span>
                    </label>
                  </div>

                  {/* Country Search */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Filter country by name or ISO..."
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      className="w-full h-7 px-2 text-[var(--body-font-size)] bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    />
                    {countrySearch && (
                      <button
                        type="button"
                        onClick={() => setCountrySearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-[var(--body-font-size)] cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Scrollable Checklist */}
                  <div className="h-32 overflow-y-auto border border-border bg-background/50 divide-y divide-border/40 text-[var(--body-font-size)]">
                    {filteredCountries.length === 0 ? (
                      <div className="p-2 text-center text-muted-foreground text-[var(--body-font-size)]">
                        No matching countries
                      </div>
                    ) : (
                      filteredCountries.map((c) => {
                        const code = getCountryCode(c)
                        const isChecked = selectedCountryCodeSet.has(code)
                        return (
                          <label
                            key={code || c.properties.name}
                            className="flex items-center gap-2 px-2 py-1 hover:bg-muted/50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => onToggleCountry(c)}
                              className="w-[var(--body-font-size)] h-[var(--body-font-size)] rounded-none accent-emerald-500 cursor-pointer shrink-0"
                            />
                            <span className="truncate flex-1 text-foreground">
                              {c.properties.name}
                            </span>
                            {c.properties.iso_a3 && c.properties.iso_a3 !== '-99' && (
                              <span className="text-[var(--body-font-size)] text-muted-foreground">
                                {c.properties.iso_a3}
                              </span>
                            )}
                          </label>
                        )
                      })
                    )}
                  </div>

                  {/* Selected Country Pills */}
                  {selectedCountries.length > 0 && (
                    <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pt-1">
                      {selectedCountries.map((c) => (
                        <span
                          key={getCountryCode(c)}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[var(--body-font-size)] bg-primary/20 text-primary border border-primary/40 rounded-none font-medium"
                        >
                          <span className="truncate max-w-[90px]">{c.properties.name}</span>
                          <button
                            type="button"
                            onClick={() => onToggleCountry(c)}
                            className="hover:text-foreground opacity-70 hover:opacity-100 cursor-pointer"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Country Stats Summary */}
                  {countryStats && countryStats.validCount > 0 && (
                    <div className="p-[var(--cell-padding)] bg-background border border-border text-[var(--body-font-size)] space-y-1">
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span className="truncate font-bold">{countryStats.name}:</span>
                        <span className="text-foreground font-semibold">
                          {countryStats.validCount.toLocaleString()} cells
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Range:</span>
                        <span className="text-foreground font-light">
                          {countryStats.min.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} → {countryStats.max.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Mean:</span>
                        <span className="text-foreground font-light">
                          {countryStats.mean.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-muted-foreground">
                        <span>Total:</span>
                        <span className="text-foreground font-bold">
                          {(countryStats.total ?? countryStats.mean * countryStats.validCount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================================= */}
              {/* SETTINGS: 3D SPIKE MAP */}
              {/* ========================================================================= */}
              {isExpanded && mode.id === 'spike_map' && (
                <div className="p-[var(--padding)] border-t border-border space-y-[var(--padding)] bg-card/80 animate-in fade-in-0 duration-100">
                  <div className="flex items-center justify-between pb-1 border-b border-border/60">
                    <span className="text-[var(--body-font-size)] font-bold text-foreground flex items-center gap-1.5">
                      <Icon name="view_in_ar" />
                      <span>3D Spike Map Settings</span>
                    </span>
                  </div>

                  {/* Spike Height Scale */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[var(--body-font-size)]">
                      <span className="text-muted-foreground">Spike Height Scale</span>
                      <span className="text-foreground font-bold">
                        {(heightmapConfig.elevationScale / 1000).toFixed(0)} km
                      </span>
                    </div>
                    <Slider
                      value={[heightmapConfig.elevationScale]}
                      min={50000}
                      max={2500000}
                      step={25000}
                      onValueChange={(vals) =>
                        setHeightmapConfig((prev) => ({ ...prev, elevationScale: vals[0] }))
                      }
                    />
                  </div>

                  {/* Camera 3D Tilt / Pitch */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[var(--body-font-size)]">
                      <span className="text-muted-foreground">Camera Tilt (Pitch)</span>
                      <span className="text-foreground font-bold">
                        {Math.round(cameraTilt ?? 0)}°
                      </span>
                    </div>
                    <Slider
                      value={[Math.round(cameraTilt ?? 0)]}
                      min={0}
                      max={80}
                      step={1}
                      onValueChange={(vals) => onSetCameraTilt?.(vals[0])}
                    />
                  </div>

                  {/* Spikes Transparency / Opacity */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[var(--body-font-size)]">
                      <span className="text-muted-foreground">Spikes Opacity</span>
                      <span className="text-foreground font-bold">
                        {Math.round((heightmapConfig.opacity ?? 0.9) * 100)}%
                      </span>
                    </div>
                    <Slider
                      value={[Math.round((heightmapConfig.opacity ?? 0.9) * 100)]}
                      min={10}
                      max={100}
                      step={5}
                      onValueChange={(vals) =>
                        setHeightmapConfig((prev) => ({ ...prev, opacity: vals[0] / 100 }))
                      }
                    />
                  </div>

                  {/* Opacity Tied to Percentile Toggle */}
                  <div className="pt-1">
                    <label className="flex items-center justify-between gap-2 p-1.5 bg-background/50 border border-border/80 cursor-pointer hover:bg-muted/40 transition-colors">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[var(--body-font-size)] font-medium text-foreground">
                          Opacity by Percentile
                        </span>
                        <span className="text-[10px] text-muted-foreground font-light leading-tight">
                          Tie spike transparency to empirical cell percentile rank
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(heightmapConfig.opacityByPercentile)}
                        onChange={(e) =>
                          setHeightmapConfig((prev) => ({
                            ...prev,
                            opacityByPercentile: e.target.checked,
                          }))
                        }
                        className="w-[var(--body-font-size)] h-[var(--body-font-size)] rounded-none accent-emerald-500 cursor-pointer shrink-0"
                      />
                    </label>

                    {/* Adjustable Percentile Opacity Strength Slider with Pseudo-Log Ramp */}
                    {Boolean(heightmapConfig.opacityByPercentile) && (
                      <div className="mt-2 pl-2 border-l-2 border-primary/50 space-y-2 animate-in fade-in-0 duration-150">
                        <div className="flex justify-between items-center text-[var(--body-font-size)]">
                          <span className="text-muted-foreground">Percentile Effect Strength</span>
                          <span className="text-foreground font-bold font-mono">
                            {Math.round((heightmapConfig.opacityByPercentileStrength ?? 1.0) * 100)}%
                            <span className="text-muted-foreground font-normal text-xs ml-1">
                              ({(heightmapConfig.opacityByPercentileStrength ?? 1.0).toFixed(1)}x)
                            </span>
                          </span>
                        </div>
                        <Slider
                          value={[strengthToSliderPos(heightmapConfig.opacityByPercentileStrength ?? 1.0)]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(vals) =>
                            setHeightmapConfig((prev) => ({
                              ...prev,
                              opacityByPercentileStrength: sliderPosToStrength(vals[0]),
                            }))
                          }
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground font-light">
                          <span>Uniform (0%)</span>
                          <span>100% (1.0x)</span>
                          <span>Max (1000% / 10x)</span>
                        </div>

                        {/* Quick preset chips */}
                        <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                          {[
                            { label: '0%', val: 0.0 },
                            { label: '50%', val: 0.5 },
                            { label: '100%', val: 1.0 },
                            { label: '300%', val: 3.0 },
                            { label: '500%', val: 5.0 },
                            { label: '1000%', val: 10.0 },
                          ].map((preset) => {
                            const curr = heightmapConfig.opacityByPercentileStrength ?? 1.0
                            const isSelected = Math.abs(curr - preset.val) < 0.05
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() =>
                                  setHeightmapConfig((prev) => ({
                                    ...prev,
                                    opacityByPercentileStrength: preset.val,
                                  }))
                                }
                                className={`px-1.5 py-0.5 text-[10px] rounded-none border transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                                    : 'bg-background hover:bg-muted text-muted-foreground border-border'
                                }`}
                              >
                                {preset.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-[var(--body-font-size)] text-muted-foreground font-light leading-tight">
                    • Right-click / Ctrl+Drag on map to orbit in 3D perspective across all projections.
                  </p>
                </div>
              )}

              {/* ========================================================================= */}
              {/* SETTINGS: EQUAL-AREA CIRCLE SIZING */}
              {/* ========================================================================= */}
              {isExpanded && mode.id === 'circle_sizing' && (
                <div className="p-[var(--padding)] border-t border-border space-y-[var(--padding)] bg-card/80 animate-in fade-in-0 duration-100">
                  <div className="flex items-center justify-between pb-1 border-b border-border/60">
                    <span className="text-[var(--body-font-size)] font-bold text-foreground flex items-center gap-1.5">
                      <Icon name="scatter_plot" />
                      <span>Circle Sizing Settings</span>
                    </span>
                  </div>

                  {/* Custom Percentile Cutoff */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[var(--body-font-size)]">
                      <span className="text-muted-foreground">Custom Percentile Cutoff</span>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground font-medium">P</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={circleOverlayConfig.percentileCutoff}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value)
                            if (Number.isFinite(val)) {
                              setCircleOverlayConfig((prev) => ({
                                ...prev,
                                percentileCutoff: Math.max(0, Math.min(100, val)),
                              }))
                            }
                          }}
                          className="w-14 h-6 px-1 font-bold text-center bg-background border border-border text-foreground focus:outline-none focus:border-primary text-[var(--body-font-size)]"
                        />
                      </div>
                    </div>

                    {/* Presets */}
                    <div className="grid grid-cols-5 gap-1">
                      {[90, 95, 98, 99, 99.5].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() =>
                            setCircleOverlayConfig((prev) => ({ ...prev, percentileCutoff: p }))
                          }
                          className={`px-1 py-0.5 text-[var(--body-font-size)] border rounded-none text-center cursor-pointer transition-colors ${
                            circleOverlayConfig.percentileCutoff === p
                              ? 'bg-primary text-white font-bold border-accent shadow-sm'
                              : 'bg-background hover:bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          P{p}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Linear Area Expansion Scale */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[var(--body-font-size)]">
                      <span className="text-muted-foreground">Area Scale (1 ha / unit)</span>
                      <span className="text-foreground font-bold">
                        {(circleOverlayConfig.baseRadius || 1.0).toFixed(1)} ha/unit
                      </span>
                    </div>
                    <Slider
                      value={[Math.round((circleOverlayConfig.baseRadius || 1.0) * 10)]}
                      min={1}
                      max={50}
                      step={1}
                      onValueChange={(vals) =>
                        setCircleOverlayConfig((prev) => ({
                          ...prev,
                          baseRadius: vals[0] / 10,
                        }))
                      }
                    />
                  </div>

                  {/* Outline Stroke Width */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[var(--body-font-size)]">
                      <span className="text-muted-foreground">Coloured Outline Stroke</span>
                      <span className="text-foreground font-bold">
                        {circleOverlayConfig.strokeWidth || 2} px
                      </span>
                    </div>
                    <Slider
                      value={[circleOverlayConfig.strokeWidth || 2]}
                      min={1}
                      max={6}
                      step={1}
                      onValueChange={(vals) =>
                        setCircleOverlayConfig((prev) => ({
                          ...prev,
                          strokeWidth: vals[0],
                        }))
                      }
                    />
                  </div>

                  {/* Black Halo Thickness (Default 1px) */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[var(--body-font-size)]">
                      <span className="text-muted-foreground">{LOCALISATION_CONFIG.mapmodes.haloThicknessLabel}</span>
                      <span className="text-foreground font-bold">
                        {circleOverlayConfig.haloWidth ?? 1} {LOCALISATION_CONFIG.mapmodes.haloThicknessUnit}
                      </span>
                    </div>
                    <Slider
                      value={[circleOverlayConfig.haloWidth ?? 1]}
                      min={0}
                      max={6}
                      step={1}
                      onValueChange={(vals) =>
                        setCircleOverlayConfig((prev) => ({
                          ...prev,
                          haloWidth: vals[0],
                        }))
                      }
                    />
                  </div>

                  <p className="text-[var(--body-font-size)] text-muted-foreground font-light leading-tight">
                    {LOCALISATION_CONFIG.mapmodes.haloDescription}
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Tray Footer - Each hint on its own separate line */}
      <div className="pt-[var(--cell-padding)] border-t border-border/80 text-[var(--body-font-size)] text-muted-foreground flex flex-col gap-0.5 shrink-0">
        <span>{LOCALISATION_CONFIG.mapmodes.hintConfigure}</span>
        <span>{LOCALISATION_CONFIG.mapmodes.hintReorder}</span>
      </div>
    </div>
  )
}
