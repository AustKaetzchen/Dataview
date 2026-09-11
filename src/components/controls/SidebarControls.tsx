import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  AppMode,
  DataFormat,
  ScaleType,
  ColorPalette,
  BoundsMode,
  BinningConfig,
  DownsampleMethod,
  MapModeItem,
  MapModeId,
  HeightmapConfig,
  CircleOverlayConfig,
} from '@/lib/geopng/types'
import { CountryFeature } from '@/lib/geopng/polygonBinning'
import { D3_COLOR_SCHEMES, getPaletteCssGradient } from '@/lib/geopng/palettes'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select'
import { Slider } from '../ui/slider'
import { Input } from '../ui/input'
import { NumberInput } from '../ui/number-input'
import { Label } from '../ui/label'
import { Icon } from '../ui/icon'

interface SidebarControlsProps {
  appMode: AppMode
  setAppMode: (mode: AppMode) => void
  dataFormat: DataFormat
  setDataFormat: (fmt: DataFormat) => void
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
  absoluteBreaks: string
  setAbsoluteBreaks: (p: string) => void
  legendTitle: string
  setLegendTitle: (t: string) => void
  opacity: number
  setOpacity: (o: number) => void
  onFileUpload: (file: File, target: 'single' | 'diff_a' | 'diff_b') => void
  activeFileName?: string
  diffNameA?: string
  diffNameB?: string
  binningConfig: BinningConfig
  setBinningConfig: React.Dispatch<React.SetStateAction<BinningConfig>>
  mapModes?: MapModeItem[]
  heightmapConfig?: HeightmapConfig
  circleOverlayConfig?: CircleOverlayConfig
  selectedCountries?: CountryFeature[]
  onToggleMapMode?: (id: MapModeId) => void
}

