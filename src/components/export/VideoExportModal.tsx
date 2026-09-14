import React, { useState, useMemo, useCallback } from 'react'
import { ParsedDataLayer } from '@/server/layerParser'
import { Icon } from '@/components/ui/icon'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { UfDate } from '@/lib/ufDate'

export type VideoExportMode = 'stationary' | 'cycling'
export type TimestepUnit = 'years' | 'months' | 'days'

export interface StartTimelapseExportOptions {
  endYear: number
  filename: string
  fps: number
  keyframesOnly: boolean
  mode: VideoExportMode
  selectedLayers: string[]
  startYear: number
  timestepStep: number
}

export interface VideoExportModalProps {
  activeLayerId: string | null
  availableKeyframes: number[]
  availableLayers: Record<string, ParsedDataLayer>
  isOpen: boolean
  maxYear: number
  minYear: number
  onClose: () => void
  onStartTimelapseExport?: (arg0_options: StartTimelapseExportOptions) => Promise<void>
}

/**
 * Asynchronously loads an image from an absolute or relative URL.
 *
 * @param {string} arg0_url
 *
 * @returns {Promise<HTMLImageElement | null>}
 */
const loadImageAsync = function (arg0_url: string): Promise<HTMLImageElement | null> {
  //Convert from parameters
  let url = arg0_url

  //Return statement
  return new Promise((arg0_resolve) => {
    let img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => arg0_resolve(img)
    img.onerror = () => arg0_resolve(null)
    img.src = url
  })
}

/**
 * Renders a single frame of the timelapse onto the offscreen canvas context.
 *
 * @param {CanvasRenderingContext2D} arg0_ctx
 * @param {HTMLImageElement | null} arg1_image
 * @param {string} arg2_layer_title
 * @param {string} arg3_category_name
 * @param {number} arg4_year
 * @param {number} arg5_current_step
 * @param {number} arg6_total_steps
 * @param {number} arg7_start_year
 * @param {number} arg8_end_year
 */
const renderTimelapseCanvasFrame = function (
  arg0_ctx: CanvasRenderingContext2D,
  arg1_image: HTMLImageElement | null,
  arg2_layer_title: string,
  arg3_category_name: string,
  arg4_year: number,
  arg5_current_step: number,
  arg6_total_steps: number,
  arg7_start_year: number,
  arg8_end_year: number
) {
  //Convert from parameters
  let category_name = arg3_category_name
  let ctx = arg0_ctx
  let current_step = arg5_current_step
  let end_year = arg8_end_year
  let image = arg1_image
  let layer_title = arg2_layer_title
  let start_year = arg7_start_year
  let total_steps = arg6_total_steps
  let year = arg4_year

  //Declare local instance variables
  let progress_ratio = total_steps > 0 ? (current_step + 1)/total_steps : 0
  let truncated_title = layer_title.length > 48 ? `${layer_title.slice(0, 45)}...` : layer_title
  let year_formatted = UfDate.formatYear(year)

  //Function body
  //1. Clear and render dark background
  ctx.fillStyle = '#0B0F19'
  ctx.fillRect(0, 0, 1280, 720)

  //Draw subtle latitude/longitude grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  ctx.lineWidth = 1
  for (let lon = 0; lon <= 1280; lon += 160) {
    ctx.beginPath()
    ctx.moveTo(lon, 40)
    ctx.lineTo(lon, 680)
    ctx.stroke()
  }
  for (let lat = 40; lat <= 680; lat += 80) {
    ctx.beginPath()
    ctx.moveTo(0, lat)
    ctx.lineTo(1280, lat)
    ctx.stroke()
  }

  //2. Draw raster image centered in 2:1 aspect ratio (1280 x 640) from y = 40
  if (image && image.complete && image.naturalWidth > 0) {
    ctx.drawImage(image, 0, 40, 1280, 640)
  } else {
    //Placeholder notice
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.font = '14px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('No keyframe raster data available for this date', 640, 360)
    ctx.textAlign = 'left'
  }

  //3. Draw top HUD bar (glassmorphism banner)
  ctx.fillStyle = 'rgba(11, 15, 25, 0.85)'
  ctx.fillRect(20, 16, 560, 56)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.lineWidth = 1
  ctx.strokeRect(20, 16, 560, 56)

  //Category badge
  ctx.fillStyle = '#3B82F6'
  ctx.font = 'bold 10px monospace'
  ctx.fillText(`LAYER: ${category_name.toUpperCase()}`, 34, 34)

  //Layer title
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 15px Inter, sans-serif'
  ctx.fillText(truncated_title, 34, 56)

  //4. Draw prominent Date Badge on top right
  ctx.fillStyle = 'rgba(11, 15, 25, 0.9)'
  ctx.fillRect(1060, 16, 200, 56)
  ctx.strokeStyle = '#3B82F6'
  ctx.lineWidth = 1.5
  ctx.strokeRect(1060, 16, 200, 56)

  ctx.fillStyle = '#60A5FA'
  ctx.font = '10px monospace'
  ctx.fillText('HISTORICAL DATE', 1074, 32)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 20px monospace'
  ctx.fillText(year_formatted, 1074, 56)

  //5. Draw bottom scrubber & progress bar
  ctx.fillStyle = 'rgba(11, 15, 25, 0.92)'
  ctx.fillRect(0, 680, 1280, 40)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
  ctx.beginPath()
  ctx.moveTo(0, 680)
  ctx.lineTo(1280, 680)
  ctx.stroke()

  //Progress track
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
  ctx.fillRect(20, 696, 1240, 6)

  //Progress fill
  ctx.fillStyle = '#3B82F6'
  ctx.fillRect(20, 696, Math.max(2, 1240*progress_ratio), 6)

  //Scrubber labels
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.font = '10px monospace'
  ctx.fillText(`${UfDate.formatYear(start_year)}`, 20, 714)
  ctx.textAlign = 'right'
  ctx.fillText(`${UfDate.formatYear(end_year)}  [${current_step + 1}/${total_steps}]`, 1260, 714)
  ctx.textAlign = 'left'
}

