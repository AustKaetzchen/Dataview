import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { ParsedDataLayer } from '@/server/layerParser'
import { Icon } from '@/components/ui/icon'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { UfDate } from '@/lib/ufDate'

export type VideoExportMode = 'stationary' | 'cycling'
export type TimestepUnit = 'years' | 'months' | 'days'

export interface CohortOption {
  key: string
  label: string
}

export interface IndicatorFolderItem {
  cohorts: CohortOption[]
  id: string
  isFolder: boolean
  name: string
}

export interface StartTimelapseExportOptions {
  concurrency?: number
  endYear: number
  filename: string
  fps: number
  height?: number
  keyframesOnly: boolean
  legendPosition?: 'top-left' | 'bottom-left' | 'bottom-center'
  mode: VideoExportMode
  projection?: string
  selectedLayers: string[]
  startYear: number
  timestepStep: number
  width?: number
  zoom?: number
}

export interface VideoExportModalProps {
  activeLayerId: string | null
  availableKeyframes: number[]
  availableLayers: Record<string, ParsedDataLayer>
  colorPalette?: string
  currentProjection?: string
  isOpen: boolean
  legendSubtitle?: string
  legendTitle?: string
  maxVal?: number
  maxYear: number
  minVal?: number
  minYear: number
  onClose: () => void
  onStartTimelapseExport?: (arg0_options: StartTimelapseExportOptions) => Promise<void>
  renderedCanvas?: HTMLCanvasElement | null
  timelineYear?: number
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
  let all_cohort_keys: string[]
  let all_layer_keys: string[]
  let clear_all_cycling_layers: () => void
  let concurrency: number
  let end_year: number
  let expanded_folders: Record<string, boolean>
  let export_error: string | null
  let export_filename: string
  let export_mode: VideoExportMode
  let export_success: string | null
  let fps: number
  let get_default_zoom: (arg0_proj: string, arg1_w?: number, arg2_h?: number) => number
  let handle_start_export: () => Promise<void>
  let handle_zoom_change: (arg0_new_zoom: number) => void
  let indicator_folders: IndicatorFolderItem[]
  let is_exporting: boolean
  let keyframes_only: boolean
  let legend_position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  let preview_canvas_ref: React.MutableRefObject<HTMLCanvasElement | null>
  let progress_pct: number
  let progress_status: string
  let projection: string
  let resolution: string
  let select_all_cycling_layers: () => void
  let selected_cycling_layers: string[]
  let selected_stationary_layer: string
  let set_concurrency: React.Dispatch<React.SetStateAction<number>>
  let set_end_year: React.Dispatch<React.SetStateAction<number>>
  let set_expanded_folders: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  let set_export_error: React.Dispatch<React.SetStateAction<string | null>>
  let set_export_filename: React.Dispatch<React.SetStateAction<string>>
  let set_export_mode: React.Dispatch<React.SetStateAction<VideoExportMode>>
  let set_export_success: React.Dispatch<React.SetStateAction<string | null>>
  let set_fps: React.Dispatch<React.SetStateAction<number>>
  let set_is_exporting: React.Dispatch<React.SetStateAction<boolean>>
  let set_keyframes_only: React.Dispatch<React.SetStateAction<boolean>>
  let set_legend_position: React.Dispatch<React.SetStateAction<'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'>>
  let set_progress_pct: React.Dispatch<React.SetStateAction<number>>
  let set_progress_status: React.Dispatch<React.SetStateAction<string>>
  let set_projection: React.Dispatch<React.SetStateAction<string>>
  let set_resolution: React.Dispatch<React.SetStateAction<string>>
  let set_selected_cycling_layers: React.Dispatch<React.SetStateAction<string[]>>
  let set_selected_stationary_layer: React.Dispatch<React.SetStateAction<string>>
  let set_start_year: React.Dispatch<React.SetStateAction<number>>
  let set_timestep_step: React.Dispatch<React.SetStateAction<number>>
  let set_timestep_unit: React.Dispatch<React.SetStateAction<TimestepUnit>>
  let set_zoom: React.Dispatch<React.SetStateAction<number>>
  let start_year: number
  let timestep_step: number
  let timestep_unit: TimestepUnit
  let toggle_cycling_layer: (arg0_id: string) => void
  let toggle_expanded_folder: (arg0_id: string) => void
  let toggle_folder_cohorts: (arg0_folder: IndicatorFolderItem) => void
  let zoom: number

