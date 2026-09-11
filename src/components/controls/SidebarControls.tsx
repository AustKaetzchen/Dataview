import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  AppMode,
  DataFormat,
  ScaleType,
  ColorPalette,
  BoundsMode,
  ProjectionType,
} from '@/lib/geopng/types'
import { CountryFeature, CountryStats, loadCountriesGeoJson } from '@/lib/geopng/polygonBinning'
import { D3_COLOR_SCHEMES, getPaletteCssGradient } from '@/lib/geopng/palettes'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'
import { Slider } from '../ui/slider'
import { Input } from '../ui/input'
import { NumberInput } from '../ui/number-input'
import { Label } from '../ui/label'
import { Separator } from '../ui/separator'
import { Icon } from '../ui/icon'

interface SidebarControlsProps {
  appMode: AppMode
  setAppMode: (mode: AppMode) => void
  dataFormat: DataFormat
  setDataFormat: (fmt: DataFormat) => void
  projection: ProjectionType
  setProjection: (p: ProjectionType) => void
  scaleType: ScaleType
  setScaleType: (st: ScaleType) => void
  logSigma: number
  setLogSigma: (s: number) => void
  colorPalette: ColorPalette
  setColorPalette: (p: ColorPalette) => void
  invertPalette: boolean
  setInvertPalette: (inv: boolean) => void
  boundsMode: BoundsMode
  setBoundsMode: (b: BoundsMode) => void
  minValOverride: string
  setMinValOverride: (v: string) => void
  maxValOverride: string
  setMaxValOverride: (v: string) => void
  percentileList: string
  setPercentileList: (p: string) => void
  legendTitle: string
  setLegendTitle: (t: string) => void
  opacity: number
  setOpacity: (o: number) => void
  onFileUpload: (file: File, target: 'single' | 'diff_a' | 'diff_b') => void
  activeFileName?: string
  diffNameA?: string
  diffNameB?: string
  countriesMode?: boolean
  onToggleCountriesMode?: (enabled: boolean) => void
  selectedCountries: CountryFeature[]
  onToggleCountry: (country: CountryFeature) => void
  onClearCountries: () => void
  onSelectAllCountries?: () => void
  hoveredCountry?: CountryFeature | null
  countryStats?: CountryStats | null
}

