import React, { useState, useEffect, useRef, useMemo } from 'react'
import { UfDate, type UfDateObject } from '@framework/utils/uf_date.ts'
import { Icon } from '@ui/components/icon'

export interface HistoricalDatePickerProps {
  currentYear: number
  isOpen: boolean
  maxYear?: number
  minYear?: number
  onClose: () => void
  onSelectDate: (arg0_date: UfDateObject) => void
}

interface HistoricalPreset {
  date: UfDateObject
  label: string
}

let HISTORICAL_PRESETS: HistoricalPreset[] = [
  { date: { day: 1, month: 1, year: 2025 }, label: '2025AD Modern' },
  { date: { day: 26, month: 5, year: 1945 }, label: '26 May 1945AD WWII End' },
  { date: { day: 28, month: 6, year: 1914 }, label: '28 Jun 1914AD WWI Start' },
  { date: { day: 14, month: 7, year: 1789 }, label: '14 Jul 1789AD Bastille' },
  { date: { day: 24, month: 10, year: 1648 }, label: '24 Oct 1648AD Westphalia' },
  { date: { day: 15, month: 3, year: -44 }, label: '15 Mar 44BC Caesar' },
]

/**
 * Historical date picker popover anchored above the TimelineBar date badge.
 * Provides interactive date selection down to the day across AD and BC.
 *
 * @param {HistoricalDatePickerProps} arg0_props
 *
 * @returns {React.ReactElement | null}
 */
