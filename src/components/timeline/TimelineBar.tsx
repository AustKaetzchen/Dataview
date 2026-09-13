import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { UfDate, TIMELINE_MILESTONES } from '@/lib/ufDate'
import { Icon } from '@/components/ui/icon'
import { Slider } from '@/components/ui/slider'

export interface TimelineBarProps {
  availableKeyframes?: number[]
  currentYear: number
  isLoading?: boolean
  isPlaying: boolean
  maxYear?: number
  minYear?: number
  onChangePlaybackSpeed?: (arg0_speed: number) => void
  onChangeYear: (arg0_year: number) => void
  onTogglePlay: () => void
  onToggleSnapToKeyframes?: (arg0_snap: boolean) => void
  playbackSpeed?: number
  snapToKeyframes?: boolean
  style?: React.CSSProperties
}

/**
 * TimelineBar component docked at the bottom of Dataview for scrubbing through historical rasters.
 *
 * @param {TimelineBarProps} arg0_props
 *
 * @returns {React.ReactElement}
 */
export const TimelineBar: React.FC<TimelineBarProps> = function (arg0_props) {
  //Convert from parameters
  let props = arg0_props
  let {
    availableKeyframes: available_keyframes = [],
    currentYear: current_year,
    isLoading: is_loading = false,
    isPlaying: is_playing,
    maxYear: max_year = 2025,
    minYear: min_year = -10000,
    onChangePlaybackSpeed: on_change_playback_speed,
    onChangeYear: on_change_year,
    onTogglePlay: on_toggle_play,
    onToggleSnapToKeyframes: on_toggle_snap_to_keyframes,
    playbackSpeed: playback_speed = 1,
    snapToKeyframes: snap_to_keyframes = false,
    style,
  } = props

  //Declare local instance variables
  let anim_frame_ref = useRef<number | null>(null)
  let current_year_ref = useRef<number>(current_year)
  let date_obj: { day: number; month: number; year: number }
  let formatted_date: string
  let handle_jump_year: (arg0_year: number) => void
  let handle_slider_change: (arg0_val: number[]) => void
  let handle_step_backward: () => void
  let handle_step_forward: () => void
  let is_collapsed: boolean
  let is_looping: boolean
  let is_looping_ref = useRef<boolean>(false)
  let is_settings_open: boolean
  let keyframe_positions: { left_pct: number; year: number }[]
  let keyframes_ref = useRef<number[]>(available_keyframes)
  let last_snap_time_ref = useRef<number>(0)
  let last_tick_ref = useRef<number>(performance.now())
  let on_change_year_ref = useRef(on_change_year)
  let on_toggle_play_ref = useRef(on_toggle_play)
  let set_is_collapsed: React.Dispatch<React.SetStateAction<boolean>>
  let set_is_looping: React.Dispatch<React.SetStateAction<boolean>>
  let set_is_settings_open: React.Dispatch<React.SetStateAction<boolean>>
  let settings_popover_ref = useRef<HTMLDivElement | null>(null)
  let slider_normalised_val: number
  let snap_ref = useRef<boolean>(snap_to_keyframes)
  let speed_options = [0.5, 1, 2, 5, 10]

  //Function body
  ;[is_collapsed, set_is_collapsed] = useState(false)
  ;[is_looping, set_is_looping] = useState(false)
  ;[is_settings_open, set_is_settings_open] = useState(false)

  current_year_ref.current = current_year
  is_looping_ref.current = is_looping
  keyframes_ref.current = available_keyframes
  on_change_year_ref.current = on_change_year
  on_toggle_play_ref.current = on_toggle_play
  snap_ref.current = snap_to_keyframes

  //Close settings pop-out on click outside
  useEffect(() => {
    if (!is_settings_open)
      return

    let handle_click_outside = function (arg0_e: MouseEvent) {
      if (
        settings_popover_ref.current &&
        !settings_popover_ref.current.contains(arg0_e.target as Node)
      ) {
        set_is_settings_open(false)
      }
    }

    document.addEventListener('mousedown', handle_click_outside)
    return () => {
      document.removeEventListener('mousedown', handle_click_outside)
    }
  }, [is_settings_open])

  date_obj = useMemo(() => {
    return UfDate.fromFractionalYear(current_year)
  }, [current_year])

  formatted_date = useMemo(() => {
    return UfDate.formatDate(date_obj)
  }, [date_obj])

  slider_normalised_val = useMemo(() => {
    return Math.round(UfDate.yearToTimelinePosition(current_year)*1000)
  }, [current_year])

  keyframe_positions = useMemo(() => {
    let list: { left_pct: number; year: number }[] = []
    for (let i = 0; i < available_keyframes.length; i++) {
      let yr = available_keyframes[i]
      if (yr >= min_year && yr <= max_year) {
        let pct = UfDate.yearToTimelinePosition(yr)*100
        list.push({ left_pct: pct, year: yr })
      }
    }
    return list
  }, [available_keyframes, min_year, max_year])

  handle_jump_year = useCallback(
    function (arg0_year: number) {
      let yr = Math.max(min_year, Math.min(max_year, arg0_year))
      on_change_year(yr)
    },
    [min_year, max_year, on_change_year]
  )

  handle_step_backward = useCallback(() => {
    if (available_keyframes.length > 0) {
      let prev_candidates = available_keyframes.filter((arg0_y) => arg0_y < current_year - 0.05)
      if (prev_candidates.length > 0) {
        let prev = prev_candidates[prev_candidates.length - 1]
        handle_jump_year(prev)
        return
      }
    }
    handle_jump_year(current_year - 1)
  }, [available_keyframes, current_year, handle_jump_year])

  handle_step_forward = useCallback(() => {
    if (available_keyframes.length > 0) {
      let next_candidates = available_keyframes.filter((arg0_y) => arg0_y > current_year + 0.05)
      if (next_candidates.length > 0) {
        let next = next_candidates[0]
        handle_jump_year(next)
        return
      }
    }
    handle_jump_year(current_year + 1)
  }, [available_keyframes, current_year, handle_jump_year])

  handle_slider_change = useCallback(
    function (arg0_val: number[]) {
      let norm_val = Math.max(0, Math.min(1000, arg0_val[0]))/1000
      let mapped_year = UfDate.timelinePositionToYear(norm_val)

      if (snap_to_keyframes && available_keyframes.length > 0) {
        let closest = available_keyframes[0]
        let min_dist = Math.abs(mapped_year - closest)
        for (let i = 1; i < available_keyframes.length; i++) {
          let dist = Math.abs(mapped_year - available_keyframes[i])
          if (dist < min_dist) {
            min_dist = dist
            closest = available_keyframes[i]
          }
        }
        on_change_year(closest)
      } else {
        on_change_year(mapped_year)
      }
    },
    [snap_to_keyframes, available_keyframes, on_change_year]
  )

  //Animation playback loop: decoupled from React state closure to eliminate race conditions
  useEffect(() => {
    if (!is_playing) {
      if (anim_frame_ref.current)
        cancelAnimationFrame(anim_frame_ref.current)
      return
    }

    last_tick_ref.current = performance.now()
    last_snap_time_ref.current = performance.now()

    let tick = function (arg0_now: number) {
      let delta_ms = arg0_now - last_tick_ref.current
      last_tick_ref.current = arg0_now

      if (snap_ref.current && keyframes_ref.current.length > 0) {
        let snap_interval = Math.max(100, 400/playback_speed)
        if (arg0_now - last_snap_time_ref.current >= snap_interval) {
          last_snap_time_ref.current = arg0_now
          let curr = current_year_ref.current
          let kfs = keyframes_ref.current
          let next_candidates = kfs.filter((arg0_y) => arg0_y > curr + 0.05)
          if (next_candidates.length > 0) {
            on_change_year_ref.current(next_candidates[0])
          } else if (is_looping_ref.current) {
            on_change_year_ref.current(kfs[0])
          } else {
            on_change_year_ref.current(kfs[kfs.length - 1])
            on_toggle_play_ref.current()
            return
          }
        }
      } else {
        let delta_pos = (delta_ms/1000)*(1/25)*playback_speed
        let curr_pos = UfDate.yearToTimelinePosition(current_year_ref.current)
        let next_pos = curr_pos + delta_pos
        if (next_pos >= 1) {
          if (is_looping_ref.current) {
            next_pos = 0
            let next_year = UfDate.timelinePositionToYear(next_pos)
            on_change_year_ref.current(next_year)
          } else {
            let end_year = UfDate.timelinePositionToYear(1)
            on_change_year_ref.current(end_year)
            on_toggle_play_ref.current()
            return
          }
        } else {
          let next_year = UfDate.timelinePositionToYear(next_pos)
          on_change_year_ref.current(next_year)
        }
      }

      anim_frame_ref.current = requestAnimationFrame(tick)
    }

    anim_frame_ref.current = requestAnimationFrame(tick)

    return () => {
      if (anim_frame_ref.current)
        cancelAnimationFrame(anim_frame_ref.current)
    }
  }, [is_playing, playback_speed])

  //Return statement
  return (
    <div
      style={style}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-5xl pointer-events-auto select-none font-sans"
    >
      <div className="bg-card/95 backdrop-blur-md border border-border shadow-2xl p-2.5 transition-all">
        {/* Top Header Row: Date Badge, Controls, & Settings */}
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={on_toggle_play}
              className="h-7 w-7 flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
              title={is_playing ? 'Pause timeline playback' : 'Start timeline animation'}
            >
              <Icon name={is_playing ? 'pause' : 'play_arrow'} />
            </button>

            {/* Step Backward */}
            <button
              type="button"
              onClick={handle_step_backward}
              className="h-7 w-7 flex items-center justify-center bg-muted/60 hover:bg-muted text-foreground border border-border transition-colors cursor-pointer"
              title="Step to previous keyframe"
            >
              <Icon name="skip_previous" />
            </button>

            {/* Step Forward */}
            <button
              type="button"
              onClick={handle_step_forward}
              className="h-7 w-7 flex items-center justify-center bg-muted/60 hover:bg-muted text-foreground border border-border transition-colors cursor-pointer"
              title="Step to next keyframe"
            >
              <Icon name="skip_next" />
            </button>

            {/* Settings Pop-out Toggle */}
            <div className="relative" ref={settings_popover_ref}>
              <button
                type="button"
                onClick={() => set_is_settings_open((arg0_prev) => !arg0_prev)}
                className={`h-7 w-7 flex items-center justify-center border transition-colors cursor-pointer ${
                  is_settings_open
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/60 hover:bg-muted text-foreground border border-border'
                }`}
                title="Playback & Timeline Settings"
              >
                <Icon name="settings" className="text-sm" />
              </button>

              {/* Settings Pop-out Dialog */}
              {is_settings_open && (
                <div className="absolute bottom-9 left-0 z-50 w-72 bg-card/95 backdrop-blur-md border border-border p-3 shadow-2xl space-y-3">
                  <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Icon name="settings" className="text-sm text-primary" />
                      Timeline Settings
                    </span>
                    <button
                      type="button"
                      onClick={() => set_is_settings_open(false)}
                      className="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                    >
                      <Icon name="close" className="text-xs" />
                    </button>
                  </div>

                  {/* Playback Speed */}
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Playback Speed</label>
                    <div className="grid grid-cols-5 gap-1 border border-border bg-muted/30 p-0.5 text-xs font-mono">
                      {speed_options.map((arg0_spd) => (
                        <button
                          key={arg0_spd}
                          type="button"
                          onClick={() => on_change_playback_speed && on_change_playback_speed(arg0_spd)}
                          className={`py-1 text-center transition-colors cursor-pointer ${
                            playback_speed === arg0_spd
                              ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          }`}
                        >
                          {arg0_spd}×
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Keyframe Snapping */}
                  <div className="pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-foreground">Snap to Keyframes</div>
                        <div className="text-[10px] text-muted-foreground">Scrub only genuine raster dates</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => on_toggle_snap_to_keyframes && on_toggle_snap_to_keyframes(!snap_to_keyframes)}
                        className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                          snap_to_keyframes ? 'bg-primary justify-end' : 'bg-muted justify-start border border-border'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-card shadow-xs transition-all" />
                      </button>
                    </div>
                  </div>

                  {/* Loop Playback */}
                  <div className="pt-2 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-foreground">Loop Playback</div>
                        <div className="text-[10px] text-muted-foreground">Restart from beginning at end</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => set_is_looping((arg0_prev) => !arg0_prev)}
                        className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                          is_looping ? 'bg-primary justify-end' : 'bg-muted justify-start border border-border'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-card shadow-xs transition-all" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Loading Indicator Spinner in top left of bottombar */}
            {is_loading && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 border border-primary/30 text-primary text-[11px] font-mono animate-pulse">
                <Icon name="sync" className="text-xs animate-spin" />
                <span>Loading...</span>
              </div>
            )}
          </div>

          {/* Centre Date Badge */}
          <div className="flex items-center gap-2 bg-background/90 border border-border px-4 py-1 shadow-inner">
            <Icon name="event" className="text-primary text-sm" />
            <span className="text-sm font-bold tracking-tight text-foreground font-mono">
              {formatted_date}
            </span>
          </div>

          {/* Right Controls: Collapse Toggle */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => set_is_collapsed((arg0_prev) => !arg0_prev)}
              className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              title={is_collapsed ? 'Expand scrubber track' : 'Collapse scrubber track'}
            >
              <Icon name={is_collapsed ? 'expand_less' : 'expand_more'} />
            </button>
          </div>
        </div>

        {/* Scrubber Track and Keyframe Ticks */}
        {!is_collapsed && (
          <div className="pt-2 px-1">
            <div className="relative flex items-center h-6">
              {/* Keyframe tick marks */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 pointer-events-none z-0">
                {keyframe_positions.map((arg0_kf) => (
                  <div
                    key={arg0_kf.year}
                    style={{ left: `${arg0_kf.left_pct}%` }}
                    className="absolute top-0 bottom-0 w-[1px] bg-primary/40 hover:bg-primary z-0"
                    title={`Raster Keyframe: ${UfDate.formatYear(arg0_kf.year)}`}
                  />
                ))}
              </div>

              {/* Logarithmic Range Slider */}
              <Slider
                min={0}
                max={1000}
                step={1}
                value={[slider_normalised_val]}
                onValueChange={handle_slider_change}
                className="w-full relative z-10 cursor-pointer"
              />
            </div>

            {/* Labels under slider track: positioned according to milestone percentages */}
            <div className="relative h-4 mt-1 text-[10px] text-muted-foreground font-mono">
              {TIMELINE_MILESTONES.map((arg0_m, arg0_idx) => {
                let align_class = arg0_idx === 0
                  ? 'left-0 text-left'
                  : arg0_idx === TIMELINE_MILESTONES.length - 1
                  ? 'right-0 text-right'
                  : '-translate-x-1/2 text-center'
                return (
                  <span
                    key={arg0_m.label}
                    style={
                      arg0_idx > 0 && arg0_idx < TIMELINE_MILESTONES.length - 1
                        ? { left: `${arg0_m.pos*100}%` }
                        : undefined
                    }
                    className={`absolute top-0 cursor-pointer hover:text-foreground transition-colors ${align_class}`}
                    onClick={() => handle_jump_year(arg0_m.year)}
                    title={`Jump to ${arg0_m.label}`}
                  >
                    {arg0_m.label}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TimelineBar
