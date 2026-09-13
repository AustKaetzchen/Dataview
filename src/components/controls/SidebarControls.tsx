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

export interface SidebarControlsProps {
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
  legendSubtitle?: string
  setLegendSubtitle?: (s: string) => void
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
  width?: number
  onWidthChange?: (newWidth: number) => void
  infoPanelOpen?: boolean
  onToggleInfoPanel?: () => void
}

/**
 * SidebarControls primary control panel component for file input, downsampling, and legend options.
 *
 * @param {SidebarControlsProps} arg0_props
 *
 * @returns {React.ReactElement}
 */
export const SidebarControls: React.FC<SidebarControlsProps> = function (arg0_props) {
  //Convert from parameters
  let props = arg0_props
  let {
    absoluteBreaks: absolute_breaks,
    activeFileName: active_file_name,
    appMode: app_mode,
    binningConfig: binning_config,
    boundsMode: bounds_mode,
    colorPalette: color_palette,
    dataFormat: data_format,
    diffNameA: diff_name_a,
    diffNameB: diff_name_b,
    infoPanelOpen: info_panel_open,
    invertPalette: invert_palette,
    legendSubtitle: legend_subtitle = '',
    legendTitle: legend_title,
    logSigma: log_sigma,
    maxValOverride: max_val_override,
    minValOverride: min_val_override,
    onFileUpload: on_file_upload,
    onToggleInfoPanel: on_toggle_info_panel,
    onWidthChange: on_width_change,
    opacity,
    percentileList: percentile_list,
    scaleType: scale_type,
    setAbsoluteBreaks: set_absolute_breaks,
    setAppMode: set_app_mode,
    setBinningConfig: set_binning_config,
    setBoundsMode: set_bounds_mode,
    setColorPalette: set_color_palette,
    setDataFormat: set_data_format,
    setInvertPalette: set_invert_palette,
    setLegendSubtitle: set_legend_subtitle,
    setLegendTitle: set_legend_title,
    setLogSigma: set_log_sigma,
    setMaxValOverride: set_max_val_override,
    setMinValOverride: set_min_val_override,
    setOpacity: set_opacity,
    setPercentileList: set_percentile_list,
    setScaleType: set_scale_type,
    width,
  } = props

  //Declare local instance variables
  let binning_presets = [
    { h: 2160, label: 'Native (4320×2160)', w: 4320 },
    { h: 1080, label: '2× (2160×1080)', w: 2160 },
    { h: 540, label: '4× (1080×540)', w: 1080 },
    { h: 360, label: '6× (720×360)', w: 720 },
    { h: 180, label: '12× (360×180)', w: 360 },
  ]
  let current_width = (width !== undefined) ? width : 336
  let filtered_palettes: typeof D3_COLOR_SCHEMES
  let handle_resize_mouse_down: (arg0_e: React.MouseEvent) => void
  let open_folders: Record<string, boolean>
  let palette_open: boolean
  let palette_picker_ref = useRef<HTMLDivElement>(null)
  let palette_search: string
  let set_open_folders: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  let set_palette_open: React.Dispatch<React.SetStateAction<boolean>>
  let set_palette_search: React.Dispatch<React.SetStateAction<string>>
  let toggle_folder: (arg0_folder_key: string) => void

  //Function body
  ;[open_folders, set_open_folders] = useState<Record<string, boolean>>({
    image: true,
    legend: true,
  })
  ;[palette_search, set_palette_search] = useState('')
  ;[palette_open, set_palette_open] = useState(false)

  toggle_folder = function (arg0_folder_key: string) {
    let folder_key = arg0_folder_key
    set_open_folders((arg0_prev) => ({ ...arg0_prev, [folder_key]: !arg0_prev[folder_key] }))
  }

  //Right-border resize handler to adjust shared width
  handle_resize_mouse_down = function (arg0_e: React.MouseEvent) {
    let e = arg0_e
    e.preventDefault()
    e.stopPropagation()

    let start_w = current_width
    let start_x = e.clientX

    let on_mouse_move = function (arg0_move_event: MouseEvent) {
      let delta = arg0_move_event.clientX - start_x
      let next_w = Math.max(260, Math.min(650, start_w + delta))
      if (on_width_change)
        on_width_change(next_w)
    }

    let on_mouse_up = function () {
      window.removeEventListener('mousemove', on_mouse_move)
      window.removeEventListener('mouseup', on_mouse_up)
    }

    window.addEventListener('mousemove', on_mouse_move)
    window.addEventListener('mouseup', on_mouse_up)
  }

  //Close palette picker when clicking outside
  useEffect(() => {
    let handle_click_outside = function (arg0_e: MouseEvent) {
      let e = arg0_e
      if (palette_picker_ref.current)
        if (!palette_picker_ref.current.contains(e.target as Node))
          set_palette_open(false)
    }
    if (palette_open)
      document.addEventListener('mousedown', handle_click_outside)

    return () => document.removeEventListener('mousedown', handle_click_outside)
  }, [palette_open])

  //Filter D3 palettes
  filtered_palettes = useMemo(() => {
    let q = palette_search.toLowerCase().trim()
    if (!q)
      return D3_COLOR_SCHEMES
    return D3_COLOR_SCHEMES.filter(
      (arg0_scheme) => arg0_scheme.name.toLowerCase().includes(q) || arg0_scheme.category.toLowerCase().includes(q)
    )
  }, [palette_search])

  //Return statement
  return (
    <div
      style={{ width: `${current_width}px` }}
      className="absolute top-3 left-3 bottom-3 z-20 flex flex-col bg-card/95 backdrop-blur-md border border-border text-card-foreground overflow-hidden select-none font-sans shadow-2xl transition-shadow"
    >
      {/* Draggable Right Border Resize Handle */}
      <div
        onMouseDown={handle_resize_mouse_down}
        className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors z-30 group"
        title="Drag right border to resize sidebar"
      >
        <div className="w-[2px] h-8 bg-border group-hover:bg-primary absolute top-1/2 -translate-y-1/2 right-0.5" />
      </div>

      {/* App Header */}
      <div className="p-[var(--padding)] border-b border-border bg-card/60 shrink-0">
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

        {/* Inline Information Toggle Button directly underneath the description */}
        <div className="mt-2.5">
          <button
            type="button"
            onClick={on_toggle_info_panel}
            className={`px-2.5 py-1 text-[var(--body-font-size)] font-medium rounded-none border transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
              info_panel_open
                ? 'bg-primary text-primary-foreground border-primary font-bold shadow-sm'
                : 'bg-background hover:bg-muted text-foreground border-border'
            }`}
            title="Toggle Information & Controls flyout"
          >
            <Icon name="info" className={info_panel_open ? 'text-primary-foreground' : 'text-white'} />
            <span>Information</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-[var(--padding)] space-y-[var(--padding)] overflow-y-auto">
        {/* ========================================================================= */}
        {/* FOLDER 1: IMAGE SETTINGS */}
        {/* ========================================================================= */}
        <div className="border border-border bg-card/50">
          <button
            type="button"
            onClick={() => toggle_folder('image')}
            className="w-full h-8 px-[var(--padding)] flex items-center justify-between text-[var(--body-font-size)] font-bold text-foreground bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Icon name="folder" />
              <span>Image Settings</span>
            </div>
            <div className="flex items-center gap-1.5">
              {binning_config.enabled && (
                <span className="text-[var(--body-font-size)] px-1.5 py-0.5 bg-primary/20 text-primary border border-primary/40 font-medium">
                  {binning_config.width}×{binning_config.height}
                </span>
              )}
              <Icon
                name={open_folders.image ? 'expand_less' : 'expand_more'}
              />
            </div>
          </button>

          {open_folders.image && (
            <div className="p-[var(--padding)] space-y-[var(--padding)] text-[var(--body-font-size)] border-t border-border">
              {/* File Input Mode Selector (Single Image vs Image Difference) */}
              <div className="space-y-1">
                <Label className="text-[var(--body-font-size)] text-muted-foreground font-normal">File Input Mode</Label>
                <div className="grid grid-cols-2 gap-1 bg-muted/50 p-0.5 border border-border">
                  <button
                    type="button"
                    onClick={() => set_app_mode('Single Image')}
                    className={`h-7 text-[var(--body-font-size)] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      app_mode === 'Single Image'
                        ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon name="image" />
                    <span>Single Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => set_app_mode('Image Difference')}
                    className={`h-7 text-[var(--body-font-size)] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      app_mode === 'Image Difference'
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
              {app_mode === 'Single Image' ? (
                <div className="space-y-1">
                  <Label className="text-[var(--body-font-size)] text-muted-foreground font-normal">Select GeoPNG File (.png)</Label>
                  <input
                    type="file"
                    accept=".png"
                    id="single-file-upload"
                    className="hidden"
                    onClick={(arg0_e) => {
                      ;(arg0_e.target as HTMLInputElement).value = ''
                    }}
                    onChange={(arg0_e) => {
                      let file = arg0_e.target.files?.[0]
                      if (file)
                        on_file_upload(file, 'single')
                      arg0_e.target.value = ''
                    }}
                  />
                  <label
                    htmlFor="single-file-upload"
                    className="flex items-center justify-between w-full h-8 px-2 border border-input rounded-none bg-background text-foreground hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <span className="truncate text-[var(--body-font-size)]">
                      {active_file_name || 'Upload GeoPNG (.png)...'}
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
                      onClick={(arg0_e) => {
                        ;(arg0_e.target as HTMLInputElement).value = ''
                      }}
                      onChange={(arg0_e) => {
                        let file = arg0_e.target.files?.[0]
                        if (file)
                          on_file_upload(file, 'diff_a')
                        arg0_e.target.value = ''
                      }}
                    />
                    <label
                      htmlFor="diff-file-a"
                      className="flex items-center justify-between w-full h-8 px-2 border border-input rounded-none bg-background text-foreground hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <span className="truncate text-[var(--body-font-size)]">{diff_name_a || 'Choose Image A...'}</span>
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
                      onClick={(arg0_e) => {
                        ;(arg0_e.target as HTMLInputElement).value = ''
                      }}
                      onChange={(arg0_e) => {
                        let file = arg0_e.target.files?.[0]
                        if (file)
                          on_file_upload(file, 'diff_b')
                        arg0_e.target.value = ''
                      }}
                    />
                    <label
                      htmlFor="diff-file-b"
                      className="flex items-center justify-between w-full h-8 px-2 border border-input rounded-none bg-background text-foreground hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <span className="truncate text-[var(--body-font-size)]">{diff_name_b || 'Choose Image B...'}</span>
                      <Icon name="file_upload" className="text-white/80 shrink-0 ml-1" />
                    </label>
                  </div>
                </div>
              )}

              {/* Encoding Format */}
              <div className="space-y-1">
                <Label className="text-[var(--body-font-size)] text-muted-foreground font-normal">Encoding Format</Label>
                <Select value={data_format} onValueChange={(arg0_v) => set_data_format(arg0_v as DataFormat)}>
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
                      checked={binning_config.enabled}
                      onChange={(arg0_e) =>
                        set_binning_config((arg0_prev) => ({ ...arg0_prev, enabled: arg0_e.target.checked }))
                      }
                      className="w-[var(--body-font-size)] h-[var(--body-font-size)] rounded-none accent-emerald-500 cursor-pointer"
                    />
                    <span
                      className={`text-[var(--body-font-size)] font-bold uppercase ${
                        binning_config.enabled ? 'text-emerald-400 font-bold' : 'text-muted-foreground'
                      }`}
                    >
                      {binning_config.enabled ? 'ON' : 'OFF'}
                    </span>
                  </label>
                </div>

                {binning_config.enabled && (
                  <div className="space-y-2 pt-1 border-t border-border/60">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="space-y-1">
                        <span className="text-[var(--body-font-size)] text-muted-foreground">Width</span>
                        <NumberInput
                          value={binning_config.width}
                          min={60}
                          max={4320}
                          step={60}
                          onChange={(arg0_val) => {
                            let parsed = parseInt(arg0_val, 10)
                            if (parsed > 0)
                              set_binning_config((arg0_prev) => ({ ...arg0_prev, width: parsed }))
                          }}
                          containerClassName="h-7 rounded-none text-[var(--body-font-size)]"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[var(--body-font-size)] text-muted-foreground">Height</span>
                        <NumberInput
                          value={binning_config.height}
                          min={30}
                          max={2160}
                          step={30}
                          onChange={(arg0_val) => {
                            let parsed = parseInt(arg0_val, 10)
                            if (parsed > 0)
                              set_binning_config((arg0_prev) => ({ ...arg0_prev, height: parsed }))
                          }}
                          containerClassName="h-7 rounded-none text-[var(--body-font-size)]"
                        />
                      </div>
                    </div>

                    {/* Presets */}
                    <div className="space-y-1">
                      <span className="text-[var(--body-font-size)] text-muted-foreground">Presets</span>
                      <div className="grid grid-cols-3 gap-1">
                        {binning_presets.slice(1).map((arg0_preset) => (
                          <button
                            key={arg0_preset.label}
                            type="button"
                            onClick={() =>
                              set_binning_config((arg0_prev) => ({
                                ...arg0_prev,
                                height: arg0_preset.h,
                                width: arg0_preset.w,
                              }))
                            }
                            className={`px-1.5 py-1 text-[var(--body-font-size)] border rounded-none text-center truncate transition-colors cursor-pointer ${
                              binning_config.width === arg0_preset.w && binning_config.height === arg0_preset.h
                                ? 'bg-primary text-primary-foreground border-primary font-bold'
                                : 'bg-background hover:bg-muted text-muted-foreground border-border'
                            }`}
                          >
                            {arg0_preset.w}×{arg0_preset.h}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Method */}
                    <div className="space-y-1">
                      <span className="text-[var(--body-font-size)] text-muted-foreground">Downsample Method</span>
                      <Select
                        value={binning_config.method}
                        onValueChange={(arg0_v) =>
                          set_binning_config((arg0_prev) => ({
                            ...arg0_prev,
                            method: arg0_v as DownsampleMethod,
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
                          <SelectItem value="near" className="rounded-none text-[var(--body-font-size)]">Near (Nearest Neighbour)</SelectItem>
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
                    {Math.round(opacity*100)}%
                  </span>
                </div>
                <Slider
                  value={[opacity*100]}
                  min={10}
                  max={100}
                  step={1}
                  onValueChange={(arg0_vals) => set_opacity(arg0_vals[0]/100)}
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
            onClick={() => toggle_folder('legend')}
            className="w-full h-8 px-[var(--padding)] flex items-center justify-between text-[var(--body-font-size)] font-bold text-foreground bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Icon name="palette" />
              <span>Legend Settings</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--body-font-size)] text-muted-foreground truncate max-w-[80px]">
                {color_palette}
              </span>
              <Icon
                name={open_folders.legend ? 'expand_less' : 'expand_more'}
              />
            </div>
          </button>

          {open_folders.legend && (
            <div className="p-[var(--padding)] space-y-[var(--padding)] text-[var(--body-font-size)] border-t border-border">
              {/* Scale Transformation */}
              <div className="space-y-1">
                <Label className="text-[var(--body-font-size)] text-muted-foreground font-normal">Scale Transformation</Label>
                <Select value={scale_type} onValueChange={(arg0_v) => set_scale_type(arg0_v as ScaleType)}>
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
              {scale_type === 'pseudo-log' && (
                <div className="space-y-2 rounded-none border border-border p-[var(--padding)] bg-muted/20">
                  <div className="flex justify-between items-center text-[var(--body-font-size)]">
                    <Label className="text-muted-foreground text-[var(--body-font-size)] font-normal">
                      Steepness (Sigma)
                    </Label>
                    <NumberInput
                      value={log_sigma}
                      min={0.0001}
                      step={log_sigma >= 100 ? 5 : log_sigma >= 10 ? 1 : log_sigma >= 1 ? 0.1 : 0.01}
                      onChange={(arg0_val) => {
                        let parsed = parseFloat(arg0_val)
                        if (!Number.isNaN(parsed) && parsed > 0)
                          set_log_sigma(parsed)
                      }}
                      containerClassName="h-7 w-20 rounded-none text-[var(--body-font-size)]"
                    />
                  </div>

                  <Slider
                    value={[log_sigma]}
                    min={0.01}
                    max={Math.max(1000, Math.ceil(log_sigma*1.5))}
                    step={log_sigma >= 100 ? 5 : log_sigma >= 10 ? 1 : log_sigma >= 1 ? 0.1 : 0.01}
                    onValueChange={(arg0_vals) => set_log_sigma(arg0_vals[0])}
                  />

                  {/* Preset buttons */}
                  <div className="flex items-center justify-between gap-1 pt-0.5">
                    {[0.1, 1, 10, 100, 1000].map((arg0_preset) => (
                      <button
                        key={arg0_preset}
                        type="button"
                        onClick={() => set_log_sigma(arg0_preset)}
                        className={`px-1.5 py-0.5 text-[var(--body-font-size)] rounded-none border transition-colors ${
                          Math.abs(log_sigma - arg0_preset) < 0.001
                            ? 'bg-primary text-primary-foreground border-primary font-bold'
                            : 'bg-background hover:bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {arg0_preset}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Colour Palette (D3) */}
              <div className="space-y-1.5" ref={palette_picker_ref}>
                <div className="flex items-center justify-between">
                  <Label className="text-[var(--body-font-size)] text-muted-foreground font-normal">Colour Palette (D3)</Label>
                  <label className="flex items-center gap-1.5 text-[var(--body-font-size)] text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={invert_palette}
                      onChange={(arg0_e) => set_invert_palette(arg0_e.target.checked)}
                      className="w-[var(--body-font-size)] h-[var(--body-font-size)] rounded-none accent-emerald-500 cursor-pointer"
                    />
                    <span className="text-[var(--body-font-size)] text-muted-foreground">Invert</span>
                  </label>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => set_palette_open(!palette_open)}
                    className="w-full h-8 px-2.5 flex items-center justify-between border border-input rounded-none bg-background text-foreground hover:bg-muted/40 cursor-pointer transition-colors text-[var(--body-font-size)]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-16 h-3 rounded-none border border-border/80 shrink-0"
                        style={{ background: getPaletteCssGradient(color_palette, invert_palette) }}
                      />
                      <span className="truncate font-medium">{color_palette}</span>
                    </div>
                    <Icon name={palette_open ? 'expand_less' : 'expand_more'} className="ml-1" />
                  </button>

                  {/* Dropdown Popover */}
                  {palette_open && (
                    <div className="absolute top-9 left-0 right-0 z-50 bg-card border border-border shadow-2xl rounded-none p-[var(--padding)] space-y-[var(--padding)] text-[var(--body-font-size)]">
                      <input
                        type="text"
                        placeholder="Search schemes..."
                        value={palette_search}
                        onChange={(arg0_e) => set_palette_search(arg0_e.target.value)}
                        className="w-full h-7 px-2 border border-input rounded-none bg-background text-foreground text-[var(--body-font-size)] focus:outline-none focus:ring-1 focus:ring-ring"
                        autoFocus
                      />

                      <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                        {filtered_palettes.map((arg0_scheme) => (
                          <button
                            key={arg0_scheme.id}
                            type="button"
                            onClick={() => {
                              set_color_palette(arg0_scheme.id)
                              set_palette_open(false)
                            }}
                            className={`w-full flex items-center justify-between px-2 py-1.5 rounded-none cursor-pointer text-left text-[var(--body-font-size)] transition-colors ${
                              color_palette === arg0_scheme.id
                                ? 'bg-primary text-primary-foreground font-bold'
                                : 'hover:bg-muted text-foreground'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="w-14 h-3 rounded-none border border-black/20 shrink-0"
                                style={{ background: getPaletteCssGradient(arg0_scheme.id, invert_palette) }}
                              />
                              <span className="truncate">{arg0_scheme.name}</span>
                            </div>
                            <span className="text-[var(--body-font-size)] opacity-60 ml-1 shrink-0">{arg0_scheme.category.split(' ')[0]}</span>
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
                <Select value={bounds_mode} onValueChange={(arg0_v) => set_bounds_mode(arg0_v as BoundsMode)}>
                  <SelectTrigger className="rounded-none h-7 text-[var(--body-font-size)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="Manual" className="rounded-none text-[var(--body-font-size)]">Manual (Min / Max)</SelectItem>
                    <SelectItem value="Percentile" className="rounded-none text-[var(--body-font-size)]">Percentile Breaks</SelectItem>
                    <SelectItem value="Absolute" className="rounded-none text-[var(--body-font-size)]">Absolute Number Ramps</SelectItem>
                  </SelectContent>
                </Select>

                {bounds_mode === 'Manual' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <span className="text-[var(--body-font-size)] text-muted-foreground">Min Override</span>
                      <NumberInput
                        placeholder="Auto"
                        value={min_val_override}
                        step="any"
                        onChange={(arg0_val) => set_min_val_override(arg0_val)}
                        containerClassName="rounded-none h-7 text-[var(--body-font-size)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[var(--body-font-size)] text-muted-foreground">Max Override</span>
                      <NumberInput
                        placeholder="Auto"
                        value={max_val_override}
                        step="any"
                        onChange={(arg0_val) => set_max_val_override(arg0_val)}
                        containerClassName="rounded-none h-7 text-[var(--body-font-size)]"
                      />
                    </div>
                  </div>
                )}

                {bounds_mode === 'Percentile' && (
                  <div className="space-y-1 pt-1">
                    <span className="text-[var(--body-font-size)] text-muted-foreground">Percentile Breaks (0-100)</span>
                    <Input
                      type="text"
                      value={percentile_list}
                      onChange={(arg0_e) => set_percentile_list(arg0_e.target.value)}
                      className="rounded-none h-7 text-[var(--body-font-size)]"
                    />
                  </div>
                )}

                {bounds_mode === 'Absolute' && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[var(--body-font-size)] text-muted-foreground">Absolute Numeric Breaks</span>
                      <button
                        type="button"
                        onClick={() => set_absolute_breaks('0, 10, 50, 100, 500, 1000')}
                        className="text-[var(--body-font-size)] text-primary hover:underline cursor-pointer"
                      >
                        Reset Defaults
                      </button>
                    </div>
                    <Input
                      type="text"
                      placeholder="e.g. 0, 10, 50, 100, 500, 1000"
                      value={absolute_breaks}
                      onChange={(arg0_e) => set_absolute_breaks(arg0_e.target.value)}
                      className="rounded-none h-7 text-[var(--body-font-size)]"
                    />
                    <span className="text-[var(--body-font-size)] text-muted-foreground leading-tight block">
                      Colour ramp stretches across these discrete absolute values.
                    </span>
                  </div>
                )}
              </div>

              {/* Legend Title (Supports line breaks) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[var(--body-font-size)] text-muted-foreground font-normal">
                    Legend Label
                  </Label>
                  <span className="text-[10px] text-muted-foreground/70 font-light">Supports Enter / line breaks</span>
                </div>
                <textarea
                  value={legend_title}
                  onChange={(arg0_e) => set_legend_title(arg0_e.target.value)}
                  rows={2}
                  placeholder="e.g. Population Density&#10;(people per km²)"
                  className="w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-[var(--body-font-size)] text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y font-sans leading-tight"
                />
              </div>

              {/* Legend Subtitle (Optional, defaults to empty) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[var(--body-font-size)] text-muted-foreground font-normal">
                    Legend Subtitle
                  </Label>
                  <span className="text-[10px] text-muted-foreground/70 font-light">Optional</span>
                </div>
                <textarea
                  value={legend_subtitle}
                  onChange={(arg0_e) => {
                    if (set_legend_subtitle)
                      set_legend_subtitle(arg0_e.target.value)
                  }}
                  rows={1}
                  placeholder="Optional subtitle or data source..."
                  className="w-full rounded-none border border-input bg-transparent px-2.5 py-1 text-[var(--body-font-size)] text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y font-sans leading-tight"
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