/**
 * Developer Video Export Modal supporting Stationary and Cycling timelapse modes.
 *
 * @param {VideoExportModalProps} arg0_props
 *
 * @returns {React.ReactElement | null}
 */
export const VideoExportModal: React.FC<VideoExportModalProps> = function (arg0_props) {
  //Convert from parameters
  let props = arg0_props
  let {
    activeLayerId: active_layer_id,
    availableKeyframes: available_keyframes,
    availableLayers: available_layers,
    isOpen: is_open,
    maxYear: max_year,
    minYear: min_year,
    onClose: on_close,
  } = props
  //Declare local instance variables

  let all_layer_keys: string[]
  let clear_all_cycling_layers: () => void
  let end_year: number
  let export_error: string | null
  let export_filename: string
  let export_mode: VideoExportMode
  let export_success: string | null
  let fps: number
  let handle_start_export: () => Promise<void>
  let is_exporting: boolean
  let keyframes_only: boolean
  let progress_pct: number
  let progress_status: string
  let select_all_cycling_layers: () => void
  let selected_cycling_layers: string[]
  let selected_stationary_layer: string
  let set_end_year: React.Dispatch<React.SetStateAction<number>>
  let set_export_error: React.Dispatch<React.SetStateAction<string | null>>
  let set_export_filename: React.Dispatch<React.SetStateAction<string>>
  let set_export_mode: React.Dispatch<React.SetStateAction<VideoExportMode>>
  let set_export_success: React.Dispatch<React.SetStateAction<string | null>>
  let set_fps: React.Dispatch<React.SetStateAction<number>>
  let set_is_exporting: React.Dispatch<React.SetStateAction<boolean>>
  let set_keyframes_only: React.Dispatch<React.SetStateAction<boolean>>
  let set_progress_pct: React.Dispatch<React.SetStateAction<number>>
  let set_progress_status: React.Dispatch<React.SetStateAction<string>>
  let set_selected_cycling_layers: React.Dispatch<React.SetStateAction<string[]>>
  let set_selected_stationary_layer: React.Dispatch<React.SetStateAction<string>>
  let set_start_year: React.Dispatch<React.SetStateAction<number>>
  let set_timestep_step: React.Dispatch<React.SetStateAction<number>>
  let set_timestep_unit: React.Dispatch<React.SetStateAction<TimestepUnit>>
  let start_year: number
  let timestep_step: number
  let timestep_unit: TimestepUnit
  let toggle_cycling_layer: (arg0_id: string) => void

  //Function body
  all_layer_keys = useMemo(() => Object.keys(available_layers), [available_layers])

  ;[export_mode, set_export_mode] = useState<VideoExportMode>('cycling')
  ;[selected_stationary_layer, set_selected_stationary_layer] = useState<string>(() => {
    return active_layer_id || Object.keys(available_layers)[0] || 'GDP_nominal_pc'
  })
  ;[timestep_unit, set_timestep_unit] = useState<TimestepUnit>('years')
  ;[timestep_step, set_timestep_step] = useState<number>(1)
  ;[keyframes_only, set_keyframes_only] = useState<boolean>(true)
  ;[start_year, set_start_year] = useState<number>(1800)
  ;[end_year, set_end_year] = useState<number>(2025)
  ;[fps, set_fps] = useState<number>(30)
  ;[export_filename, set_export_filename] = useState<string>(() => {
    let ext = 'mp4'
    if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported('video/mp4'))
      ext = 'webm'
    return `dataview_timelapse_${Date.now()}.${ext}`
  })
  ;[selected_cycling_layers, set_selected_cycling_layers] = useState<string[]>(() =>
    Object.keys(available_layers).slice(0, 8)
  )
  ;[is_exporting, set_is_exporting] = useState<boolean>(false)
  ;[progress_pct, set_progress_pct] = useState<number>(0)
  ;[progress_status, set_progress_status] = useState<string>('')
  ;[export_error, set_export_error] = useState<string | null>(null)
  ;[export_success, set_export_success] = useState<string | null>(null)

  select_all_cycling_layers = useCallback(() => {
    set_selected_cycling_layers(Object.keys(available_layers))
  }, [available_layers])

  clear_all_cycling_layers = useCallback(() => {
    set_selected_cycling_layers([])
  }, [])

  toggle_cycling_layer = useCallback((arg0_id: string) => {
    let id = arg0_id
    set_selected_cycling_layers((arg0_prev) => {
      if (arg0_prev.includes(id))
        return arg0_prev.filter((arg0_x) => arg0_x !== id)
      return [...arg0_prev, id]
    })
  }, [])

  handle_start_export = useCallback(async () => {
    let ext = 'webm'
    if (typeof MediaRecorder !== 'undefined' && (MediaRecorder.isTypeSupported('video/mp4') || MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')))
      ext = 'mp4'
    let clean_filename = export_filename.replace(/\.(mp4|webm)$/i, '') + `.${ext}`

    let chosen_layers: string[] = []
    if (export_mode === 'cycling') {
      chosen_layers = selected_cycling_layers.length > 0 ? selected_cycling_layers : (active_layer_id ? [active_layer_id] : Object.keys(available_layers).slice(0, 1))
    } else {
      chosen_layers = [selected_stationary_layer || active_layer_id || Object.keys(available_layers)[0] || 'GDP_nominal_pc']
    }

    if (props.onStartTimelapseExport) {
      on_close()
      await props.onStartTimelapseExport({
        endYear: end_year,
        filename: clean_filename,
        fps,
        keyframesOnly: keyframes_only,
        mode: export_mode,
        selectedLayers: chosen_layers,
        startYear: start_year,
        timestepStep: timestep_step,
      })
    }
  }, [
    active_layer_id,
    available_layers,
    end_year,
    export_filename,
    export_mode,
    fps,
    keyframes_only,
    on_close,
    props,
    selected_cycling_layers,
    selected_stationary_layer,
    start_year,
    timestep_step,
  ])

  //Guard clauses
  if (!is_open)
    return null

  //Return statement
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm select-none font-sans p-4">
      <div className="bg-card/95 border border-border text-card-foreground shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-border bg-card/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="movie" className="text-primary text-xl" />
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Developer Video Timelapse Export</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-primary/20 text-primary border border-primary/40 font-mono">
                  DEVELOPER ONLY
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Configure timelapse animation parameters and export compressed MP4 frames to exports/.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={on_close}
            disabled={is_exporting}
            className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground border border-border hover:bg-muted cursor-pointer"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Export Mode */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Export Mode</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => set_export_mode('stationary')}
                className={`p-2.5 border text-left flex flex-col gap-1 cursor-pointer transition-colors ${
                  export_mode === 'stationary'
                    ? 'bg-primary/15 border-primary text-foreground'
                    : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                  <Icon name="straighten" />
                  <span>Stationary Mode</span>
                </div>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  Displays the selected indicator across the entire timeline sequence.
                </p>
              </button>

              <button
                type="button"
                onClick={() => set_export_mode('cycling')}
                className={`p-2.5 border text-left flex flex-col gap-1 cursor-pointer transition-colors ${
                  export_mode === 'cycling'
                    ? 'bg-primary/15 border-primary text-foreground'
                    : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                  <Icon name="sync" />
                  <span>Cycling Mode</span>
                </div>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  Cycles through all active indicators per year before advancing to next keyframe year.
                </p>
              </button>
            </div>
          </div>

          {/* Stationary Indicator Selector */}
          {export_mode === 'stationary' && (
            <div className="space-y-1.5 border border-border p-2.5 bg-muted/20">
              <Label className="text-xs font-semibold text-foreground">
                Selected Indicator to Export
              </Label>
              <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto pr-1">
                {all_layer_keys.map((arg0_key) => {
                  let layer = available_layers[arg0_key]
                  let is_selected = selected_stationary_layer === arg0_key
                  return (
                    <button
                      key={arg0_key}
                      type="button"
                      onClick={() => set_selected_stationary_layer(arg0_key)}
                      className={`px-2 py-1 flex items-center justify-between border text-left text-[11px] cursor-pointer transition-colors ${
                        is_selected
                          ? 'bg-primary/20 border-primary text-foreground font-medium'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="truncate pr-1">{layer?.name || arg0_key}</span>
                      {is_selected && <Icon name="check" className="text-xs text-primary shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Cycling Indicators Selector */}
          {export_mode === 'cycling' && (
            <div className="space-y-1.5 border border-border p-2.5 bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  Active Indicators to Cycle ({selected_cycling_layers.length} selected)
                </Label>
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  <button
                    type="button"
                    onClick={select_all_cycling_layers}
                    className="text-primary hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-muted-foreground/40">•</span>
                  <button
                    type="button"
                    onClick={clear_all_cycling_layers}
                    className="text-muted-foreground hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto pr-1">
                {all_layer_keys.map((arg0_key) => {
                  let layer = available_layers[arg0_key]
                  let is_checked = selected_cycling_layers.includes(arg0_key)
                  return (
                    <button
                      key={arg0_key}
                      type="button"
                      onClick={() => toggle_cycling_layer(arg0_key)}
                      className={`px-2 py-1 flex items-center justify-between border text-left text-[11px] cursor-pointer transition-colors ${
                        is_checked
                          ? 'bg-primary/20 border-primary text-foreground font-medium'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="truncate pr-1">{layer?.name || arg0_key}</span>
                      {is_checked && <Icon name="check" className="text-xs text-primary shrink-0" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Timestep Settings */}
          <div className="space-y-2 border border-border p-2.5 bg-muted/20">
            <Label className="text-xs font-semibold text-foreground">Timestep & Keyframe Interpolation</Label>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={keyframes_only}
                  onChange={(arg0_e) => set_keyframes_only(arg0_e.target.checked)}
                  className="rounded-none border-border"
                />
                <span className="text-xs font-medium text-foreground">
                  Move only between unique raster keyframes (No interpolation)
                </span>
              </label>
            </div>

            {!keyframes_only && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Timestep Step Size</span>
                  <Input
                    type="number"
                    min={1}
                    value={timestep_step}
                    onChange={(arg0_e) => set_timestep_step(Math.max(1, parseInt(arg0_e.target.value) || 1))}
                    className="h-7 text-xs bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Unit</span>
                  <div className="grid grid-cols-3 gap-1 h-7">
                    {(['years', 'months', 'days'] as TimestepUnit[]).map((arg0_u) => (
                      <button
                        key={arg0_u}
                        type="button"
                        onClick={() => set_timestep_unit(arg0_u)}
                        className={`capitalize text-xs border cursor-pointer ${
                          timestep_unit === arg0_u
                            ? 'bg-primary text-primary-foreground font-bold'
                            : 'bg-background text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {arg0_u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Range & Output Settings */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Start Year</span>
              <Input
                type="number"
                value={start_year}
                onChange={(arg0_e) => set_start_year(parseInt(arg0_e.target.value) || min_year)}
                className="h-7 text-xs bg-background"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">End Year</span>
              <Input
                type="number"
                value={end_year}
                onChange={(arg0_e) => set_end_year(parseInt(arg0_e.target.value) || max_year)}
                className="h-7 text-xs bg-background"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Target FPS</span>
              <Input
                type="number"
                min={1}
                max={60}
                value={fps}
                onChange={(arg0_e) => set_fps(parseInt(arg0_e.target.value) || 30)}
                className="h-7 text-xs bg-background"
              />
            </div>
          </div>

          {/* Filename */}
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground">Export Filename</span>
            <Input
              type="text"
              value={export_filename}
              onChange={(arg0_e) => set_export_filename(arg0_e.target.value)}
              className="h-7 text-xs bg-background font-mono"
            />
          </div>

          {/* Progress / Status Feedback */}
          {is_exporting && (
            <div className="space-y-1.5 p-2.5 bg-primary/10 border border-primary/30">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-primary font-bold">{progress_status}</span>
                <span>{progress_pct}%</span>
              </div>
              <div className="w-full h-2 bg-muted overflow-hidden">
                <div
                  style={{ width: `${progress_pct}%` }}
                  className="h-full bg-primary transition-all duration-150"
                />
              </div>
            </div>
          )}

          {export_error && (
            <div className="p-2.5 bg-destructive/15 border border-destructive/40 text-destructive text-xs flex items-center gap-2">
              <Icon name="error" />
              <span>{export_error}</span>
            </div>
          )}

          {export_success && (
            <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs flex items-center gap-2">
              <Icon name="check_circle" />
              <span>{export_success}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-card/60 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Target Destination: <code className="text-foreground">exports/</code> on server
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={on_close}
              disabled={is_exporting}
              className="px-3 py-1.5 border border-border hover:bg-muted text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handle_start_export}
              disabled={is_exporting}
              className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <Icon name="videocam" />
              <span>{is_exporting ? 'Starting...' : 'Start Timelapse Export'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