export let HistoricalDatePicker: React.FC<HistoricalDatePickerProps> = function (arg0_props) {
  //Convert from parameters
  let props = arg0_props
  let current_year = props.currentYear
  let is_open = props.isOpen
  let max_year = props.maxYear !== undefined ? props.maxYear : 2026
  let min_year = props.minYear !== undefined ? props.minYear : -10000
  let on_close = props.onClose
  let on_select_date = props.onSelectDate

  //Declare local instance variables
  let days_array: number[]
  let days_in_current_month: number
  let effective_year: number
  let handle_apply: () => void
  let handle_day_select: (arg0_d: number) => void
  let handle_era_toggle: (arg0_era: 'AD' | 'BC') => void
  let handle_month_select: (arg0_m: number) => void
  let handle_preset_select: (arg0_preset: HistoricalPreset) => void
  let handle_year_change: (arg0_val: string) => void
  let handle_year_step: (arg0_delta: number) => void
  let month_short_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  let parsed_date: UfDateObject
  let popover_ref = useRef<HTMLDivElement | null>(null)
  let preview_date_str: string
  let selected_day: number
  let selected_era: 'AD' | 'BC'
  let selected_month: number
  let set_selected_day: React.Dispatch<React.SetStateAction<number>>
  let set_selected_era: React.Dispatch<React.SetStateAction<'AD' | 'BC'>>
  let set_selected_month: React.Dispatch<React.SetStateAction<number>>
  let set_year_text: React.Dispatch<React.SetStateAction<string>>
  let year_num: number
  let year_text: string

  //Function body
  parsed_date = useMemo(() => {
    return UfDate.fromFractionalYear(current_year)
  }, [current_year])

  ;[selected_day, set_selected_day] = useState<number>(parsed_date.day)
  ;[selected_month, set_selected_month] = useState<number>(parsed_date.month)
  ;[selected_era, set_selected_era] = useState<'AD' | 'BC'>(parsed_date.year < 0 ? 'BC' : 'AD')
  ;[year_text, set_year_text] = useState<string>(String(Math.abs(parsed_date.year || 1)))

  //Synchronise local state when popover opens or current_year changes externally
  useEffect(() => {
    if (!is_open)
      return

    let d = UfDate.fromFractionalYear(current_year)
    set_selected_day(d.day)
    set_selected_month(d.month)
    set_selected_era(d.year < 0 ? 'BC' : 'AD')
    set_year_text(String(Math.abs(d.year || 1)))
  }, [is_open, current_year])

  //Dismiss on click outside
  useEffect(() => {
    if (!is_open)
      return

    let handle_click_outside = function (arg0_e: MouseEvent) {
      if (popover_ref.current && !popover_ref.current.contains(arg0_e.target as Node)) {
        on_close()
      }
    }

    let handle_key_down = function (arg0_e: KeyboardEvent) {
      if (arg0_e.key === 'Escape')
        on_close()
    }

    document.addEventListener('mousedown', handle_click_outside)
    document.addEventListener('keydown', handle_key_down)

    return () => {
      document.removeEventListener('mousedown', handle_click_outside)
      document.removeEventListener('keydown', handle_key_down)
    }
  }, [is_open, on_close])

  year_num = parseInt(year_text, 10)
  if (Number.isNaN(year_num))
    year_num = 1
  effective_year = selected_era === 'BC' ? -Math.abs(year_num) : Math.abs(year_num)

  days_in_current_month = useMemo(() => {
    return UfDate.getDaysInMonth(effective_year, selected_month)
  }, [effective_year, selected_month])

  //Ensure selected day does not exceed maximum days in month
  useEffect(() => {
    if (selected_day > days_in_current_month)
      set_selected_day(days_in_current_month)
  }, [days_in_current_month, selected_day])

  days_array = useMemo(() => {
    let arr: number[] = []
    for (let i = 1; i <= days_in_current_month; i++)
      arr.push(i)
    return arr
  }, [days_in_current_month])

  preview_date_str = useMemo(() => {
    return UfDate.formatDate({
      day: Math.min(selected_day, days_in_current_month),
      month: selected_month,
      year: effective_year,
    })
  }, [selected_day, selected_month, effective_year, days_in_current_month])

  handle_year_change = function (arg0_val: string) {
    let cleaned = arg0_val.replace(/[^0-9]/g, '')
    set_year_text(cleaned)
  }

  handle_year_step = function (arg0_delta: number) {
    let curr = parseInt(year_text, 10)
    if (Number.isNaN(curr))
      curr = 1

    let next_effective = (selected_era === 'BC' ? -curr : curr) + arg0_delta
    next_effective = Math.max(min_year, Math.min(max_year, next_effective))

    if (next_effective < 0) {
      set_selected_era('BC')
      set_year_text(String(Math.abs(next_effective)))
    } else if (next_effective === 0) {
      set_selected_era('AD')
      set_year_text('1')
    } else {
      set_selected_era('AD')
      set_year_text(String(next_effective))
    }
  }

  handle_era_toggle = function (arg0_era: 'AD' | 'BC') {
    set_selected_era(arg0_era)
  }

  handle_month_select = function (arg0_m: number) {
    set_selected_month(arg0_m)
  }

  handle_day_select = function (arg0_d: number) {
    set_selected_day(arg0_d)
  }

  handle_preset_select = function (arg0_preset: HistoricalPreset) {
    let p = arg0_preset.date
    set_selected_day(p.day)
    set_selected_month(p.month)
    set_selected_era(p.year < 0 ? 'BC' : 'AD')
    set_year_text(String(Math.abs(p.year)))

    on_select_date({
      day: p.day,
      month: p.month,
      year: p.year,
    })
    on_close()
  }

  handle_apply = function () {
    let d: UfDateObject = {
      day: Math.min(selected_day, days_in_current_month),
      month: selected_month,
      year: effective_year,
    }
    on_select_date(d)
    on_close()
  }

  //Guard clauses
  if (!is_open)
    return null

  //Return statement
  return (
    <div
      ref={popover_ref}
      id="dataview-historical-date-picker"
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-[360px] bg-card/95 backdrop-blur-md border border-border shadow-2xl p-3.5 select-none font-sans z-50 text-foreground animate-in fade-in-0 zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <Icon name="event" className="text-primary text-sm" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
            Historical Date Picker
          </span>
        </div>
        <button
          type="button"
          onClick={on_close}
          className="text-muted-foreground hover:text-foreground p-0.5 cursor-pointer transition-colors"
          title="Close date picker"
        >
          <Icon name="close" className="text-sm" />
        </button>
      </div>

      {/* Year & Era Input Section */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Year & Era</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handle_era_toggle('BC')}
              className={`px-2 py-0.5 text-xs font-mono font-bold cursor-pointer transition-colors border ${
                selected_era === 'BC'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground border-border/60'
              }`}
            >
              BC
            </button>
            <button
              type="button"
              onClick={() => handle_era_toggle('AD')}
              className={`px-2 py-0.5 text-xs font-mono font-bold cursor-pointer transition-colors border ${
                selected_era === 'AD'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground border-border/60'
              }`}
            >
              AD
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handle_year_step(-100)}
            className="px-1.5 py-1 text-[10px] font-mono bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 cursor-pointer"
            title="Subtract 100 years"
          >
            -100
          </button>
          <button
            type="button"
            onClick={() => handle_year_step(-10)}
            className="px-1.5 py-1 text-[10px] font-mono bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 cursor-pointer"
            title="Subtract 10 years"
          >
            -10
          </button>

          <input
            type="text"
            value={year_text}
            onChange={(arg0_e) => handle_year_change(arg0_e.target.value)}
            onKeyDown={(arg0_e) => {
              if (arg0_e.key === 'Enter')
                handle_apply()
            }}
            className="flex-1 text-center font-mono font-bold text-sm bg-background border border-border px-2 py-1 text-foreground focus:outline-hidden focus:border-primary"
            placeholder="Year"
          />

          <button
            type="button"
            onClick={() => handle_year_step(10)}
            className="px-1.5 py-1 text-[10px] font-mono bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 cursor-pointer"
            title="Add 10 years"
          >
            +10
          </button>
          <button
            type="button"
            onClick={() => handle_year_step(100)}
            className="px-1.5 py-1 text-[10px] font-mono bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60 cursor-pointer"
            title="Add 100 years"
          >
            +100
          </button>
        </div>
      </div>

      {/* Month Selection Grid */}
      <div className="space-y-1 mb-3">
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Month</div>
        <div className="grid grid-cols-6 gap-1">
          {month_short_names.map((arg0_name, arg1_idx) => {
            let m_num = arg1_idx + 1
            let is_sel = selected_month === m_num
            return (
              <button
                key={arg0_name}
                type="button"
                onClick={() => handle_month_select(m_num)}
                className={`py-1 text-center font-mono text-[11px] cursor-pointer transition-colors border ${
                  is_sel
                    ? 'bg-primary text-primary-foreground border-primary font-bold'
                    : 'bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground border-border/40'
                }`}
              >
                {arg0_name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Day Selection Grid */}
      <div className="space-y-1 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Day</span>
          <span className="text-[10px] text-muted-foreground font-mono">{days_in_current_month} days in month</span>
        </div>
        <div className="grid grid-cols-7 gap-1 max-h-28 overflow-y-auto custom-scrollbar pr-0.5">
          {days_array.map((arg0_d) => {
            let is_sel = selected_day === arg0_d
            return (
              <button
                key={arg0_d}
                type="button"
                onClick={() => handle_day_select(arg0_d)}
                className={`py-1 text-center font-mono text-[11px] cursor-pointer transition-colors border ${
                  is_sel
                    ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                    : 'bg-muted/20 hover:bg-muted/50 text-muted-foreground hover:text-foreground border-border/40'
                }`}
              >
                {arg0_d}
              </button>
            )
          })}
        </div>
      </div>

      {/* Historical Presets */}
      <div className="space-y-1 mb-3">
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Landmarks</div>
        <div className="grid grid-cols-2 gap-1">
          {HISTORICAL_PRESETS.map((arg0_preset) => (
            <button
              key={arg0_preset.label}
              type="button"
              onClick={() => handle_preset_select(arg0_preset)}
              className="text-left px-2 py-1 text-[10px] font-mono bg-muted/20 hover:bg-primary/20 hover:border-primary/50 text-muted-foreground hover:text-foreground border border-border/40 truncate cursor-pointer transition-colors"
              title={`Jump to ${arg0_preset.label}`}
            >
              {arg0_preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Bar: Preview and Apply Action */}
      <div className="flex items-center justify-between pt-2 border-t border-border/70">
        <div className="flex items-center gap-1.5 min-w-0 pr-2">
          <Icon name="schedule" className="text-xs text-white shrink-0" />
          <span className="text-xs font-bold font-mono text-primary truncate" title={preview_date_str}>
            {preview_date_str}
          </span>
        </div>

        <button
          type="button"
          onClick={handle_apply}
          className="px-3 py-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-mono font-bold tracking-wider uppercase border border-primary shadow-xs cursor-pointer transition-colors shrink-0"
        >
          Jump →
        </button>
      </div>
    </div>
  )
}
