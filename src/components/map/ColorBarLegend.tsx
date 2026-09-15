import React, { useMemo, useState } from 'react'
import { ColorPalette, ScaleType } from '@/lib/geopng/types'
import { getPaletteCssGradient } from '@/lib/geopng/palettes'
import { transformValue } from '@/lib/geopng/scales'

export interface ColorBarLegendProps {
  palette: ColorPalette
  invertPalette?: boolean
  minVal: number
  maxVal: number
  legendTitle: string
  legendSubtitle?: string
  scaleType: string
  logSigma: number
  currentVal?: number | null
  breaks?: number[]
  countryName?: string | null
  onUpdateBreaks?: (breaks: number[]) => void
  width?: number | string
  onResizeWidth?: (width: number) => void
}

/**
 * Inverse transform for pseudo-log: y = asinh(x / (2 * sigma)) / ln(10)
 *
 * @param {number} arg0_y
 * @param {number} arg1_sigma
 * @returns {number}
 */
const inversePseudoLog = function (arg0_y: number, arg1_sigma: number): number {
  //Convert from parameters
  let y = arg0_y
  let sigma = arg1_sigma

  //Return statement
  return 2*sigma*Math.sinh(y*Math.LN10)
}

/**
 * Performs inverse transformation back to real scalar value based on scale type.
 *
 * @param {number} arg0_val
 * @param {ScaleType} arg1_scale_type
 * @param {number} arg2_log_sigma
 * @returns {number}
 */
const inverseTransform = function (arg0_val: number, arg1_scale_type: ScaleType, arg2_log_sigma: number): number {
  //Convert from parameters
  let val = arg0_val
  let scale_type = arg1_scale_type
  let log_sigma = arg2_log_sigma

  //Guard clauses
  if (scale_type === 'pseudo-log')
    return inversePseudoLog(val, log_sigma)

  //Return statement
  return val
}

/**
 * Cleanly formats numbers using abbreviated semantic notation (k, M, B, T).
 *
 * @param {number} arg0_val
 * @returns {string}
 */
export const formatLegendValue = function (arg0_val: number): string {
  //Convert from parameters
  let val = arg0_val

  //Declare local instance variables
  let abs_val: number
  let units_array = [
    { suffix: 'T', factor: 1e12 },
    { suffix: 'B', factor: 1e9 },
    { suffix: 'M', factor: 1e6 },
    { suffix: 'k', factor: 1e3 },
  ]

  //Guard clauses
  if (val === null || val === undefined || !Number.isFinite(val))
    return ''

  //Function body
  abs_val = Math.abs(val)
  if (abs_val === 0)
    return '0'

  for (let i = 0; i < units_array.length; i++) {
    let local_factor = units_array[i].factor
    let local_suffix = units_array[i].suffix

    if (abs_val >= local_factor) {
      let local_abs_scaled: number
      let local_formatted: string
      let local_max_decimals: number
      let local_scaled = val/local_factor
      local_abs_scaled = Math.abs(local_scaled)
      local_max_decimals = (local_abs_scaled >= 100) ? 1 : 2
      local_formatted = Number(local_scaled.toFixed(local_max_decimals)).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: local_max_decimals,
      })
      return `${local_formatted}${local_suffix}`
    }
  }

  if (abs_val >= 100) {
    return Number(val.toFixed(1)).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })
  } else if (abs_val >= 1) {
    return Number(val.toFixed(2)).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  } else if (abs_val >= 0.01) {
    return Number(val.toFixed(3)).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    })
  } else {
    return parseFloat(val.toFixed(5)).toString()
  }
}

/**
 * Value colourbar legend component with interactive tick breaks and needle indicator.
 *
 * @param {ColorBarLegendProps} arg0_props
 * @returns {React.ReactElement}
 */