  //Function body
  all_layer_keys = useMemo(() => Object.keys(available_layers), [available_layers])

  indicator_folders = useMemo<IndicatorFolderItem[]>(() => {
    let result: IndicatorFolderItem[] = []
    let keys = Object.keys(available_layers)

    for (let i = 0; i < keys.length; i++) {
      let k = keys[i]
      let layer = available_layers[k]
      if (!layer)
        continue

      //1. Sub-layers (e.g. labourforce_total)
      if (layer.sub_layers && layer.sub_layers.length > 0) {
        result.push({
          cohorts: layer.sub_layers.map((arg0_sub) => ({
            key: arg0_sub.id,
            label: arg0_sub.name,
          })),
          id: k,
          isFolder: true,
          name: layer.name,
        })
        continue
      }

      //2. Professions
      if (k === 'professions_percentage' || k === 'professions_total') {
        let title_prefix = k === 'professions_percentage' ? 'Professions (%)' : 'Professions (Total)'
        result.push({
          cohorts: [
            { key: `${k}::profession=agriculture&gender=t`, label: 'Agriculture' },
            { key: `${k}::profession=informal_labour&gender=t`, label: 'Informal Labour' },
            { key: `${k}::profession=manufacturing&gender=t`, label: 'Manufacturing' },
            { key: `${k}::profession=services&gender=t`, label: 'Services' },
            { key: `${k}::profession=not_in_work&gender=t`, label: 'Not in Work' },
          ],
          id: k,
          isFolder: true,
          name: title_prefix,
        })
        continue
      }

      //3. Age/Sex
      if (k === 'age_sex') {
        let age_brackets = [
          { id: '00', name: '0-1yo' },
          { id: '01', name: '1-5yo' },
          { id: '05', name: '5-10yo' },
          { id: '10', name: '10-15yo' },
          { id: '15', name: '15-20yo' },
          { id: '20', name: '20-25yo' },
          { id: '25', name: '25-30yo' },
          { id: '30', name: '30-35yo' },
          { id: '35', name: '35-40yo' },
          { id: '40', name: '40-45yo' },
          { id: '45', name: '45-50yo' },
          { id: '50', name: '50-55yo' },
          { id: '55', name: '55-60yo' },
          { id: '60', name: '60-65yo' },
          { id: '65', name: '65-70yo' },
          { id: '70', name: '70-75yo' },
          { id: '75', name: '75-80yo' },
          { id: '80', name: '80+yo' },
        ]
        let age_cohorts: CohortOption[] = []
        for (let x = 0; x < age_brackets.length; x++) {
          age_cohorts.push({
            key: `age_sex::gender=f&age=${age_brackets[x].id}`,
            label: `Female (${age_brackets[x].name})`,
          })
        }
        for (let x = 0; x < age_brackets.length; x++) {
          age_cohorts.push({
            key: `age_sex::gender=m&age=${age_brackets[x].id}`,
            label: `Male (${age_brackets[x].name})`,
          })
        }
        result.push({
          cohorts: age_cohorts,
          id: k,
          isFolder: true,
          name: 'Age/Sex (Total)',
        })
        continue
      }

      //4. Wealth/Income
      if (k === 'wealth_income') {
        result.push({
          cohorts: [
            { key: 'wealth_income::indicator=net_wealth', label: 'Net Wealth' },
            { key: 'wealth_income::indicator=net_income', label: 'Net Income' },
            { key: 'wealth_income::indicator=disposable_income', label: 'Disposable Income' },
            { key: 'wealth_income::indicator=discretionary_income', label: 'Discretionary Income' },
          ],
          id: k,
          isFolder: true,
          name: 'Wealth/Income',
        })
        continue
      }

      //5. Deaths
      if (k === 'deaths') {
        result.push({
          cohorts: [
            { key: 'deaths::gender=female', label: 'Female Deaths' },
            { key: 'deaths::gender=male', label: 'Male Deaths' },
          ],
          id: k,
          isFolder: true,
          name: 'Deaths',
        })
        continue
      }

      //6. Migration (Gender)
      if (k === 'migration_gender') {
        result.push({
          cohorts: [
            { key: 'migration_gender::gender=female', label: 'Female Migration' },
            { key: 'migration_gender::gender=male', label: 'Male Migration' },
          ],
          id: k,
          isFolder: true,
          name: 'Migration (Gender)',
        })
        continue
      }

      //7. Standalone layer
      result.push({
        cohorts: [{ key: k, label: layer.name || k }],
        id: k,
        isFolder: false,
        name: layer.name || k,
      })
    }

    return result
  }, [available_layers])

