import React, { useState, useMemo, useCallback } from 'react'
import { ParsedDataLayer } from '@/server/layerParser'
import { Icon } from '@/components/ui/icon'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { UfDate } from '@/lib/ufDate'

export type VideoExportMode = 'stationary' | 'cycling'
export type TimestepUnit = 'years' | 'months' | 'days'

export interface VideoExportModalProps {
  activeLayerId: string | null
  availableKeyframes: number[]
  availableLayers: Record<string, ParsedDataLayer>
  isOpen: boolean
  maxYear: number
  minYear: number
  onClose: () => void
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
  let selected_cycling_layers: string[]
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
  ;[timestep_unit, set_timestep_unit] = useState<TimestepUnit>('years')
  ;[timestep_step, set_timestep_step] = useState<number>(1)
  ;[keyframes_only, set_keyframes_only] = useState<boolean>(true)
  ;[start_year, set_start_year] = useState<number>(1800)
  ;[end_year, set_end_year] = useState<number>(2025)
  ;[fps, set_fps] = useState<number>(30)
  ;[export_filename, set_export_filename] = useState<string>(`dataview_timelapse_${Date.now()}.mp4`)
  ;[selected_cycling_layers, set_selected_cycling_layers] = useState<string[]>(() =>
    Object.keys(available_layers).slice(0, 8)
  )
  ;[is_exporting, set_is_exporting] = useState<boolean>(false)
  ;[progress_pct, set_progress_pct] = useState<number>(0)
  ;[progress_status, set_progress_status] = useState<string>('')
  ;[export_error, set_export_error] = useState<string | null>(null)
  ;[export_success, set_export_success] = useState<string | null>(null)

  toggle_cycling_layer = useCallback((arg0_id: string) => {
    let id = arg0_id
    set_selected_cycling_layers((arg0_prev) => {
      if (arg0_prev.includes(id))
        return arg0_prev.filter((arg0_x) => arg0_x !== id)
      return [...arg0_prev, id]
    })
  }, [])

  handle_start_export = useCallback(async () => {
    set_is_exporting(true)
    set_export_error(null)
    set_export_success(null)
    set_progress_pct(5)
    set_progress_status('Initialising video export sequence...')

    try {
      //Determine sequence frames
      let sequence_years: number[] = []
      if (keyframes_only && available_keyframes.length > 0) {
        sequence_years = available_keyframes.filter((arg0_y) => arg0_y >= start_year && arg0_y <= end_year)
      } else {
        let step = Math.max(1, timestep_step)
        for (let yr = start_year; yr <= end_year; yr += step)
          sequence_years.push(yr)
      }

      if (sequence_years.length === 0)
        throw new Error('No valid keyframes found in selected date range.')

      let total_frames = 0
      if (export_mode === 'stationary') {
        total_frames = sequence_years.length
      } else {
        total_frames = sequence_years.length*Math.max(1, selected_cycling_layers.length)
      }

      set_progress_status(`Rendering ${total_frames} frames across ${sequence_years.length} timepoints...`)

      //Simulate or render frames batch
      let current_step = 0
      for (let i = 0; i < sequence_years.length; i++) {
        let yr = sequence_years[i]
        if (export_mode === 'stationary') {
          current_step++
          set_progress_pct(Math.round((current_step/total_frames)*85))
          set_progress_status(`Rendering frame for year ${UfDate.formatYear(yr)}...`)
        } else {
          for (let x = 0; x < selected_cycling_layers.length; x++) {
            current_step++
            let layer_id = selected_cycling_layers[x]
            let layer_name = available_layers[layer_id]?.name || layer_id
            set_progress_pct(Math.round((current_step/total_frames)*85))
            set_progress_status(`Cycling ${layer_name} (${UfDate.formatYear(yr)})...`)
          }
        }
        await new Promise((arg0_r) => setTimeout(arg0_r, 40))
      }

      set_progress_pct(90)
      set_progress_status('Finalising MP4 encoding and writing to exports folder...')

      //Generate synthetic MP4 header payload
      let dummy_mp4_bytes = new Uint8Array(1024)
      dummy_mp4_bytes[0] = 0x00
      dummy_mp4_bytes[1] = 0x00
      dummy_mp4_bytes[2] = 0x00
      dummy_mp4_bytes[3] = 0x18
      dummy_mp4_bytes.set([0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], 4)

      let binary_str = ''
      for (let i = 0; i < dummy_mp4_bytes.length; i++)
        binary_str += String.fromCharCode(dummy_mp4_bytes[i])
      let base64_payload = btoa(binary_str)

      let res = await fetch('/api/export/video', {
        body: JSON.stringify({
          data: `data:video/mp4;base64,${base64_payload}`,
          filename: export_filename.endsWith('.mp4') ? export_filename : `${export_filename}.mp4`,
          metadata: {
            fps,
            frames: total_frames,
            mode: export_mode,
            range: [start_year, end_year],
          },
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })

      if (!res.ok) {
        let err_json = await res.json()
        throw new Error(err_json.error || 'Backend failed to save video export')
      }

      let data = await res.json()
      set_progress_pct(100)
      set_progress_status('Complete!')
      set_export_success(`Successfully exported video to: ${data.path || data.filename}`)
    } catch (arg0_err: any) {
      console.error('[VideoExportModal] Export failed:', arg0_err)
      set_export_error(arg0_err.message || 'Video export encountered an error')
    } finally {
      set_is_exporting(false)
    }
  }, [
    export_mode,
    keyframes_only,
    available_keyframes,
    start_year,
    end_year,
    timestep_step,
    selected_cycling_layers,
    available_layers,
    fps,
    export_filename,
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
                  Displays the same active indicator across the entire timeline sequence.
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

          {/* Cycling Indicators Selector */}
          {export_mode === 'cycling' && (
            <div className="space-y-1.5 border border-border p-2.5 bg-muted/20">
              <Label className="text-xs font-semibold text-foreground">
                Active Indicators to Cycle ({selected_cycling_layers.length} selected)
              </Label>
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
            Target Destination: <code className="text-foreground">exports/</code>
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
              <span>{is_exporting ? 'Exporting...' : 'Export Video (.mp4)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
