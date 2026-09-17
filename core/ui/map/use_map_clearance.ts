/**
 * Clearance and bounding rect calculation hook for MapViewer overlays and HUD elements.
 */

import { useState, useEffect } from 'react'
import { UI_LAYOUT } from '@framework/utils/ui_layout.ts'
import type { MapModeItem } from '@framework/geopng/types.ts'

export interface MapClearanceOptions {
  analyticsOpen?: boolean
  flyoutOpen?: boolean
  mapModes?: MapModeItem[]
  uiVisible?: boolean
}

export interface MapClearanceResult {
  mapmodesBounds: { left: number; right: number; top: number } | null
  mapmodesTakenRight: number
  timelineBounds: { left: number; right: number; top: number } | null
  timelineClearance: number
  topRightTaken: number
}

/**
 * Monitors DOM bounding boxes to compute clearances for HUD overlays around the timeline and mapmodes tray.
 *
 * @param {MapClearanceOptions} [arg0_options]
 *
 * @returns {MapClearanceResult}
 */
export function useMapClearance (arg0_options?: MapClearanceOptions): MapClearanceResult {
  //Convert from parameters
  let options = (arg0_options) ? arg0_options : {}
  let analytics_open = options.analyticsOpen
  let flyout_open = options.flyoutOpen
  let map_modes = options.mapModes
  let ui_visible = options.uiVisible

  //Declare local instance variables
  let [mapmodes_bounds, set_mapmodes_bounds] = useState<{ left: number; right: number; top: number } | null>(null)
  let [mapmodes_taken_right, set_mapmodes_taken_right] = useState<number>(0)
  let [timeline_bounds, set_timeline_bounds] = useState<{ left: number; right: number; top: number } | null>(null)
  let [timeline_clearance, set_timeline_clearance] = useState<number>(UI_LAYOUT.margin)
  let [top_right_taken, set_top_right_taken] = useState<number>(0)

  //Function body
  useEffect(() => {
    let updateClearance = () => {
      //1. Timeline bounds and clearance
      let timeline_el = document.getElementById('dataview-timelinebar-container')
      if (timeline_el) {
        let rect = timeline_el.getBoundingClientRect()
        let vp_height = (typeof window !== 'undefined' && window.visualViewport)
          ? window.visualViewport.height
          : (typeof window !== 'undefined' ? window.innerHeight : 800)
        let from_bottom = vp_height - rect.top
        let next_clearance = Math.max(from_bottom, 0) + UI_LAYOUT.margin
        set_timeline_clearance((arg0_prev) => (arg0_prev === next_clearance ? arg0_prev : next_clearance))
        set_timeline_bounds((arg0_prev) => {
          if (arg0_prev && arg0_prev.left === rect.left && arg0_prev.right === rect.right && arg0_prev.top === rect.top)
            return arg0_prev
          return { left: rect.left, right: rect.right, top: rect.top }
        })
      } else {
        set_timeline_clearance((arg0_prev) => (arg0_prev === UI_LAYOUT.margin ? arg0_prev : UI_LAYOUT.margin))
        set_timeline_bounds((arg0_prev) => (arg0_prev === null ? null : null))
      }

      //2. Mapmodes tray bounds
      let mapmodes_el = document.getElementById('dataview-mapmodes-tray')
      if (mapmodes_el) {
        let rect = mapmodes_el.getBoundingClientRect()
        if (rect.width > 0 && rect.left < window.innerWidth) {
          let next_taken = Math.max(window.innerWidth - rect.left, 0)
          set_mapmodes_taken_right((arg0_prev) => (arg0_prev === next_taken ? arg0_prev : next_taken))
          set_mapmodes_bounds((arg0_prev) => {
            if (arg0_prev && arg0_prev.left === rect.left && arg0_prev.right === rect.right && arg0_prev.top === rect.top)
              return arg0_prev
            return { left: rect.left, right: rect.right, top: rect.top }
          })
        } else {
          set_mapmodes_taken_right((arg0_prev) => (arg0_prev === 0 ? 0 : 0))
          set_mapmodes_bounds((arg0_prev) => (arg0_prev === null ? null : null))
        }
      } else {
        set_mapmodes_taken_right((arg0_prev) => (arg0_prev === 0 ? 0 : 0))
        set_mapmodes_bounds((arg0_prev) => (arg0_prev === null ? null : null))
      }

      //3. Top-right trays (AnalyticsDrawer, Settings, Toolbar)
      let current_top_right = 0
      let analytics_el = document.getElementById('dataview-analytics-drawer')
      let settings_el = document.getElementById('dataview-settings-drawer')
      let toolbar_el = document.getElementById('dataview-top-right-toolbar')

      if (analytics_el) {
        let rect = analytics_el.getBoundingClientRect()
        if (rect.width > 0 && rect.left < window.innerWidth)
          current_top_right = Math.max(current_top_right, window.innerWidth - rect.left)
      }
      if (settings_el) {
        let rect = settings_el.getBoundingClientRect()
        if (rect.width > 0 && rect.left < window.innerWidth)
          current_top_right = Math.max(current_top_right, window.innerWidth - rect.left)
      }
      if (toolbar_el) {
        let rect = toolbar_el.getBoundingClientRect()
        if (rect.width > 0 && rect.left < window.innerWidth)
          current_top_right = Math.max(current_top_right, window.innerWidth - rect.left)
      }
      set_top_right_taken((arg0_prev) => (arg0_prev === current_top_right ? arg0_prev : current_top_right))
    }

    updateClearance()
    window.addEventListener('resize', updateClearance)
    if (typeof window !== 'undefined' && window.visualViewport)
      window.visualViewport.addEventListener('resize', updateClearance)
    let ro = new ResizeObserver(updateClearance)
    let timeline_el = document.getElementById('dataview-timelinebar-container')
    let mapmodes_el = document.getElementById('dataview-mapmodes-tray')
    if (timeline_el)
      ro.observe(timeline_el)
    if (mapmodes_el)
      ro.observe(mapmodes_el)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateClearance)
      if (typeof window !== 'undefined' && window.visualViewport)
        window.visualViewport.removeEventListener('resize', updateClearance)
    }
  }, [flyout_open, analytics_open, ui_visible, map_modes])

  //Return statement
  return {
    mapmodesBounds: mapmodes_bounds,
    mapmodesTakenRight: mapmodes_taken_right,
    timelineBounds: timeline_bounds,
    timelineClearance: timeline_clearance,
    topRightTaken: top_right_taken,
  }
}