  all_cohort_keys = useMemo(() => {
    let keys: string[] = []
    for (let i = 0; i < indicator_folders.length; i++) {
      let f = indicator_folders[i]
      for (let x = 0; x < f.cohorts.length; x++) {
        keys.push(f.cohorts[x].key)
      }
    }
    return keys
  }, [indicator_folders])

  get_default_zoom = useCallback((arg0_proj: string, arg1_w?: number, arg2_h?: number): number => {
    let h = arg2_h || (resolution === '1440p' ? 1440 : resolution === '720p' ? 720 : 1080)
    let p = arg0_proj.toLowerCase()
    let w = arg1_w || (resolution === '1440p' ? 2560 : resolution === '720p' ? 1280 : 1920)

    if (p === 'equirectangular' || p.includes('equirect')) {
      // Fit full width of target resolution (2.83 for 1440p)
      let ideal = Math.log2(w / 360)
      return Math.max(1.0, Math.min(4.0, parseFloat(ideal.toFixed(2))))
    } else if (p === 'equalearth' || p.includes('earth')) {
      let ideal = Math.log2((h*0.96) / 180)
      return Math.max(1.0, Math.min(4.0, parseFloat(ideal.toFixed(2))))
    } else if (p === 'mercator') {
      return 0.95
    } else if (p === 'globe') {
      return 0.0
    }

    return 2.85
  }, [resolution])

  ;[concurrency, set_concurrency] = useState<number>(4)
  ;[export_mode, set_export_mode] = useState<VideoExportMode>('cycling')
  ;[selected_stationary_layer, set_selected_stationary_layer] = useState<string>(() => {
    return active_layer_id || Object.keys(available_layers)[0] || 'GDP_nominal_pc'
  })
  ;[timestep_unit, set_timestep_unit] = useState<TimestepUnit>('years')
  ;[timestep_step, set_timestep_step] = useState<number>(1)
  ;[keyframes_only, set_keyframes_only] = useState<boolean>(true)
  ;[legend_position, set_legend_position] = useState<'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'>('bottom-center')
  ;[start_year, set_start_year] = useState<number>(1800)
  ;[end_year, set_end_year] = useState<number>(2025)
  ;[fps, set_fps] = useState<number>(30)
  ;[projection, set_projection] = useState<string>(props.currentProjection || 'EqualEarth')
  ;[zoom, set_zoom] = useState<number>(() => {
    return get_default_zoom(props.currentProjection || 'EqualEarth')
  })
  preview_canvas_ref = useRef<HTMLCanvasElement | null>(null)
  ;[resolution, set_resolution] = useState<string>('1080p')
  ;[export_filename, set_export_filename] = useState<string>(() => {
    return `dataview_timelapse_${Date.now()}.mp4`
  })
  ;[expanded_folders, set_expanded_folders] = useState<Record<string, boolean>>({
    professions_percentage: true,
    age_sex: false,
    labourforce_total: false,
  })
  ;[selected_cycling_layers, set_selected_cycling_layers] = useState<string[]>(() => {
    let initial: string[] = []
    let keys = Object.keys(available_layers)
    for (let i = 0; i < Math.min(3, keys.length); i++) {
      let k = keys[i]
      if (k === 'professions_percentage') {
        initial.push(
          `${k}::profession=agriculture&gender=t`,
          `${k}::profession=informal_labour&gender=t`,
          `${k}::profession=manufacturing&gender=t`,
          `${k}::profession=services&gender=t`,
          `${k}::profession=not_in_work&gender=t`
        )
      } else {
        initial.push(k)
      }
    }
    return initial
  })
  ;[is_exporting, set_is_exporting] = useState<boolean>(false)
  ;[progress_pct, set_progress_pct] = useState<number>(0)
  ;[progress_status, set_progress_status] = useState<string>('')
  ;[export_error, set_export_error] = useState<string | null>(null)
  ;[export_success, set_export_success] = useState<string | null>(null)

  handle_zoom_change = useCallback((arg0_new_zoom: number) => {
    let clamped = Math.max(0.1, Math.min(4.0, Math.round(arg0_new_zoom*100)/100))
    set_zoom(clamped)
    if (typeof (window as any).__setMapZoom === 'function') {
      ;(window as any).__setMapZoom(clamped)
    }
  }, [])