export const SidebarControls: React.FC<SidebarControlsProps> = ({
  appMode,
  setAppMode,
  dataFormat,
  setDataFormat,
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
  absoluteBreaks,
  setAbsoluteBreaks,
  legendTitle,
  setLegendTitle,
  opacity,
  setOpacity,
  onFileUpload,
  activeFileName,
  diffNameA,
  diffNameB,
  binningConfig,
  setBinningConfig,
  mapModes,
  heightmapConfig,
  circleOverlayConfig,
  selectedCountries,
  onToggleMapMode,
}) => {
  // Collapsible Folders State
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    image: true,
    legend: true,
  })

  const toggleFolder = (folderKey: string) => {
    setOpenFolders((prev) => ({ ...prev, [folderKey]: !prev[folderKey] }))
  }

  const [paletteSearch, setPaletteSearch] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const palettePickerRef = useRef<HTMLDivElement>(null)

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



  // Filtered D3 palettes
  const filteredPalettes = useMemo(() => {
    const q = paletteSearch.toLowerCase().trim()
    if (!q) return D3_COLOR_SCHEMES
    return D3_COLOR_SCHEMES.filter(
      (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
    )
  }, [paletteSearch])

  // Common binning presets
  const BINNING_PRESETS = [
    { label: 'Native (4320×2160)', w: 4320, h: 2160 },
    { label: '2× (2160×1080)', w: 2160, h: 1080 },
    { label: '4× (1080×540)', w: 1080, h: 540 },
    { label: '6× (720×360)', w: 720, h: 360 },
    { label: '12× (360×180)', w: 360, h: 180 },
  ]

  return (
    <div className="w-84 h-full flex flex-col bg-card border-r border-border text-card-foreground overflow-y-auto select-none font-sans">
      {/* App Header */}
      <div className="p-3.5 pb-2.5 border-b border-border bg-card/60">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
            <Icon name="layers" size="1.1rem" />
            <span>Confoederatio Dataview</span>
          </h1>
          <span className="text-[10px] px-1.5 py-0.5 rounded-none bg-muted text-muted-foreground border border-border font-mono font-medium tracking-wider">
            BETA
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Equirectangular WGS84 • 3D Surface & Analytics
        </p>
      </div>

      <div className="flex-1 p-3 space-y-3">
        {/* ========================================================================= */}
        {/* FOLDER 1: IMAGE SETTINGS */}
        {/* ========================================================================= */}
        <div className="border border-border bg-card/50">
          <button
            type="button"
            onClick={() => toggleFolder('image')}
            className="w-full h-8 px-2.5 flex items-center justify-between text-xs font-semibold text-foreground bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Icon name="folder" size="0.9rem" />
              <span>Image Settings</span>
            </div>
            <div className="flex items-center gap-1.5">
              {binningConfig.enabled && (
                <span className="text-[9px] px-1 py-0.2 bg-primary/20 text-primary font-mono border border-primary/40">
                  {binningConfig.width}×{binningConfig.height}
                </span>
              )}
              <Icon
                name={openFolders.image ? 'expand_less' : 'expand_more'}
                size="1rem"
              />
            </div>
          </button>

          {openFolders.image && (
            <div className="p-2.5 space-y-3 text-xs border-t border-border">
              {/* File Input Mode Selector (Single Image vs Image Difference) */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">File Input Mode</Label>
                <div className="grid grid-cols-2 gap-1 bg-muted/50 p-0.5 border border-border">
                  <button
                    type="button"
                    onClick={() => setAppMode('Single Image')}
                    className={`h-6 text-[11px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                      appMode === 'Single Image'
                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon name="image" size="0.75rem" />
                    <span>Single Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppMode('Image Difference')}
                    className={`h-6 text-[11px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 ${
                      appMode === 'Image Difference'
                        ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon name="compare_arrows" size="0.75rem" />
                    <span>Difference</span>
                  </button>
                </div>
              </div>

              {/* File Upload based on active AppMode */}
              {appMode === 'Single Image' ? (
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Select GeoPNG File (.png)</Label>
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
                    className="flex items-center justify-between w-full h-8 px-2 border border-input rounded-none bg-background text-foreground hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <span className="truncate text-xs">
                      {activeFileName || 'Upload GeoPNG (.png)...'}
                    </span>
                    <Icon name="folder_open" size="0.95rem" className="text-white/80 shrink-0 ml-1" />
                  </label>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">First GeoPNG (A)</Label>
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
                      className="flex items-center justify-between w-full h-8 px-2 border border-input rounded-none bg-background text-foreground hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <span className="truncate text-xs">{diffNameA || 'Choose Image A...'}</span>
                      <Icon name="file_upload" size="0.95rem" className="text-white/80 shrink-0 ml-1" />
                    </label>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Second GeoPNG (B)</Label>
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
                      className="flex items-center justify-between w-full h-8 px-2 border border-input rounded-none bg-background text-foreground hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <span className="truncate text-xs">{diffNameB || 'Choose Image B...'}</span>
                      <Icon name="file_upload" size="0.95rem" className="text-white/80 shrink-0 ml-1" />
                    </label>
                  </div>
                </div>
              )}

              {/* Encoding Format */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Encoding Format</Label>
                <Select value={dataFormat} onValueChange={(v) => setDataFormat(v as DataFormat)}>
                  <SelectTrigger className="rounded-none h-7">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="float32" className="rounded-none">float32 (IEEE 754)</SelectItem>
                    <SelectItem value="int32" className="rounded-none">int32 (Signed Integer)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Binning & Downsampling */}
              <div className="space-y-2 border border-border/80 bg-background/50 p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium text-foreground text-[11px]">
                    <Icon name="grid_view" size="0.85rem" />
                    <span>Binning / Downsampling</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={binningConfig.enabled}
                      onChange={(e) =>
                        setBinningConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                      }
                      className="w-3.5 h-3.5 rounded-none accent-emerald-500 cursor-pointer"
                    />
                    <span
                      className={`text-[10px] font-semibold uppercase ${
                        binningConfig.enabled ? 'text-emerald-400 font-bold' : 'text-muted-foreground'
                      }`}
                    >
                      {binningConfig.enabled ? 'ON' : 'OFF'}
                    </span>
                  </label>
                </div>

                {binningConfig.enabled && (
                  <div className="space-y-2 pt-1 border-t border-border/60">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">Width</span>
                        <NumberInput
                          value={binningConfig.width}
                          min={60}
                          max={4320}
                          step={60}
                          onChange={(val) => {
                            const parsed = parseInt(val, 10)
                            if (parsed > 0) {
                              setBinningConfig((prev) => ({ ...prev, width: parsed }))
                            }
                          }}
                          containerClassName="h-6 rounded-none font-mono text-[11px]"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">Height</span>
                        <NumberInput
                          value={binningConfig.height}
                          min={30}
                          max={2160}
                          step={30}
                          onChange={(val) => {
                            const parsed = parseInt(val, 10)
                            if (parsed > 0) {
                              setBinningConfig((prev) => ({ ...prev, height: parsed }))
                            }
                          }}
                          containerClassName="h-6 rounded-none font-mono text-[11px]"
                        />
                      </div>
                    </div>

                    {/* Presets */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground">Presets</span>
                      <div className="grid grid-cols-3 gap-1">
                        {BINNING_PRESETS.slice(1).map((pr) => (
                          <button
                            key={pr.label}
                            type="button"
                            onClick={() =>
                              setBinningConfig((prev) => ({
                                ...prev,
                                width: pr.w,
                                height: pr.h,
                              }))
                            }
                            className={`px-1 py-0.5 text-[10px] border rounded-none text-center truncate transition-colors cursor-pointer ${
                              binningConfig.width === pr.w && binningConfig.height === pr.h
                                ? 'bg-primary text-primary-foreground border-primary font-bold'
                                : 'bg-background hover:bg-muted text-muted-foreground border-border'
                            }`}
                          >
                            {pr.w}×{pr.h}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Method */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground">Downsample Method</span>
                      <Select
                        value={binningConfig.method}
                        onValueChange={(v) =>
                          setBinningConfig((prev) => ({
                            ...prev,
                            method: v as DownsampleMethod,
                          }))
                        }
                      >
                        <SelectTrigger className="rounded-none h-6 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="average" className="rounded-none">Average (Mean)</SelectItem>
                          <SelectItem value="minimum" className="rounded-none">Minimum</SelectItem>
                          <SelectItem value="maximum" className="rounded-none">Maximum</SelectItem>
                          <SelectItem value="near" className="rounded-none">Near (Nearest Neighbor)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Layer Opacity */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <Label className="text-[11px] text-muted-foreground">Layer Opacity</Label>
                  <span className="text-foreground font-bold font-mono text-xs">
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
          )}
        </div>

        {/* ========================================================================= */}
        {/* FOLDER 2: LEGEND SETTINGS */}
        {/* ========================================================================= */}
        <div className="border border-border bg-card/50">
          <button
            type="button"
            onClick={() => toggleFolder('legend')}
            className="w-full h-8 px-2.5 flex items-center justify-between text-xs font-semibold text-foreground bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <Icon name="palette" size="0.9rem" />
              <span>Legend Settings</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[80px]">
                {colorPalette}
              </span>
              <Icon
                name={openFolders.legend ? 'expand_less' : 'expand_more'}
                size="1rem"
              />
            </div>
          </button>

          {openFolders.legend && (
            <div className="p-2.5 space-y-3 text-xs border-t border-border">
              {/* Scale Transformation */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Scale Transformation</Label>
                <Select value={scaleType} onValueChange={(v) => setScaleType(v as ScaleType)}>
                  <SelectTrigger className="rounded-none h-7">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="pseudo-log" className="rounded-none">pseudo-log</SelectItem>
                    <SelectItem value="linear" className="rounded-none">linear</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Steepness (Sigma) */}
              {scaleType === 'pseudo-log' && (
                <div className="space-y-2 rounded-none border border-border p-2 bg-muted/20">
                  <div className="flex justify-between items-center text-xs">
                    <Label className="text-muted-foreground text-[11px] font-medium">
                      Steepness (Sigma)
                    </Label>
                    <NumberInput
                      value={logSigma}
                      min={0.0001}
                      step={logSigma >= 100 ? 5 : logSigma >= 10 ? 1 : logSigma >= 1 ? 0.1 : 0.01}
                      onChange={(val) => {
                        const parsed = parseFloat(val)
                        if (!Number.isNaN(parsed) && parsed > 0) setLogSigma(parsed)
                      }}
                      containerClassName="h-6 w-20 rounded-none text-xs font-mono"
                    />
                  </div>

                  <Slider
                    value={[logSigma]}
                    min={0.01}
                    max={Math.max(1000, Math.ceil(logSigma * 1.5))}
                    step={logSigma >= 100 ? 5 : logSigma >= 10 ? 1 : logSigma >= 1 ? 0.1 : 0.01}
                    onValueChange={(vals) => setLogSigma(vals[0])}
                  />

                  {/* Preset buttons */}
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

              {/* Color Palette (D3) */}
              <div className="space-y-1.5" ref={palettePickerRef}>
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-muted-foreground">Color Palette (D3)</Label>
                  <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={invertPalette}
                      onChange={(e) => setInvertPalette(e.target.checked)}
                      className="w-3.5 h-3.5 rounded-none accent-emerald-500 cursor-pointer"
                    />
                    <span className="text-[11px] text-muted-foreground">Invert</span>
                  </label>
                </div>

                <div className="relative">
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
                    <Icon name={paletteOpen ? 'expand_less' : 'expand_more'} className="text-xs ml-1" />
                  </button>

                  {/* Dropdown Popover */}
                  {paletteOpen && (
                    <div className="absolute top-9 left-0 right-0 z-50 bg-card border border-border shadow-2xl rounded-none p-2 space-y-2 text-xs">
                      <input
                        type="text"
                        placeholder="Search schemes..."
                        value={paletteSearch}
                        onChange={(e) => setPaletteSearch(e.target.value)}
                        className="w-full h-7 px-2 border border-input rounded-none bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        autoFocus
                      />

                      <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                        {filteredPalettes.map((scheme) => (
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
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Visual Bounds Mode */}
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold text-foreground">Visual Bounds</Label>
                <Select value={boundsMode} onValueChange={(v) => setBoundsMode(v as BoundsMode)}>
                  <SelectTrigger className="rounded-none h-7">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="Manual" className="rounded-none">Manual (Min / Max)</SelectItem>
                    <SelectItem value="Percentile" className="rounded-none">Percentile Breaks</SelectItem>
                    <SelectItem value="Absolute" className="rounded-none">Absolute Number Ramps</SelectItem>
                  </SelectContent>
                </Select>

                {boundsMode === 'Manual' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground">Min Override</span>
                      <NumberInput
                        placeholder="Auto"
                        value={minValOverride}
                        step="any"
                        onChange={(val) => setMinValOverride(val)}
                        containerClassName="rounded-none h-7 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground">Max Override</span>
                      <NumberInput
                        placeholder="Auto"
                        value={maxValOverride}
                        step="any"
                        onChange={(val) => setMaxValOverride(val)}
                        containerClassName="rounded-none h-7 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                {boundsMode === 'Percentile' && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] text-muted-foreground">Percentile Breaks (0-100)</span>
                    <Input
                      type="text"
                      value={percentileList}
                      onChange={(e) => setPercentileList(e.target.value)}
                      className="rounded-none h-7 font-mono text-xs"
                    />
                  </div>
                )}

                {boundsMode === 'Absolute' && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground">Absolute Numeric Breaks</span>
                      <button
                        type="button"
                        onClick={() => setAbsoluteBreaks('0, 10, 50, 100, 500, 1000')}
                        className="text-[10px] text-primary hover:underline cursor-pointer"
                      >
                        Reset Defaults
                      </button>
                    </div>
                    <Input
                      type="text"
                      placeholder="e.g. 0, 10, 50, 100, 500, 1000"
                      value={absoluteBreaks}
                      onChange={(e) => setAbsoluteBreaks(e.target.value)}
                      className="rounded-none h-7 font-mono text-xs"
                    />
                    <span className="text-[10px] text-muted-foreground leading-tight block">
                      Color ramp stretches across these discrete absolute values.
                    </span>
                  </div>
                )}
              </div>

              {/* Legend Title */}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Legend Label</Label>
                <Input
                  type="text"
                  value={legendTitle}
                  onChange={(e) => setLegendTitle(e.target.value)}
                  className="rounded-none h-7"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info & Active Mapmodes Bullet List (Bottom Left) */}
      <div className="p-3 border-t border-border bg-card/60 text-[10px] text-muted-foreground space-y-1 select-none font-sans">
        <p>• Hover: Inspect coordinates & values</p>
        {mapModes
          ?.filter((m) => m.active)
          .map((m) => {
            let desc = 'Full-resolution raster layer'
            if (m.id === 'country_analysis') {
              const count = selectedCountries?.length ?? 0
              desc = count > 0 ? `${count} ${count === 1 ? 'country' : 'countries'} isolated` : 'Active (select country)'
            } else if (m.id === 'spike_map') {
              desc = `${Math.round((heightmapConfig?.elevationScale ?? 800000) / 1000)}km peak scale • ${Math.round((heightmapConfig?.opacity ?? 0.9) * 100)}% opacity`
            } else if (m.id === 'circle_sizing') {
              desc = `≥P${circleOverlayConfig?.percentileCutoff ?? 99} cutoff • ${(circleOverlayConfig?.baseRadius ?? 1.0).toFixed(1)} ha/unit`
            }
            return (
              <p key={m.id} className="text-foreground font-medium">
                • <span className="text-muted-foreground">{m.label}:</span> {desc}
              </p>
            )
          })}
        <p>• Shift + Drag / Right-click: Pitch & rotate 3D camera</p>
        <p>• Double-click: Reset map camera</p>
      </div>
    </div>
  )
}

export default SidebarControls