export const SidebarControls: React.FC<SidebarControlsProps> = ({
  appMode,
  setAppMode,
  dataFormat,
  setDataFormat,
  projection,
  setProjection,
  scaleType,
  setScaleType,
  logSigma,
  setLogSigma,
  colorPalette,
  setColorPalette,
  invertPalette,
  setInvertPalette,
  boundsMode,
  setBoundsMode,
  minValOverride,
  setMinValOverride,
  maxValOverride,
  setMaxValOverride,
  percentileList,
  setPercentileList,
  legendTitle,
  setLegendTitle,
  opacity,
  setOpacity,
  onFileUpload,
  activeFileName,
  diffNameA,
  diffNameB,
  countriesMode = false,
  onToggleCountriesMode,
  selectedCountries,
  onToggleCountry,
  onClearCountries,
  onSelectAllCountries,
  hoveredCountry,
  countryStats,
}) => {
  const [allCountries, setAllCountries] = useState<CountryFeature[]>([])
  const [paletteSearch, setPaletteSearch] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const palettePickerRef = useRef<HTMLDivElement>(null)

  const [countrySearch, setCountrySearch] = useState('')

  useEffect(() => {
    loadCountriesGeoJson().then((feats) => {
      const sorted = [...feats].sort((a, b) =>
        (a.properties.name || '').localeCompare(b.properties.name || '')
      )
      setAllCountries(sorted)
    })
  }, [])

  // Close palette picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (palettePickerRef.current && !palettePickerRef.current.contains(e.target as Node)) {
        setPaletteOpen(false)
      }
    }
    if (paletteOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [paletteOpen])

  const getCountryCode = (c: CountryFeature) => {
    const iso = c.properties.iso_a3
    if (iso && iso !== '-99') return iso
    return c.properties.adm0_a3 || c.properties.name || ''
  }

  // Filtered D3 palettes
  const filteredPalettes = useMemo(() => {
    const q = paletteSearch.toLowerCase().trim()
    if (!q) return D3_COLOR_SCHEMES
    return D3_COLOR_SCHEMES.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    )
  }, [paletteSearch])

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

  return (
    <div className="w-80 h-full flex flex-col bg-card border-r border-border text-card-foreground overflow-y-auto p-4 space-y-4 select-none">
      {/* App Header */}
      <div>
        <h1 className="text-base font-bold tracking-tight text-foreground">GeoPNG Viewer</h1>
        <p className="text-xs text-muted-foreground">4320×2160 • Equirectangular WGS84</p>
      </div>

      <Separator />

      {/* App Mode Tabs (Single Image vs Image Difference) */}
      <Tabs value={appMode} onValueChange={(v) => setAppMode(v as AppMode)}>
        <TabsList className="grid grid-cols-2 w-full rounded-none">
          <TabsTrigger value="Single Image" className="rounded-none">Single Image</TabsTrigger>
          <TabsTrigger value="Image Difference" className="rounded-none">Image Difference</TabsTrigger>
        </TabsList>

        <TabsContent value="Single Image" className="space-y-2 pt-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Select GeoPNG File (.png)</Label>
            <input
              type="file"
              accept=".png"
              id="single-file-upload"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) onFileUpload(e.target.files[0], 'single')
              }}
            />
            <label
              htmlFor="single-file-upload"
              className="flex items-center justify-between w-full h-9 px-2.5 border border-input rounded-none bg-background text-foreground hover:bg-muted/40 cursor-pointer transition-colors"
            >
              <span className="truncate text-xs">
                {activeFileName || 'Upload GeoPNG (.png)...'}
              </span>
              <Icon name="folder_open" className="text-white/80 shrink-0 ml-1.5" />
            </label>
          </div>
        </TabsContent>

        <TabsContent value="Image Difference" className="space-y-2.5 pt-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Select First GeoPNG (A)</Label>
            <input
              type="file"
              accept=".png"
              id="diff-file-a"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) onFileUpload(e.target.files[0], 'diff_a')
              }}
            />
            <label
              htmlFor="diff-file-a"
              className="flex items-center justify-between w-full h-8 px-2.5 border border-input rounded-none bg-background text-foreground hover:bg-muted/40 cursor-pointer transition-colors"
            >
              <span className="truncate text-xs">{diffNameA || 'Choose Image A...'}</span>
              <Icon name="file_upload" className="text-white/80 shrink-0 ml-1.5" />
            </label>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Select Second GeoPNG (B)</Label>
            <input
              type="file"
              accept=".png"
              id="diff-file-b"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) onFileUpload(e.target.files[0], 'diff_b')
              }}
            />
            <label
              htmlFor="diff-file-b"
              className="flex items-center justify-between w-full h-8 px-2.5 border border-input rounded-none bg-background text-foreground hover:bg-muted/40 cursor-pointer transition-colors"
            >
              <span className="truncate text-xs">{diffNameB || 'Choose Image B...'}</span>
              <Icon name="file_upload" className="text-white/80 shrink-0 ml-1.5" />
            </label>
          </div>
        </TabsContent>
      </Tabs>

      <Separator />

      {/* Format & Projection */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Encoding Format</Label>
            <Select value={dataFormat} onValueChange={(v) => setDataFormat(v as DataFormat)}>
              <SelectTrigger className="rounded-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="float32" className="rounded-none">float32</SelectItem>
                <SelectItem value="int32" className="rounded-none">int32</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Spatial Projection</Label>
            <Select value={projection} onValueChange={(v) => setProjection(v as ProjectionType)}>
              <SelectTrigger className="rounded-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                <SelectItem value="Mercator" className="rounded-none">Mercator (ESRI)</SelectItem>
                <SelectItem value="Equirectangular" className="rounded-none">Equirectangular</SelectItem>
                <SelectItem value="Globe" className="rounded-none">Globe</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Scale Transform */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Scale Transformation</Label>
          <Select value={scaleType} onValueChange={(v) => setScaleType(v as ScaleType)}>
            <SelectTrigger className="rounded-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              <SelectItem value="pseudo-log" className="rounded-none">pseudo-log</SelectItem>
              <SelectItem value="linear" className="rounded-none">linear</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Steepness (Pseudo-log Sigma) */}
        {scaleType === 'pseudo-log' && (
          <div className="space-y-2 rounded-none border border-border p-2 bg-muted/20">
            <div className="flex justify-between items-center text-xs">
              <Label htmlFor="steepness-input" className="text-muted-foreground text-xs font-medium cursor-pointer">
                Steepness (Sigma)
              </Label>
              <div className="flex items-center gap-1">
                <NumberInput
                  id="steepness-input"
                  value={logSigma}
                  min={0.0001}
                  step={logSigma >= 100 ? 5 : logSigma >= 10 ? 1 : logSigma >= 1 ? 0.1 : 0.01}
                  onChange={(val) => {
                    const parsed = parseFloat(val)
                    if (!Number.isNaN(parsed) && parsed > 0) {
                      setLogSigma(parsed)
                    }
                  }}
                  containerClassName="h-6 w-24 rounded-none"
                />
              </div>
            </div>

            <Slider
              value={[logSigma]}
              min={0.01}
              max={Math.max(1000, Math.ceil(logSigma * 1.5))}
              step={logSigma >= 100 ? 5 : logSigma >= 10 ? 1 : logSigma >= 1 ? 0.1 : 0.01}
              onValueChange={(vals) => setLogSigma(vals[0])}
            />

            {/* Quick preset pills */}
            <div className="flex items-center justify-between gap-1 pt-0.5">
              {[0.1, 1, 10, 100, 1000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLogSigma(preset)}
                  className={`px-1.5 py-0.5 text-[10px] rounded-none border transition-colors ${
                    Math.abs(logSigma - preset) < 0.001
                      ? 'bg-primary text-primary-foreground border-primary font-bold'
                      : 'bg-background hover:bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Searchable D3 Color Palette Selector with Gradient Preview & Invert Checkbox */}
        <div className="space-y-1.5" ref={palettePickerRef}>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Color Palette (D3)</Label>
            <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={invertPalette}
                onChange={(e) => setInvertPalette(e.target.checked)}
                className="w-3.5 h-3.5 rounded-none accent-primary cursor-pointer"
              />
              <span className="text-[11px] text-muted-foreground">Invert</span>
            </label>
          </div>

          <div className="relative">
            {/* Palette Trigger Button */}
            <button
              type="button"
              onClick={() => setPaletteOpen(!paletteOpen)}
              className="w-full h-8 px-2.5 flex items-center justify-between border border-input rounded-none bg-background text-foreground hover:bg-muted/40 cursor-pointer transition-colors text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-16 h-3 rounded-none border border-border/80 shrink-0"
                  style={{ background: getPaletteCssGradient(colorPalette, invertPalette) }}
                />
                <span className="truncate font-medium">{colorPalette}</span>
              </div>
              <Icon name={paletteOpen ? 'expand_less' : 'expand_more'} className="text-muted-foreground text-xs ml-1" />
            </button>

            {/* Dropdown Popover */}
            {paletteOpen && (
              <div className="absolute top-9 left-0 right-0 z-50 bg-card border border-border shadow-2xl rounded-none p-2 space-y-2 text-xs">
                {/* Search Input */}
                <input
                  type="text"
                  placeholder="Search 38 D3 schemes..."
                  value={paletteSearch}
                  onChange={(e) => setPaletteSearch(e.target.value)}
                  className="w-full h-7 px-2 border border-input rounded-none bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  autoFocus
                />

                {/* Schemes List */}
                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                  {filteredPalettes.length === 0 ? (
                    <div className="p-2 text-center text-muted-foreground text-xs">No matching schemes</div>
                  ) : (
                    filteredPalettes.map((scheme) => (
                      <button
                        key={scheme.id}
                        type="button"
                        onClick={() => {
                          setColorPalette(scheme.id)
                          setPaletteOpen(false)
                        }}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-none cursor-pointer text-left text-xs transition-colors ${
                          colorPalette === scheme.id
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-14 h-3 rounded-none border border-black/20 shrink-0"
                            style={{ background: getPaletteCssGradient(scheme.id, invertPalette) }}
                          />
                          <span className="truncate">{scheme.name}</span>
                        </div>
                        <span className="text-[9px] opacity-60 ml-1 shrink-0">{scheme.category.split(' ')[0]}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Layer Opacity */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-xs">
            <Label className="text-xs text-muted-foreground">Layer Opacity</Label>
            <span className="text-foreground font-bold">
              {Math.round(opacity * 100)}%
            </span>
          </div>
          <Slider
            value={[opacity * 100]}
            min={10}
            max={100}
            step={1}
            onValueChange={(vals) => setOpacity(vals[0] / 100)}
          />
        </div>
      </div>

      <Separator />

      {/* Visual Bounds Mode */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-foreground">Visual Bounds</Label>
        <Select value={boundsMode} onValueChange={(v) => setBoundsMode(v as BoundsMode)}>
          <SelectTrigger className="rounded-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-none">
            <SelectItem value="Manual" className="rounded-none">Manual</SelectItem>
            <SelectItem value="Percentile" className="rounded-none">Percentile</SelectItem>
          </SelectContent>
        </Select>

        {boundsMode === 'Manual' ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Min Override</span>
              <NumberInput
                placeholder="Auto"
                value={minValOverride}
                step="any"
                onChange={(val) => setMinValOverride(val)}
                containerClassName="rounded-none"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Max Override</span>
              <NumberInput
                placeholder="Auto"
                value={maxValOverride}
                step="any"
                onChange={(val) => setMaxValOverride(val)}
                containerClassName="rounded-none"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1 pt-1">
            <span className="text-[11px] text-muted-foreground">Percentile Breaks (0-100)</span>
            <Input
              type="text"
              value={percentileList}
              onChange={(e) => setPercentileList(e.target.value)}
              className="rounded-none font-mono text-xs"
            />
          </div>
        )}
      </div>

      <Separator />

      {/* Legend Label */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Legend Label</Label>
        <Input
          type="text"
          value={legendTitle}
          onChange={(e) => setLegendTitle(e.target.value)}
          className="rounded-none"
        />
      </div>

      <Separator />

      {/* Country Analysis (Multi-Country Polygon Binning & Isolation) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Icon name="public" className="text-primary" />
            <span>Country Analysis</span>
          </Label>

          {/* Quick status count */}
          {selectedCountries.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-none bg-primary/20 text-primary font-bold border border-primary/40">
              {selectedCountries.length} Selected
            </span>
          )}
        </div>

        {/* Countries Mode Toggle Button */}
        <button
          type="button"
          onClick={() => onToggleCountriesMode && onToggleCountriesMode(!countriesMode)}
          className={`w-full h-8 px-2.5 text-xs font-medium rounded-none transition-colors flex items-center justify-between cursor-pointer border ${
            countriesMode
              ? 'bg-primary/20 text-primary border-primary/50 shadow-sm font-semibold'
              : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-input'
          }`}
          title="When active, the bitmap isolates to active countries, and clicking countries toggles selection"
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-none ${
                countriesMode ? 'bg-primary animate-pulse' : 'bg-muted-foreground/60'
              }`}
            />
            <span>Countries Mode (Bitmap Isolation)</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
            {countriesMode ? 'ON' : 'OFF'}
          </span>
        </button>

        <p className="text-[11px] text-muted-foreground leading-tight">
          When active, the raster isolates strictly to selected country outlines, and clicking countries toggles selection.
        </p>

        {/* Real-time Hover Feedback */}
        {countriesMode && hoveredCountry && (
          <div className="p-2 rounded-none bg-muted/40 border border-border text-[11px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] uppercase font-medium">Map Cursor Hover</span>
              <span className="text-primary font-bold text-[10px]">Click to toggle</span>
            </div>
            <div className="font-semibold text-foreground truncate">
              {hoveredCountry.properties.name}
            </div>
          </div>
        )}

        {/* Multi-Country Selection Checklist */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Select Multiple Countries</span>
            <div className="flex items-center gap-2 text-[10px]">
              {onSelectAllCountries && (
                <button
                  type="button"
                  onClick={onSelectAllCountries}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  All
                </button>
              )}
              {selectedCountries.length > 0 && (
                <button
                  type="button"
                  onClick={onClearCountries}
                  className="text-primary hover:underline cursor-pointer font-semibold"
                >
                  Clear ({selectedCountries.length})
                </button>
              )}
            </div>
          </div>

          {/* Search Countries */}
          <input
            type="text"
            placeholder="Search countries..."
            value={countrySearch}
            onChange={(e) => setCountrySearch(e.target.value)}
            className="w-full h-7 px-2 border border-input rounded-none bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />

          {/* Scrollable Checklist */}
          <div className="max-h-36 overflow-y-auto border border-input rounded-none bg-background/80 p-1 space-y-0.5">
            {filteredCountries.length === 0 ? (
              <div className="p-2 text-center text-muted-foreground text-xs">No countries found</div>
            ) : (
              filteredCountries.map((c) => {
                const code = getCountryCode(c)
                const isSelected = selectedCountryCodeSet.has(code)
                return (
                  <label
                    key={code}
                    className={`flex items-center gap-2 px-2 py-1 rounded-none text-xs cursor-pointer select-none transition-colors ${
                      isSelected ? 'bg-primary/20 text-primary font-semibold' : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleCountry(c)}
                      className="w-3.5 h-3.5 rounded-none accent-primary cursor-pointer"
                    />
                    <span className="truncate">{c.properties.name}</span>
                  </label>
                )
              })
            )}
          </div>

          {/* Selected Countries Chips */}
          {selectedCountries.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1 max-h-24 overflow-y-auto">
              {selectedCountries.map((c) => (
                <span
                  key={getCountryCode(c)}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-primary/20 text-primary border border-primary/40 rounded-none font-medium"
                >
                  <span className="truncate max-w-[90px]">{c.properties.name}</span>
                  <button
                    type="button"
                    onClick={() => onToggleCountry(c)}
                    className="hover:text-foreground opacity-70 hover:opacity-100 cursor-pointer text-[10px]"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Aggregated Country Stats Summary */}
        {countryStats && countryStats.validCount > 0 && (
          <div className="p-2 rounded-none bg-background border border-border text-[11px] space-y-1">
            <div className="flex justify-between items-center text-muted-foreground text-[10px]">
              <span className="truncate font-medium">{countryStats.name}:</span>
              <span className="text-foreground font-semibold shrink-0">
                {countryStats.validCount.toLocaleString()} cells
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground text-[10px]">
              <span>Range:</span>
              <span className="text-foreground font-mono">
                {countryStats.min.toFixed(2)} → {countryStats.max.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground text-[10px]">
              <span>Mean:</span>
              <span className="text-foreground font-mono">{countryStats.mean.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Help text */}
      <div className="text-[11px] text-muted-foreground space-y-1 pt-1">
        <p>• Hover: Inspect coordinates & values</p>
        <p>• Click Country in Countries Mode: Toggle selection</p>
        <p>• Double-click: Reset map view</p>
      </div>
    </div>
  )
}
export default SidebarControls