  //Draw live 16:9 framing preview canvas showing map positioning relative to UI overlays
  useEffect(() => {
    let canvas = preview_canvas_ref.current
    if (!canvas)
      return

    let ctx = canvas.getContext('2d')
    if (!ctx)
      return

    let w = 640
    let h = 360
    canvas.width = w
    canvas.height = h

    //1. Clear dark background
    ctx.fillStyle = '#0B0F19'
    ctx.fillRect(0, 0, w, h)

    //2. Draw graticule lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    ctx.lineWidth = 1
    for (let x = 0; x <= w; x += 40) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y <= h; y += 40) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    //3. Draw map raster (scaled by resolution-aware zoom)
    let res_w = resolution === '1440p' ? 2560 : resolution === '720p' ? 1280 : 1920
    let map_w = w*(360*Math.pow(2, zoom))/res_w
    let map_h = map_w/2
    let map_x = (w - map_w)/2
    let map_y = (h - map_h)/2

    if (props.renderedCanvas) {
      try {
        ctx.drawImage(props.renderedCanvas, map_x, map_y, map_w, map_h)
      } catch {
        //Fallback if canvas draw fails
      }
    } else {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.15)'
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)'
      ctx.lineWidth = 1.5
      ctx.fillRect(map_x, map_y, map_w, map_h)
      ctx.strokeRect(map_x, map_y, map_w, map_h)
    }

    //4. Draw 16:9 frame outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.lineWidth = 1
    ctx.strokeRect(1, 1, w - 2, h - 2)

    //5. Bottom-Centred Timeline Bar Mockup (matching actual export position)
    let tb_w = Math.min(360, w - 40)
    let tb_h = 24
    let tb_x = (w - tb_w)/2
    let tb_y = h - 30
    ctx.fillStyle = 'rgba(11, 15, 25, 0.95)'
    ctx.fillRect(tb_x, tb_y, tb_w, tb_h)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.strokeRect(tb_x, tb_y, tb_w, tb_h)

    //Date badge in center
    let date_str = UfDate.formatYear(props.timelineYear || start_year)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.fillRect(tb_x + (tb_w - 70)/2, tb_y + 3, 70, 10)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 7px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(date_str, tb_x + tb_w/2, tb_y + 11)
    ctx.textAlign = 'left'

    //Scrubber track & red progress line
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.fillRect(tb_x + 6, tb_y + 17, tb_w - 12, 2)
    ctx.fillStyle = '#EF4444'
    ctx.fillRect(tb_x + 6, tb_y + 17, (tb_w - 12)*0.45, 2)

    //6. Colourbar Overlay Mockup (positioned according to legend_position)
    let is_center_pos = legend_position === 'bottom-center' || legend_position === 'top-center'
    let cb_w = is_center_pos ? tb_w : 130
    let cb_h = 46
    let cb_x = 8
    let cb_y = 8
    if (legend_position === 'bottom-center') {
      cb_x = (w - cb_w)/2
      cb_y = tb_y - cb_h - 4
    } else if (legend_position === 'bottom-left') {
      cb_x = 8
      cb_y = tb_y - cb_h - 4
    } else if (legend_position === 'bottom-right') {
      cb_x = w - cb_w - 8
      cb_y = tb_y - cb_h - 4
    } else if (legend_position === 'top-center') {
      cb_x = (w - cb_w)/2
      cb_y = 8
    } else if (legend_position === 'top-right') {
      cb_x = w - cb_w - 8
      cb_y = 8
    } else {
      // 'top-left'
      cb_x = 8
      cb_y = 8
    }

    ctx.fillStyle = 'rgba(11, 15, 25, 0.92)'
    ctx.fillRect(cb_x, cb_y, cb_w, cb_h)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.strokeRect(cb_x, cb_y, cb_w, cb_h)

    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 8px Inter, sans-serif'
    let title_str = (props.legendTitle || 'Indicator Value')
    if (title_str.length > 22)
      title_str = title_str.slice(0, 20) + '...'
    ctx.fillText(title_str, cb_x + 6, cb_y + 12)

    //Gradient bar
    let grad = ctx.createLinearGradient(cb_x + 6, 0, cb_x + cb_w - 12, 0)
    grad.addColorStop(0, '#313695')
    grad.addColorStop(0.5, '#ffffbf')
    grad.addColorStop(1, '#a50026')
    ctx.fillStyle = grad
    ctx.fillRect(cb_x + 6, cb_y + 17, cb_w - 12, 7)

    ctx.fillStyle = '#94A3B8'
    ctx.font = '7px monospace'
    ctx.fillText(props.minVal !== undefined ? String(Math.round(props.minVal)) : '0', cb_x + 6, cb_y + 36)
    ctx.textAlign = 'right'
    ctx.fillText(props.maxVal !== undefined ? String(Math.round(props.maxVal)) : '100', cb_x + cb_w - 6, cb_y + 36)
    ctx.textAlign = 'left'
  }, [
    legend_position,
    props.colorPalette,
    props.legendSubtitle,
    props.legendTitle,
    props.maxVal,
    props.minVal,
    props.renderedCanvas,
    props.timelineYear,
    projection,
    resolution,
    start_year,
    zoom,
  ])

  select_all_cycling_layers = useCallback(() => {
    set_selected_cycling_layers(all_cohort_keys)
  }, [all_cohort_keys])

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

  toggle_folder_cohorts = useCallback((arg0_folder: IndicatorFolderItem) => {
    let folder = arg0_folder
    let folder_cohort_keys = folder.cohorts.map((arg0_c) => arg0_c.key)
    set_selected_cycling_layers((arg0_prev) => {
      let all_selected = folder_cohort_keys.every((arg0_k) => arg0_prev.includes(arg0_k))
      if (all_selected) {
        return arg0_prev.filter((arg0_k) => !folder_cohort_keys.includes(arg0_k))
      }
      let next = new Set(arg0_prev)
      for (let i = 0; i < folder_cohort_keys.length; i++) {
        next.add(folder_cohort_keys[i])
      }
      return Array.from(next)
    })
  }, [])

  toggle_expanded_folder = useCallback((arg0_id: string) => {
    let id = arg0_id
    set_expanded_folders((arg0_prev) => ({
      ...arg0_prev,
      [id]: !arg0_prev[id],
    }))
  }, [])

  handle_start_export = useCallback(async () => {
    let clean_filename = export_filename.replace(/\.(mp4|webm)$/i, '') + '.mp4'

    let chosen_layers: string[] = []
    if (export_mode === 'cycling') {
      chosen_layers = selected_cycling_layers.length > 0 ? selected_cycling_layers : (active_layer_id ? [active_layer_id] : Object.keys(available_layers).slice(0, 1))
    } else {
      chosen_layers = [selected_stationary_layer || active_layer_id || Object.keys(available_layers)[0] || 'GDP_nominal_pc']
    }

    let w = 1920
    let h = 1080
    if (resolution === '1440p') {
      w = 2560
      h = 1440
    } else if (resolution === '720p') {
      w = 1280
      h = 720
    }

    if (props.onStartTimelapseExport) {
      on_close()
      await props.onStartTimelapseExport({
        concurrency,
        endYear: end_year,
        filename: clean_filename,
        fps,
        height: h,
        keyframesOnly: keyframes_only,
        legendPosition: legend_position,
        mode: export_mode,
        projection,
        selectedLayers: chosen_layers,
        startYear: start_year,
        timestepStep: timestep_step,
        width: w,
        zoom,
      })
    }
  }, [
    active_layer_id,
    available_layers,
    concurrency,
    end_year,
    export_filename,
    export_mode,
    fps,
    keyframes_only,
    legend_position,
    on_close,
    projection,
    props,
    resolution,
    selected_cycling_layers,
    selected_stationary_layer,
    start_year,
    timestep_step,
    zoom,
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
                  Active Indicators & Cohorts to Cycle ({selected_cycling_layers.length} cohorts selected)
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

              <div className="space-y-1 max-h-56 overflow-y-auto pr-1 border border-border/50 bg-background/50 p-1.5">
                {indicator_folders.map((arg0_folder) => {
                  let f_keys = arg0_folder.cohorts.map((arg0_c) => arg0_c.key)
                  let selected_count = f_keys.filter((arg0_k) => selected_cycling_layers.includes(arg0_k)).length
                  let is_all_selected = selected_count === f_keys.length && f_keys.length > 0
                  let is_some_selected = selected_count > 0 && selected_count < f_keys.length
                  let is_expanded = Boolean(expanded_folders[arg0_folder.id])

                  if (!arg0_folder.isFolder) {
                    let is_checked = selected_cycling_layers.includes(arg0_folder.cohorts[0]?.key || arg0_folder.id)
                    return (
                      <div
                        key={arg0_folder.id}
                        onClick={() => toggle_cycling_layer(arg0_folder.cohorts[0]?.key || arg0_folder.id)}
                        className={`px-2 py-1 flex items-center justify-between border text-[11px] cursor-pointer transition-colors ${
                          is_checked
                            ? 'bg-primary/20 border-primary text-foreground font-medium'
                            : 'bg-card border-border/60 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Icon name="analytics" className="text-xs text-muted-foreground shrink-0" />
                          <span className="truncate">{arg0_folder.name}</span>
                        </div>
                        {is_checked && <Icon name="check" className="text-xs text-primary shrink-0" />}
                      </div>
                    )
                  }

                  return (
                    <div key={arg0_folder.id} className="border border-border/70 bg-card/60 overflow-hidden">
                      <div
                        className={`px-2 py-1 flex items-center justify-between transition-colors ${
                          is_all_selected ? 'bg-primary/15' : is_some_selected ? 'bg-primary/5' : 'bg-muted/30'
                        }`}
                      >
                        <div
                          onClick={() => toggle_folder_cohorts(arg0_folder)}
                          className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer select-none"
                        >
                          <button
                            type="button"
                            className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 text-[10px] ${
                              is_all_selected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : is_some_selected
                                ? 'border-primary bg-primary/40 text-primary-foreground'
                                : 'border-muted-foreground/60 bg-background'
                            }`}
                          >
                            {is_all_selected && <Icon name="check" className="text-[10px]" />}
                            {is_some_selected && <span className="w-1.5 h-1.5 bg-primary" />}
                          </button>
                          <Icon name={is_expanded ? 'folder_open' : 'folder'} className="text-primary text-xs shrink-0" />
                          <span className="text-xs font-bold text-foreground truncate">{arg0_folder.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono ml-1">
                            ({selected_count}/{f_keys.length} cohorts)
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(arg0_e) => {
                            arg0_e.stopPropagation()
                            toggle_expanded_folder(arg0_folder.id)
                          }}
                          className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                        >
                          <Icon name={is_expanded ? 'expand_less' : 'expand_more'} className="text-xs" />
                        </button>
                      </div>

                      {is_expanded && (
                        <div className="p-1.5 bg-background/60 border-t border-border/40 grid grid-cols-2 gap-1 max-h-36 overflow-y-auto">
                          {arg0_folder.cohorts.map((arg0_cohort) => {
                            let is_cohort_checked = selected_cycling_layers.includes(arg0_cohort.key)
                            return (
                              <button
                                key={arg0_cohort.key}
                                type="button"
                                onClick={() => toggle_cycling_layer(arg0_cohort.key)}
                                className={`px-1.5 py-0.5 flex items-center justify-between border text-left text-[10px] cursor-pointer transition-colors ${
                                  is_cohort_checked
                                    ? 'bg-primary/20 border-primary text-foreground font-medium'
                                    : 'bg-card border-border/50 text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                <span className="truncate pr-1">{arg0_cohort.label}</span>
                                {is_cohort_checked && <Icon name="check" className="text-[10px] text-primary shrink-0" />}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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

          {/* Projection & Resolution Preset */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Map Projection</span>
              <select
                value={projection}
                onChange={(arg0_e) => {
                  let p = arg0_e.target.value
                  set_projection(p)
                  handle_zoom_change(get_default_zoom(p))
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
                  handle_zoom_change(get_default_zoom(projection, w, h))
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
                { id: 'top-left', label: 'Top Left' },
                { id: 'top-center', label: 'Top Centre' },
                { id: 'top-right', label: 'Top Right' },
                { id: 'bottom-left', label: 'Bottom Left' },
                { id: 'bottom-center', label: 'Bottom Centre' },
                { id: 'bottom-right', label: 'Bottom Right' },
              ].map((arg0_pos) => (
                <button
                  key={arg0_pos.id}
                  type="button"
                  onClick={() => set_legend_position(arg0_pos.id as any)}
                  className={`h-7 text-xs border cursor-pointer transition-colors ${
                    legend_position === arg0_pos.id
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
                  className={`h-7 text-xs border cursor-pointer transition-colors ${
                    concurrency === arg0_t.count
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
