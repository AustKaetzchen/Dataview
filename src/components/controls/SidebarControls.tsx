import React, { useState, useEffect, useMemo } from 'react'
import {
  AppMode,
  DataFormat,
  ScaleType,
  ColorPalette,
  BoundsMode,
  ProjectionType,
} from '@/lib/geopng/types'
import { CountryFeature, CountryStats, loadCountriesGeoJson } from '@/lib/geopng/polygonBinning'
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
  selectedCountry?: CountryFeature | null
  onSelectCountry?: (country: CountryFeature | null) => void
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
  selectedCountry,
  onSelectCountry,
  hoveredCountry,
  countryStats,
}) => {
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
    <div className="w-80 h-full flex flex-col bg-card border-r border-border text-card-foreground overflow-y-auto p-4 space-y-4 select-none">
      {/* App Header */}
      <div>
        <h1 className="text-base font-bold tracking-tight text-foreground">GeoPNG Viewer</h1>
        <p className="text-xs text-muted-foreground">4320×2160 • Equirectangular WGS84</p>
      </div>

      <Separator />

      {/* App Mode Tabs (Single Image vs Image Difference) */}
      <Tabs value={appMode} onValueChange={(v) => setAppMode(v as AppMode)}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="Single Image">Single Image</TabsTrigger>
          <TabsTrigger value="Image Difference">Image Difference</TabsTrigger>
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
              className="flex items-center justify-between w-full h-9 px-2.5 border border-input rounded-[3px] bg-background text-foreground hover:bg-muted/40 cursor-pointer transition-colors"
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
              className="flex items-center justify-between w-full h-8 px-2.5 border border-input rounded-[3px] bg-background text-foreground hover:bg-muted/40 cursor-pointer transition-colors"
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
              className="flex items-center justify-between w-full h-8 px-2.5 border border-input rounded-[3px] bg-background text-foreground hover:bg-muted/40 cursor-pointer transition-colors"
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="float32">float32</SelectItem>
                <SelectItem value="int32">int32</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Spatial Projection</Label>
            <Select value={projection} onValueChange={(v) => setProjection(v as ProjectionType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mercator">Mercator (ESRI)</SelectItem>
                <SelectItem value="Equirectangular">Equirectangular</SelectItem>
                <SelectItem value="Globe">Globe</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Scale Transform */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Scale Transformation</Label>
          <Select value={scaleType} onValueChange={(v) => setScaleType(v as ScaleType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pseudo-log">pseudo-log</SelectItem>
              <SelectItem value="linear">linear</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Steepness (Pseudo-log Sigma) */}
        {scaleType === 'pseudo-log' && (
          <div className="space-y-2 rounded-[3px] border border-border p-2 bg-muted/20">
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
                  containerClassName="h-6 w-24"
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
                  className={`px-1.5 py-0.5 text-[10px] rounded border transition-colors ${
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

        {/* Color Palette */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Color Palette</Label>
          <Select value={colorPalette} onValueChange={(v) => setColorPalette(v as ColorPalette)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Plasma">Plasma</SelectItem>
              <SelectItem value="Viridis">Viridis</SelectItem>
              <SelectItem value="Magma">Magma</SelectItem>
              <SelectItem value="Inferno">Inferno</SelectItem>
              <SelectItem value="Cividis">Cividis</SelectItem>
              <SelectItem value="Turbo">Turbo</SelectItem>
              <SelectItem value="Spectral">Spectral</SelectItem>
              <SelectItem value="Heat">Heat</SelectItem>
            </SelectContent>
          </Select>
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
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Manual">Manual</SelectItem>
            <SelectItem value="Percentile">Percentile</SelectItem>
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
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Max Override</span>
              <NumberInput
                placeholder="Auto"
                value={maxValOverride}
                step="any"
                onChange={(val) => setMaxValOverride(val)}
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
        />
      </div>

      <Separator />

      {/* Country Analysis (Polygon Binning) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Icon name="public" className="text-primary" />
            <span>Country Analysis</span>
          </Label>

          {/* Quick status indicator if country active */}
          {(selectedCountry || (countriesMode && hoveredCountry)) && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium border border-primary/30 truncate max-w-[120px]">
              {(hoveredCountry && countriesMode) ? hoveredCountry.properties.name : selectedCountry?.properties.name}
            </span>
          )}
        </div>

        {/* Countries Mode Toggle Button */}
        <button
          type="button"
          onClick={() => onToggleCountriesMode && onToggleCountriesMode(!countriesMode)}
          className={`w-full h-8 px-2.5 text-xs font-medium rounded-[3px] transition-colors flex items-center justify-between cursor-pointer border ${
            countriesMode
              ? 'bg-primary/20 text-primary border-primary/50 shadow-sm font-semibold'
              : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-input'
          }`}
          title="When active, hover over any country on the map to inspect its live statistics and distribution"
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                countriesMode ? 'bg-primary animate-pulse' : 'bg-muted-foreground/60'
              }`}
            />
            <span>Countries Mode (Map Hover)</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
            {countriesMode ? 'ON' : 'OFF'}
          </span>
        </button>

        <p className="text-[11px] text-muted-foreground leading-tight">
          Hover over country polygons to inspect live regional statistics and distributions.
        </p>

        {/* Real-time Hover Feedback Chip */}
        {countriesMode && (
          <div className="p-2 rounded-[3px] bg-muted/40 border border-border text-[11px] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[10px] uppercase font-medium">Map Hover</span>
              {hoveredCountry ? (
                <span className="text-primary font-bold text-[10px] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                  Live
                </span>
              ) : (
                <span className="text-muted-foreground text-[10px] italic">Ready</span>
              )}
            </div>
            <div className="font-semibold text-foreground truncate">
              {hoveredCountry ? hoveredCountry.properties.name : 'Move cursor over any country'}
            </div>
          </div>
        )}

        {/* Country Selection Dropdown */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Select Country Filter</span>
            {selectedCountry && onSelectCountry && (
              <button
                type="button"
                onClick={() => onSelectCountry(null)}
                className="text-[10px] text-primary hover:underline cursor-pointer flex items-center gap-0.5"
              >
                <span>Clear</span>
                <span>✕</span>
              </button>
            )}
          </div>

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
            className="w-full h-8 px-2 py-0 text-xs bg-background border border-input rounded-[3px] text-foreground focus:outline-none cursor-pointer truncate"
          >
            <option value="">Global (All Data)</option>
            {allCountries.map((c, idx) => {
              const code = getCountryCode(c) || `country-${idx}`
              return (
                <option key={`${code}-${idx}`} value={code}>
                  {c.properties.name}
                </option>
              )
            })}
          </select>
        </div>

        {/* Active Country Stats Summary Badge in Sidebar */}
        {countryStats && countryStats.validCount > 0 && (
          <div className="p-2 rounded-[3px] bg-background border border-border text-[11px] space-y-1">
            <div className="flex justify-between items-center text-muted-foreground text-[10px]">
              <span>{countryStats.name} Valid Cells:</span>
              <span className="text-foreground font-semibold">
                {countryStats.validCount.toLocaleString()} / {countryStats.totalCells.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground text-[10px]">
              <span>Range:</span>
              <span className="text-foreground font-mono">
                {countryStats.min.toFixed(2)} → {countryStats.max.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Help text */}
      <div className="text-[11px] text-muted-foreground space-y-1 pt-1">
        <p>• Hover: Inspect coordinates & values</p>
        <p>• Double-click: Reset map view</p>
      </div>
    </div>
  )
}