export const ColorBarLegend: React.FC<ColorBarLegendProps> = React.memo(function (arg0_props: ColorBarLegendProps) {
  //Convert from parameters
  let props = (arg0_props) ? arg0_props : ({} as ColorBarLegendProps)

  //Declare local instance variables
  let break_points: any[]
  let breaks = props.breaks
  let country_name = props.countryName
  let current_val = props.currentVal
  let current_width = props.width ?? 336
  let editing_index: number | null
  let editing_value: string
  let gradient: string
  let handle_resize_mouse_down: (e: React.MouseEvent) => void
  let indicator_pct: number | null
  let invert_palette = props.invertPalette ?? false
  let legend_subtitle = props.legendSubtitle
  let legend_title = props.legendTitle
  let log_sigma = props.logSigma
  let max_val = props.maxVal
  let min_val = props.minVal
  let on_resize_width = props.onResizeWidth
  let on_update_breaks = props.onUpdateBreaks
  let palette = props.palette
  let range: number
  let safe_max: number
  let safe_min: number
  let scale_type = props.scaleType
  let set_editing_index: React.Dispatch<React.SetStateAction<number | null>>
  let set_editing_value: React.Dispatch<React.SetStateAction<string>>
  let t_max: number
  let t_min: number

  //Function body
  let [edit_idx, set_edit_idx] = useState<number | null>(null)
  editing_index = edit_idx
  set_editing_index = set_edit_idx

  let [edit_val, set_edit_val] = useState<string>('')
  editing_value = edit_val
  set_editing_value = set_edit_val

  handle_resize_mouse_down = function (e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    let start_w = (typeof current_width === 'number') ? current_width : 336
    let start_x = e.clientX

    let on_mouse_move = function (move_event: MouseEvent) {
      let delta = move_event.clientX - start_x
      let next_w = Math.max(260, Math.min(650, start_w + delta))
      on_resize_width?.(next_w)
    }

    let on_mouse_up = function () {
      window.removeEventListener('mousemove', on_mouse_move)
      window.removeEventListener('mouseup', on_mouse_up)
    }

    window.addEventListener('mousemove', on_mouse_move)
    window.addEventListener('mouseup', on_mouse_up)
  }

  gradient = getPaletteCssGradient(palette, invert_palette)

  safe_min = Number.isFinite(min_val) ? min_val : 0
  safe_max = Number.isFinite(max_val) ? max_val : 1
  if (safe_max <= safe_min)
    safe_max = safe_min + 1

  t_min = useMemo(() => {
    let t = transformValue(safe_min, scale_type as ScaleType, log_sigma)
    return Number.isFinite(t) ? t : 0
  }, [safe_min, scale_type, log_sigma])

  t_max = useMemo(() => {
    let t = transformValue(safe_max, scale_type as ScaleType, log_sigma)
    return Number.isFinite(t) ? t : 1
  }, [safe_max, scale_type, log_sigma])

  range = Math.max(0.000001, t_max - t_min)

  indicator_pct = useMemo(() => {
    if (current_val === null || current_val === undefined || !Number.isFinite(current_val))
      return null

    if (breaks && breaks.length >= 2 && breaks.every((arg0_b) => Number.isFinite(arg0_b))) {
      let n: number
      let seg = 0
      let seg_range: number
      let seg_t: number
      let sorted = [...breaks].sort((a, b) => a - b)
      n = sorted.length - 1

      if (current_val <= sorted[0]) return 0
      if (current_val >= sorted[n]) return 100

      for (let i = 0; i < n - 1; i++) {
        if (current_val >= sorted[i + 1]) {
          seg = i + 1
        } else {
          break
        }
      }

      seg_range = sorted[seg + 1] - sorted[seg]
      seg_t = (seg_range > 0) ? (current_val - sorted[seg])/seg_range : 0
      return Math.max(0, Math.min(100, ((seg + seg_t)/n)*100))
    }

    let t_val = transformValue(current_val, scale_type as ScaleType, log_sigma)
    if (range <= 0 || !Number.isFinite(range)) return 50
    let normalised = (t_val - t_min)/range
    return Math.max(0, Math.min(100, normalised*100))
  }, [current_val, breaks, t_min, range, scale_type, log_sigma])

  break_points = useMemo(() => {
    if (breaks && breaks.length >= 2 && breaks.every((arg0_b) => Number.isFinite(arg0_b))) {
      let sorted = [...breaks].sort((a, b) => a - b)
      return sorted.map((b, idx) => {
        let pct = (idx/(sorted.length - 1))*100
        return {
          val: b,
          pct,
          label: formatLegendValue(b),
        }
      })
    }

    let steps_array = [0, 0.25, 0.5, 0.75, 1]
    return steps_array.map((s) => {
      let real_val: number
      let t_val = t_min + s*range
      real_val = inverseTransform(t_val, scale_type as ScaleType, log_sigma)
      if (!Number.isFinite(real_val))
        real_val = safe_min + s*(safe_max - safe_min)
      return {
        val: real_val,
        pct: s*100,
        label: formatLegendValue(real_val),
      }
    })
  }, [breaks, safe_min, safe_max, t_min, range, scale_type, log_sigma])

  //Return statement
  return (
    <div
      style={{ width: (typeof current_width === 'number') ? `${current_width}px` : current_width }}
      className="relative rounded-none border border-border bg-card/95 backdrop-blur-md p-[var(--padding)] pb-3 shadow-lg text-[var(--body-font-size)] text-card-foreground select-none font-sans"
    >
      {/* Draggable Right Border Resize Handle */}
      {(on_resize_width && typeof current_width === 'number') && (
        <div
          onMouseDown={handle_resize_mouse_down}
          className="absolute top-0 right-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors z-30 group"
          title="Drag right border to resize Value colourbar"
        >
          <div className="w-[2px] h-6 bg-border group-hover:bg-primary absolute top-1/2 -translate-y-1/2 right-0.5" />
        </div>
      )}

      {/* Legend Title, Subtitle & Hover Value Readout */}
      <div className="flex items-start justify-between mb-2 gap-[var(--padding)]">
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-foreground text-[var(--header-font-size)] whitespace-pre-line leading-tight">
              {legend_title}
            </span>
            <span className="text-[var(--body-font-size)] text-muted-foreground capitalize bg-muted px-2 py-0.5 rounded-none shrink-0">
              {scale_type}
            </span>
            {country_name && (
              <span className="text-[var(--body-font-size)] font-bold text-white bg-primary/20 border border-primary/40 px-2 py-0.5 rounded-none flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-none bg-primary animate-pulse" />
                {country_name}
              </span>
            )}
          </div>
          {legend_subtitle && legend_subtitle.trim().length > 0 && (
            <p className="text-[11px] text-muted-foreground font-light whitespace-pre-line leading-tight mt-0.5">
              {legend_subtitle}
            </p>
          )}
        </div>

        <div className="shrink-0 pt-0.5">
          {current_val !== null && current_val !== undefined && Number.isFinite(current_val) ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-none bg-primary text-primary-foreground font-bold text-[var(--body-font-size)] shadow-sm animate-in fade-in-0 duration-100">
              <span>{formatLegendValue(current_val)}</span>
            </div>
          ) : (
            <span className="text-[var(--body-font-size)] text-muted-foreground font-light">
              {formatLegendValue(min_val)} → {formatLegendValue(max_val)}
            </span>
          )}
        </div>
      </div>

      {/* Gradient Bar with Breaks & Active Value Needle */}
      <div className="relative w-full my-1.5">
        <div
          className="relative h-4.5 w-full rounded-none border border-border/80 shadow-inner overflow-hidden"
          style={{ background: gradient }}
        >
          {break_points.map((bp, i) => {
            if (bp.pct <= 1 || bp.pct >= 99) return null
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-[1.5px] bg-black/60 shadow-[0_0_1px_rgba(255,255,255,0.7)] pointer-events-none z-10"
                style={{ left: `${bp.pct}%` }}
                title={`Break: ${bp.label}`}
              />
            )
          })}
        </div>

        {indicator_pct !== null && (
          <div
            className="absolute top-[-4px] bottom-[-4px] pointer-events-none transition-all duration-75 ease-out z-20 flex flex-col items-center justify-between"
            style={{ left: `${indicator_pct}%` }}
          >
            <div className="w-0 h-0 border-l-[4.5px] border-l-transparent border-r-[4.5px] border-r-transparent border-t-[6px] border-t-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
            <div className="w-[2.5px] flex-1 bg-white rounded-none shadow-[0_0_6px_rgba(0,0,0,0.9)] border border-black/30" />
            <div className="w-0 h-0 border-l-[4.5px] border-l-transparent border-r-[4.5px] border-r-transparent border-b-[6px] border-b-white drop-shadow-[0_-1px_2px_rgba(0,0,0,0.9)]" />
          </div>
        )}
      </div>

      {/* Ticks and aligned break values with click-to-edit */}
      <div className="relative w-full h-7 mt-1">
        {break_points.map((bp, i) => {
          let is_editing = (editing_index === i)
          let is_first = (i === 0)
          let is_last = (i === break_points.length - 1)
          let alignment = (is_first)
            ? 'items-start -translate-x-0'
            : (is_last)
              ? 'items-end -translate-x-full'
              : 'items-center -translate-x-1/2'

          return (
            <div
              key={i}
              className={`absolute top-0 flex flex-col text-[var(--body-font-size)] text-muted-foreground font-light ${alignment}`}
              style={{ left: `${bp.pct}%` }}
            >
              <div className="w-[1px] h-1 bg-border/80 mb-0.5" />
              {is_editing ? (
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={editing_value}
                  onChange={(e) => set_editing_value(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      let parsed = parseFloat(editing_value)
                      if (Number.isFinite(parsed) && on_update_breaks) {
                        let current_breaks = break_points.map((b) => b.val)
                        let new_breaks = current_breaks.map((b, idx) => ((idx === i) ? parsed : b))
                        new_breaks.sort((a, b) => a - b)
                        on_update_breaks(new_breaks)
                      }
                      set_editing_index(null)
                    } else if (e.key === 'Escape') {
                      set_editing_index(null)
                    }
                  }}
                  onBlur={() => {
                    let parsed = parseFloat(editing_value)
                    if (Number.isFinite(parsed) && on_update_breaks) {
                      let current_breaks = break_points.map((b) => b.val)
                      let new_breaks = current_breaks.map((b, idx) => ((idx === i) ? parsed : b))
                      new_breaks.sort((a, b) => a - b)
                      on_update_breaks(new_breaks)
                    }
                    set_editing_index(null)
                  }}
                  className="w-16 h-6 px-1 text-[var(--body-font-size)] font-bold bg-background border border-primary text-foreground text-center rounded-none z-30 shadow-lg focus:outline-none"
                  title="Enter absolute break number"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    set_editing_index(i)
                    set_editing_value(bp.val.toString())
                  }}
                  className="whitespace-nowrap px-1 py-0.2 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted rounded-none transition-colors underline decoration-dotted decoration-muted-foreground/60 underline-offset-2"
                  title="Click to set break value by typing number"
                >
                  {bp.label}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
})

export default ColorBarLegend
