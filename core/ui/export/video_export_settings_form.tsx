import React from 'react'
import { Icon } from '@ui/components/icon'
import { Input } from '@ui/components/input'
import { Label } from '@ui/components/label'
import { getDefaultExportZoom } from './video_export_utils'
import type { TimestepUnit, VideoExportMode } from './video_export_utils'

export interface VideoExportSettingsFormProps {
  availablePartialFolders: any[]
  concurrency: number
  endYear: number
  exportFilename: string
  fps: number
  handleZoomChange: (arg0_zoom: number) => void
  keepFrames: boolean
  keyframesOnly: boolean
  legendPosition: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  maxRamPerThreadMb: number
  maxYear: number
  minYear: number
  previewCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>
  projection: string
  resolution: string
  resumeFolder: string
  setConcurrency: React.Dispatch<React.SetStateAction<number>>
  setEndYear: React.Dispatch<React.SetStateAction<number>>
  setExportFilename: React.Dispatch<React.SetStateAction<string>>
  setExportMode: React.Dispatch<React.SetStateAction<VideoExportMode>>
  setFps: React.Dispatch<React.SetStateAction<number>>
  setKeepFrames: React.Dispatch<React.SetStateAction<boolean>>
  setKeyframesOnly: React.Dispatch<React.SetStateAction<boolean>>
  setLegendPosition: React.Dispatch<React.SetStateAction<'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'>>
  setMaxRamPerThreadMb: React.Dispatch<React.SetStateAction<number>>
  setProjection: React.Dispatch<React.SetStateAction<string>>
  setResolution: React.Dispatch<React.SetStateAction<string>>
  setResumeFolder: React.Dispatch<React.SetStateAction<string>>
  setStartYear: React.Dispatch<React.SetStateAction<number>>
  setTimestepStep: React.Dispatch<React.SetStateAction<number>>
  setTimestepUnit: React.Dispatch<React.SetStateAction<TimestepUnit>>
  startYear: number
  timestepStep: number
  timestepUnit: TimestepUnit
  zoom: number
}

/**
 * Settings configuration form for video timelapse export parameters.
 *
 * @param {VideoExportSettingsFormProps} arg0_props
 *
 * @returns {React.ReactElement}
 */
