import React from 'react'
import {
  AppMode,
  DataFormat,
  ScaleType,
  ColorPalette,
  BoundsMode,
  ProjectionType,
} from '@/lib/geopng/types'
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
}) => {
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

      {/* Help text */}
      <div className="text-[11px] text-muted-foreground space-y-1 pt-1">
        <p>• Hover: Inspect coordinates & values</p>
        <p>• Double-click: Reset map view</p>
      </div>
    </div>
  )
}
