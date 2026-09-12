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
import { LOCALISATION_CONFIG } from '@config'

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
      <div className="p-[var(--padding)] border-b border-border bg-card/60">
        <div className="flex items-center justify-between">
          <h1 className="text-[var(--header-font-size)] font-bold tracking-tight text-foreground flex items-center gap-2">
            <Icon name="layers" />
            <span>{LOCALISATION_CONFIG.app.title}</span>
          </h1>
          <span className="text-[var(--body-font-size)] px-2 py-0.5 rounded-none bg-muted text-muted-foreground border border-border font-medium tracking-wider">
            {LOCALISATION_CONFIG.app.badge}
          </span>
        </div>
        <p className="text-[var(--body-font-size)] text-muted-foreground font-light mt-1">
          {LOCALISATION_CONFIG.app.subtitle}
        </p>
      </div>

      <div className="flex-1 p-[var(--padding)] space-y-[var(--padding)]">
        {/* ========================================================================= */}
        {/* FOLDER 1: IMAGE SETTINGS */}
        {/* ========================================================================= */}
        <div className="border border-border bg-card/50">
          <button
            type="button"
            onClick={() => toggleFolder('image')}
            className="w-full h-8 px-[var(--padding)] flex items-center justify-between text-[var(--body-font-size)] font-bold text-foreground bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Icon name="folder" />
              <span>Image Settings</span>
            </div>
            <div className="flex items-center gap-1.5">
              {binningConfig.enabled && (
                <span className="text-[var(--body-font-size)] px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/40 font-medium">
                  {binningConfig.width}×{binningConfig.height}
                </span>
              )}
              <Icon
                name={openFolders.image ? 'expand_less' : 'expand_more'}
              />
            </div>
          </button>

          {openFolders.image && (
            <div className="p-[var(--padding)] space-y-[var(--padding)] text-[var(--body-font-size)] border-t border-border">
              {/* File Input Mode Selector (Single Image vs Image Difference) */}
              <div className="space-y-1">
                <Label className="text-[var(--body-font-size)] text-muted-foreground font-normal">File Input Mode</Label>
                <div className="grid grid-cols-2 gap-1 bg-muted/50 p-0.5 border border-border">
                  <button
                    type="button"
                    onClick={() => setAppMode('Single Image')}
                    className={`h-7 text-[var(--body-font-size)] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      appMode === 'Single Image'
                        ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon name="image" />
                    <span>Single Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAppMode('Image Difference')}
                    className={`h-7 text-[var(--body-font-size)] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      appMode === 'Image Difference'
                        ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon name="compare_arrows" />
                    <span>Difference</span>
                  </button>
                </div>
              </div>

              {/* File Upload based on active AppMode */}
              {appMode === 'Single Image' ? (
                <div className="space-y-1">
                  <Label className="text-[var(--body-font-size)] text-muted-foreground font-normal">Select GeoPNG File (.png)</Label>
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
                    <span className="truncate text-[var(--body-font-size)]">
                      {activeFileName || 'Upload GeoPNG (.png)...'}
                    </span>
                    <Icon name="folder_open" className="text-white/80 shrink-0 ml-1" />
                  </label>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-[var(--body-font-size)] text-muted-foreground font-normal">First GeoPNG (A)</Label>
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
                      <span className="truncate text-[var(--body-font-size)]">{diffNameA || 'Choose Image A...'}</span>
                      <Icon name="file_upload" className="text-white/80 shrink-0 ml-1" />
                    </label>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[var(--body-font-size)] text-muted-foreground font-normal">Second GeoPNG (B)</Label>
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
                      <span className="truncate text-[var(--body-font-size)]">{diffNameB || 'Choose Image B...'}</span>
                      <Icon name="file_upload" className="text-white/80 shrink-0 ml-1" />
                    </label>
                  </div>
                </div>
              )}

              {/* Encoding Format */}
              <div className="space-y-1">
                <Label className="text-[var(--body-font-size)] text-muted-foreground font-normal">Encoding Format</Label>
                <Select value={dataFormat} onValueChange={(v) => setDataFormat(v as DataFormat)}>
                  <SelectTrigger className="rounded-none h-7 text-[var(--body-font-size)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="float32" className="rounded-none text-[var(--body-font-size)]">float32 (IEEE 754)</SelectItem>
                    <SelectItem value="int32" className="rounded-none text-[var(--body-font-size)]">int32 (Signed Integer)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Binning & Downsampling */}
              <div className="space-y-2 border border-border/80 bg-background/50 p-[var(--padding)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-foreground text-[var(--body-font-size)]">
                    <Icon name="grid_view" />
                    <span>Binning / Downsampling</span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={binningConfig.enabled}
                      onChange={(e) =>
                        setBinningConfig((prev) => ({ ...prev, enabled: e.target.checked }))
                      }
                      className="w-[var(--body-font-size)] h-[var(--body-font-size)] rounded-none accent-emerald-500 cursor-pointer"
                    />
                    <span
                      className={`text-[var(--body-font-size)] font-bold uppercase ${
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
                        <span className="text-[var(--body-font-size)] text-muted-foreground">Width</span>
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
                          containerClassName="h-7 rounded-none text-[var(--body-font-size)]"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[var(--body-font-size)] text-muted-foreground">Height</span>
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
                          containerClassName="h-7 rounded-none text-[var(--body-font-size)]"
                        />
                      </div>
                    </div>

                    {/* Presets */}
                    <div className="space-y-1">
                      <span className="text-[var(--body-font-size)] text-muted-foreground">Presets</span>
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
                            className={`px-1.5 py-1 text-[var(--body-font-size)] border rounded-none text-center truncate transition-colors cursor-pointer ${
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
                      <span className="text-[var(--body-font-size)] text-muted-foreground">Downsample Method</span>
                      <Select
                        value={binningConfig.method}
                        onValueChange={(v) =>
                          setBinningConfig((prev) => ({
                            ...prev,
                            method: v as DownsampleMethod,
                          }))
                        }
                      >
                        <SelectTrigger className="rounded-none h-7 text-[var(--body-font-size)]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="average" className="rounded-none text-[var(--body-font-size)]">Average (Mean)</SelectItem>
                          <SelectItem value="minimum" className="rounded-none text-[var(--body-font-size)]">Minimum</SelectItem>
                          <SelectItem value="maximum" className="rounded-none text-[var(--body-font-size)]">Maximum</SelectItem>
                          <SelectItem value="near" className="rounded-none text-[var(--body-font-size)]">Near (Nearest Neighbor)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* Layer Opacity */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[var(--body-font-size)]">
                  <Label className="text-[var(--body-font-size)] text-muted-foreground font-normal">Layer Opacity</Label>
                  <span className="text-foreground font-bold text-[var(--body-font-size)]">
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
            className="w-full h-8 px-[var(--padding)] flex items-center justify-between text-[var(--body-font-size)] font-bold text-foreground bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Icon name="palette" />
              <span>Legend Settings</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--body-font-size)] text-muted-foreground truncate max-w-[80px]">
                {colorPalette}
              </span>
              <Icon
                name={openFolders.legend ? 'expand_less' : 'expand_more'}
              />
            </div>
          </button>

          {openFolders.legend && (
            <div className="p-[var(--padding)] space-y-[var(--padding)] text-[var(--body-font-size)] border-t border-border">
              {/* Scale Transformation */}
              <div className="space-y-1">
                <Label className="text-[var(--body-font-size)] text-muted-foreground font-normal">Scale Transformation</Label>
                <Select value={scaleType} onValueChange={(v) => setScaleType(v as ScaleType)}>
                  <SelectTrigger className="rounded-none h-7 text-[var(--body-font-size)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="pseudo-log" className="rounded-none text-[var(--body-font-size)]">pseudo-log</SelectItem>
                    <SelectItem value="linear" className="rounded-none text-[var(--body-font-size)]">linear</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Steepness (Sigma) */}
              {scaleType === 'pseudo-log' && (
                <div className="space-y-2 rounded-none border border-border p-[var(--padding)] bg-muted/20">
                  <div className="flex justify-between items-center text-[var(--body-font-size)]">
                    <Label className="text-muted-foreground text-[var(--body-font-size)] font-normal">
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
                      containerClassName="h-7 w-20 rounded-none text-[var(--body-font-size)]"
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
                        className={`px-1.5 py-0.5 text-[var(--body-font-size)] rounded-none border transition-colors ${
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
                  <Label className="text-[var(--body-font-size)] text-muted-foreground font-normal">Color Palette (D3)</Label>
                  <label className="flex items-center gap-1.5 text-[var(--body-font-size)] text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={invertPalette}
                      onChange={(e) => setInvertPalette(e.target.checked)}
                      className="w-[var(--body-font-size)] h-[var(--body-font-size)] rounded-none accent-emerald-500 cursor-pointer"
                    />
                    <span className="text-[var(--body-font-size)] text-muted-foreground">Invert</span>
                  </label>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPaletteOpen(!paletteOpen)}
                    className="w-full h-8 px-2.5 flex items-center justify-between border border-input rounded-none bg-background text-foreground hover:bg-muted/40 cursor-pointer transition-colors text-[var(--body-font-size)]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-16 h-3 rounded-none border border-border/80 shrink-0"
                        style={{ background: getPaletteCssGradient(colorPalette, invertPalette) }}
                      />
                      <span className="truncate font-medium">{colorPalette}</span>
                    </div>
                    <Icon name={paletteOpen ? 'expand_less' : 'expand_more'} className="ml-1" />
                  </button>

                  {/* Dropdown Popover */}
                  {paletteOpen && (
                    <div className="absolute top-9 left-0 right-0 z-50 bg-card border border-border shadow-2xl rounded-none p-[var(--padding)] space-y-[var(--padding)] text-[var(--body-font-size)]">
                      <input
                        type="text"
                        placeholder="Search schemes..."
                        value={paletteSearch}
                        onChange={(e) => setPaletteSearch(e.target.value)}
                        className="w-full h-7 px-2 border border-input rounded-none bg-background text-foreground text-[var(--body-font-size)] focus:outline-none focus:ring-1 focus:ring-ring"
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
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-none cursor-pointer text-left text-[var(--body-font-size)] transition-colors ${
                              colorPalette === scheme.id
                                ? 'bg-primary text-primary-foreground font-bold'
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
                            <span className="text-[var(--body-font-size)] opacity-60 ml-1 shrink-0">{scheme.category.split(' ')[0]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Visual Bounds Mode */}
              <div className="space-y-2">
                <Label className="text-[var(--body-font-size)] font-bold text-foreground">Visual Bounds</Label>
                <Select value={boundsMode} onValueChange={(v) => setBoundsMode(v as BoundsMode)}>
                  <SelectTrigger className="rounded-none h-7 text-[var(--body-font-size)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="Manual" className="rounded-none text-[var(--body-font-size)]">Manual (Min / Max)</SelectItem>
                    <SelectItem value="Percentile" className="rounded-none text-[var(--body-font-size)]">Percentile Breaks</SelectItem>
                    <SelectItem value="Absolute" className="rounded-none text-[var(--body-font-size)]">Absolute Number Ramps</SelectItem>
                  </SelectContent>
                </Select>

                {boundsMode === 'Manual' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <span className="text-[var(--body-font-size)] text-muted-foreground">Min Override</span>
                      <NumberInput
                        placeholder="Auto"
                        value={minValOverride}
                        step="any"
                        onChange={(val) => setMinValOverride(val)}
                        containerClassName="rounded-none h-7 text-[var(--body-font-size)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[var(--body-font-size)] text-muted-foreground">Max Override</span>
                      <NumberInput
                        placeholder="Auto"
                        value={maxValOverride}
                        step="any"
                        onChange={(val) => setMaxValOverride(val)}
                        containerClassName="rounded-none h-7 text-[var(--body-font-size)]"
                      />
                    </div>
                  </div>
                )}

                {boundsMode === 'Percentile' && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[var(--body-font-size)] text-muted-foreground">Percentile Breaks (0-100)</span>
                    <Input
                      type="text"
                      value={percentileList}
                      onChange={(e) => setPercentileList(e.target.value)}
                      className="rounded-none h-7 text-[var(--body-font-size)]"
                    />
                  </div>
                )}

                {boundsMode === 'Absolute' && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--body-font-size)] text-muted-foreground">Absolute Numeric Breaks</span>
                      <button
                        type="button"
                        onClick={() => setAbsoluteBreaks('0, 10, 50, 100, 500, 1000')}
                        className="text-[var(--body-font-size)] text-primary hover:underline cursor-pointer"
                      >
                        Reset Defaults
                      </button>
                    </div>
                    <Input
                      type="text"
                      placeholder="e.g. 0, 10, 50, 100, 500, 1000"
                      value={absoluteBreaks}
                      onChange={(e) => setAbsoluteBreaks(e.target.value)}
                      className="rounded-none h-7 text-[var(--body-font-size)]"
                    />
                    <span className="text-[var(--body-font-size)] text-muted-foreground leading-tight block">
                      Color ramp stretches across these discrete absolute values.
                    </span>
                  </div>
                )}
              </div>

              {/* Legend Title */}
              <div className="space-y-1">
                <Label className="text-[var(--body-font-size)] text-muted-foreground font-normal">Legend Label</Label>
                <Input
                  type="text"
                  value={legendTitle}
                  onChange={(e) => setLegendTitle(e.target.value)}
                  className="rounded-none h-7 text-[var(--body-font-size)]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

export default SidebarControls