export let VideoExportSettingsForm: React.FC<VideoExportSettingsFormProps> = function (arg0_props) {
  //Convert from parameters
  let props = arg0_props
  let {
    availablePartialFolders: available_partial_folders,
    concurrency,
    endYear: end_year,
    exportFilename: export_filename,
    fps,
    handleZoomChange: handle_zoom_change,
    keepFrames: keep_frames,
    keyframesOnly: keyframes_only,
    legendPosition: legend_position,
    maxRamPerThreadMb: max_ram_per_thread_mb,
    maxYear: max_year,
    minYear: min_year,
    previewCanvasRef: preview_canvas_ref,
    projection,
    resolution,
    resumeFolder: resume_folder,
    setConcurrency: set_concurrency,
    setEndYear: set_end_year,
    setExportFilename: set_export_filename,
    setExportMode: set_export_mode,
    setFps: set_fps,
    setKeepFrames: set_keep_frames,
    setKeyframesOnly: set_keyframes_only,
    setLegendPosition: set_legend_position,
    setMaxRamPerThreadMb: set_max_ram_per_thread_mb,
    setProjection: set_projection,
    setResolution: set_resolution,
    setResumeFolder: set_resume_folder,
    setStartYear: set_start_year,
    setTimestepStep: set_timestep_step,
    setTimestepUnit: set_timestep_unit,
    startYear: start_year,
    timestepStep: timestep_step,
    timestepUnit: timestep_unit,
    zoom,
  } = props

  //Function body
  //Return statement
  return (
    <div className="space-y-4">
      {/* 16:9 Video Framing Preview & Zoom Adjustment */}
      <div className="space-y-2 border border-border p-3 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Icon name="crop_16_9" className="text-primary text-sm" />
            <Label className="text-xs font-semibold text-foreground">16:9 Video Framing Preview</Label>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">
            Safe-Area & Overlay Alignment Preview
          </span>
        </div>

        {/* 16:9 Preview Canvas Frame */}
        <div className="relative w-full aspect-video rounded border border-border/80 bg-[#0B0F19] overflow-hidden flex items-center justify-center shadow-inner">
          <canvas
            ref={preview_canvas_ref}
            className="w-full h-full object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        {/* Zoom Controls Bar */}
        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <Icon name="zoom_in" className="text-xs" />
              Map Zoom Level: <strong className="font-mono text-foreground">{zoom.toFixed(2)}x</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  let cur_h = resolution === '1440p' ? 1440 : resolution === '720p' ? 720 : 1080
                  let fit_h_zoom = parseFloat(Math.log2(cur_h / 180).toFixed(2))
                  handle_zoom_change(fit_h_zoom)
                }}
                className="px-1.5 py-0.5 text-[10px] border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer font-medium"
                title="Fill 100% of viewport height (eliminates vertical black bars)"
              >
                Fit Height
              </button>
              <button
                type="button"
                onClick={() => {
                  let cur_w = resolution === '1440p' ? 2560 : resolution === '720p' ? 1280 : 1920
                  let fit_w_zoom = parseFloat(Math.log2(cur_w / 360).toFixed(2))
                  handle_zoom_change(fit_w_zoom)
                }}
                className="px-1.5 py-0.5 text-[10px] border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer font-medium"
                title="Fit all 360 degrees of longitude edge-to-edge"
              >
                Fit Width
              </button>
              <button
                type="button"
                onClick={() => handle_zoom_change(zoom - 0.15)}
                className="px-1.5 py-0.5 text-[10px] border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => handle_zoom_change(zoom + 0.15)}
                className="px-1.5 py-0.5 text-[10px] border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0.4"
              max="4.0"
              step="0.05"
              value={zoom}
              onChange={(arg0_e) => handle_zoom_change(parseFloat(arg0_e.target.value))}
              className="flex-1 accent-primary cursor-pointer h-1.5 bg-muted rounded-lg"
            />
            <Input
              type="number"
              step="0.05"
              min="0.1"
              max="5.0"
              value={zoom}
              onChange={(arg0_e) => handle_zoom_change(parseFloat(arg0_e.target.value) || 1.0)}
              className="h-7 w-20 text-xs bg-background font-mono text-center"
            />
          </div>
        </div>
      </div>

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
                    className={`capitalize text-xs border cursor-pointer ${timestep_unit === arg0_u
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

      {/* Projection & Resolution Preset */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground">Map Projection</span>
          <select
            value={projection}
            onChange={(arg0_e) => {
              let p = arg0_e.target.value
              set_projection(p)
              let w = resolution === '1440p' ? 2560 : resolution === '720p' ? 1280 : 1920
              let h = resolution === '1440p' ? 1440 : resolution === '720p' ? 720 : 1080
              handle_zoom_change(getDefaultExportZoom(p, w, h))
            }}
            className="w-full h-7 text-xs bg-background border border-border px-2 text-foreground focus:outline-hidden"
          >
            <option value="EqualEarth">Equal Earth</option>
            <option value="Mercator">Mercator</option>
            <option value="Globe">Globe</option>
            <option value="Equirectangular">Equirectangular</option>
          </select>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground">Resolution Preset</span>
          <select
            value={resolution}
            onChange={(arg0_e) => {
              let r = arg0_e.target.value
              set_resolution(r)
              let w = r === '1440p' ? 2560 : r === '720p' ? 1280 : 1920
              let h = r === '1440p' ? 1440 : r === '720p' ? 720 : 1080
              handle_zoom_change(getDefaultExportZoom(projection, w, h))
            }}
            className="w-full h-7 text-xs bg-background border border-border px-2 text-foreground focus:outline-hidden"
          >
            <option value="1080p">1080p (1920x1080 Full HD)</option>
            <option value="1440p">1440p (2560x1440 2K)</option>
            <option value="720p">720p (1280x720 HD)</option>
          </select>
        </div>
      </div>

      {/* Legend Position Selector */}
      <div className="space-y-1.5 border border-border p-2.5 bg-muted/20">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Icon name="palette" className="text-primary text-xs" />
            <span>Legend Bar Position</span>
          </Label>
          <span className="text-[10px] text-muted-foreground font-mono capitalize">
            {legend_position.replace('-', ' ').replace('center', 'centre')}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: 'top-left', label: 'NW' },
            { id: 'top-center', label: 'N' },
            { id: 'top-right', label: 'NE' },
            { id: 'bottom-left', label: 'SW' },
            { id: 'bottom-center', label: 'S' },
            { id: 'bottom-right', label: 'SE' },
          ].map((arg0_pos) => (
            <button
              key={arg0_pos.id}
              type="button"
              onClick={() => set_legend_position(arg0_pos.id as any)}
              className={`h-7 text-xs border cursor-pointer transition-colors ${legend_position === arg0_pos.id
                  ? 'bg-primary text-primary-foreground font-bold border-primary'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}
            >
              {arg0_pos.label}
            </button>
          ))}
        </div>
      </div>

      {/* Concurrency Threads Control */}
      <div className="space-y-1.5 border border-border p-2.5 bg-muted/20">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Icon name="memory" className="text-primary text-xs" />
            <span>Parallel Concurrency Threads</span>
          </Label>
          <span className="text-[10px] text-muted-foreground font-mono">
            {concurrency === 1 ? '1 worker (Sequential)' : `${concurrency} parallel browser workers`}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {[
            { count: 1, label: '1 (Single)' },
            { count: 2, label: '2 Threads' },
            { count: 4, label: '4 (Balanced)' },
            { count: 8, label: '8 (Turbo)' },
          ].map((arg0_t) => (
            <button
              key={arg0_t.count}
              type="button"
              onClick={() => set_concurrency(arg0_t.count)}
              className={`h-7 text-xs border cursor-pointer transition-colors ${concurrency === arg0_t.count
                  ? 'bg-primary text-primary-foreground font-bold border-primary'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}
            >
              {arg0_t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">
            Spawns parallel headless browser workers per indicator to speed up render.
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Custom:</span>
            <Input
              type="number"
              min={1}
              max={16}
              value={concurrency}
              onChange={(arg0_e) => set_concurrency(Math.max(1, Math.min(16, parseInt(arg0_e.target.value) || 1)))}
              className="h-6 w-14 text-xs bg-background font-mono text-center"
            />
          </div>
        </div>
      </div>

      {/* Max RAM Per Worker Thread Control */}
      <div className="space-y-1.5 border border-border p-2.5 bg-muted/20">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Icon name="speed" className="text-primary text-xs" />
            <span>Max RAM Per Worker Thread</span>
          </Label>
          <span className="text-[10px] text-muted-foreground font-mono">
            {max_ram_per_thread_mb === 0 ? 'No Cap (Default)' : `${max_ram_per_thread_mb >= 1024 ? `${max_ram_per_thread_mb / 1024} GB` : `${max_ram_per_thread_mb} MB`} per thread`}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: 'No Cap', mb: 0 },
            { label: '2 GB', mb: 2048 },
            { label: '4 GB', mb: 4096 },
            { label: '8 GB', mb: 8192 },
          ].map((arg0_ram) => (
            <button
              key={arg0_ram.mb}
              type="button"
              onClick={() => set_max_ram_per_thread_mb(arg0_ram.mb)}
              className={`h-7 text-xs border cursor-pointer transition-colors ${max_ram_per_thread_mb === arg0_ram.mb
                  ? 'bg-primary text-primary-foreground font-bold border-primary'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}
            >
              {arg0_ram.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground">
            Sets V8 max heap space to prevent memory leaks during long multi-variable renders.
          </span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Custom MB:</span>
            <Input
              type="number"
              min={0}
              step={512}
              value={max_ram_per_thread_mb || ''}
              placeholder="0 (uncapped)"
              onChange={(arg0_e) => set_max_ram_per_thread_mb(Math.max(0, parseInt(arg0_e.target.value) || 0))}
              className="h-6 w-24 text-xs bg-background font-mono text-center"
            />
          </div>
        </div>
      </div>

      {/* Resume Partial Render (if available) */}
      {available_partial_folders.length > 0 && (
        <div className="space-y-1.5 border border-amber-500/30 bg-amber-500/10 p-2.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
              <Icon name="history" className="text-amber-400 text-xs" />
              <span>Resume from Partial Render</span>
            </Label>
            <span className="text-[10px] text-amber-200/80 font-mono">
              {available_partial_folders.length} partial render{available_partial_folders.length > 1 ? 's' : ''} detected
            </span>
          </div>
          <select
            value={resume_folder}
            onChange={(arg0_e) => {
              let folder_id = arg0_e.target.value
              set_resume_folder(folder_id)
              if (folder_id) {
                set_export_filename(`${folder_id}.mp4`)
                let matched = available_partial_folders.find((arg0_f) => arg0_f.folder === folder_id)
                if (matched && matched.manifest && matched.manifest.mode) {
                  set_export_mode(matched.manifest.mode)
                }
              }
            }}
            className="w-full h-7 text-xs bg-background border border-border px-2 text-foreground focus:outline-hidden"
          >
            <option value="">-- None (Start fresh render) --</option>
            {available_partial_folders.map((arg0_f) => (
              <option key={arg0_f.folder} value={arg0_f.folder}>
                {arg0_f.folder} ({arg0_f.completedFrames}/{arg0_f.totalFrames || '?'} frames rendered)
              </option>
            ))}
          </select>
          <span className="text-[10px] text-amber-200/80 block">
            Selecting a folder skips all existing complete frames and resumes remaining indicators.
          </span>
        </div>
      )}

      {/* Keep Frames Option & Filename */}
      <div className="space-y-2 border border-border p-2.5 bg-muted/20">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={keep_frames}
            onChange={(arg0_e) => set_keep_frames(arg0_e.target.checked)}
            className="rounded-none border-border accent-primary cursor-pointer"
          />
          <div className="flex flex-col">
            <span className="text-xs font-medium text-foreground">Keep individual PNG frames after render</span>
            <span className="text-[10px] text-muted-foreground">
              Preserves exported frames in exports/frames/ instead of deleting them post-stitching.
            </span>
          </div>
        </label>

        <div className="space-y-1 pt-1 border-t border-border/50">
          <span className="text-[11px] text-muted-foreground">Export Filename</span>
          <Input
            type="text"
            value={export_filename}
            onChange={(arg0_e) => set_export_filename(arg0_e.target.value)}
            className="h-7 text-xs bg-background font-mono"
          />
        </div>
      </div>
    </div>
  )
}
