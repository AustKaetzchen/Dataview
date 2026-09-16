import React from 'react'
import type { HistoricalBorderKeyframe } from '@/server/atlasBordersService'
import { Icon } from '@/components/ui/icon'
import { UfDate } from '@/lib/ufDate'

export interface HistoricalKeyframesTimelineProps {
  currentYear: number
  keyframes: HistoricalBorderKeyframe[]
  onJumpToYear?: (arg0_year: number) => void
}

/**
 * Historical keyframes timeline strip for inspecting and scrubbing country borders through history.
 *
 * @param {HistoricalKeyframesTimelineProps} arg0_props
 *
 * @returns {React.ReactElement | null}
 */
export const HistoricalKeyframesTimeline: React.FC<HistoricalKeyframesTimelineProps> = function (arg0_props) {
  //Convert from parameters
  let props = arg0_props
  let current_year = props.currentYear
  let keyframes = props.keyframes
  let on_jump = props.onJumpToYear

  //Declare local instance variables
  let keyframes_count: number

  //Guard clauses
  if (!keyframes || keyframes.length === 0)
    return null

  //Function body
  keyframes_count = keyframes.length

  //Return statement
  return (
    <div className="flex items-center gap-2 px-[var(--padding)] py-1 bg-card/90 border-b border-border text-xs shrink-0 select-none overflow-x-auto custom-scrollbar">
      <div className="flex items-center gap-1 text-[11px] font-semibold text-foreground shrink-0">
        <Icon name="history" className="text-white text-xs" />
        <span>Keyframes ({keyframes_count}):</span>
      </div>

      <div className="flex items-center gap-1 min-w-0">
        {keyframes.map((arg0_kf: HistoricalBorderKeyframe, arg1_idx: number) => {
          let kf = arg0_kf
          let is_active = Math.abs(kf.year - current_year) <= 1
          let label = kf.label || UfDate.formatYear(kf.year)

          return (
            <button
              key={`${kf.year}-${arg1_idx}`}
              type="button"
              onClick={() => {
                if (on_jump)
                  on_jump(kf.year)
              }}
              className={`px-1.5 py-0.5 rounded-none text-[10px] font-mono transition-colors cursor-pointer shrink-0 border ${
                is_active
                  ? 'bg-red-600 text-white font-bold border-red-500 shadow-sm'
                  : 'bg-card/70 hover:bg-card text-muted-foreground hover:text-foreground border-border/50 hover:border-red-500/40'
              }`}
              title={kf.date || `Jump to ${label}`}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
