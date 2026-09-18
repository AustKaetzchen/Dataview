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
  colourbarClearance: number
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
  let [colourbar_clearance, set_colourbar_clearance] = useState<number>(0)
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

      //3. Colourbar bottom clearance
      let legend_el = document.getElementById('dataview-legend-card-container')
      let next_colourbar_clearance = 0
      if (legend_el) {
        let rect = legend_el.getBoundingClientRect()
        let vp_height = (typeof window !== 'undefined' && window.visualViewport)
          ? window.visualViewport.height
          : (typeof window !== 'undefined' ? window.innerHeight : 800)
        if (rect.height > 0 && rect.top > vp_height / 2)
          next_colourbar_clearance = Math.max(0, vp_height - rect.top) + UI_LAYOUT.gap
      }
      set_colourbar_clearance((arg0_prev) => (arg0_prev === next_colourbar_clearance ? arg0_prev : next_colourbar_clearance))

      //4. Top-right toolbar and desktop drawers
      let current_top_right = 0
      let analytics_el = document.getElementById('dataview-analytics-drawer')
      let is_desktop_mode = (typeof window !== 'undefined') ? (window.innerWidth > 768) : true
      let settings_el = document.getElementById('dataview-settings-drawer')
      let toolbar_el = document.getElementById('dataview-top-right-toolbar')

      if (toolbar_el) {
        let rect = toolbar_el.getBoundingClientRect()
        if (rect.width > 0 && rect.left < window.innerWidth)
          current_top_right = Math.max(current_top_right, window.innerWidth - rect.left)
      }
      if (is_desktop_mode) {
        if (analytics_el) {
          let rect = analytics_el.getBoundingClientRect()
          if (rect.width > 0 && rect.left < window.innerWidth && rect.top < 150)
            current_top_right = Math.max(current_top_right, window.innerWidth - rect.left)
        }
        if (settings_el) {
          let rect = settings_el.getBoundingClientRect()
          if (rect.width > 0 && rect.left < window.innerWidth && rect.top < 150)
            current_top_right = Math.max(current_top_right, window.innerWidth - rect.left)
        }
      }
      if (ui_visible && current_top_right === 0)
        current_top_right = 44
      set_top_right_taken((arg0_prev) => (arg0_prev === current_top_right ? arg0_prev : current_top_right))
    }

    updateClearance()
    window.addEventListener('resize', updateClearance)
    if (typeof window !== 'undefined' && window.visualViewport)
      window.visualViewport.addEventListener('resize', updateClearance)

    let ro = new ResizeObserver(updateClearance)
    let mo = new MutationObserver(() => {
      updateClearance()
      let a_el = document.getElementById('dataview-analytics-drawer')
      let l_el = document.getElementById('dataview-legend-card-container')
      let m_el = document.getElementById('dataview-mapmodes-tray')
      let s_el = document.getElementById('dataview-settings-drawer')
      let t_el = document.getElementById('dataview-timelinebar-container')
      let tb_el = document.getElementById('dataview-top-right-toolbar')
      if (a_el)
        ro.observe(a_el)
      if (l_el)
        ro.observe(l_el)
      if (m_el)
        ro.observe(m_el)
      if (s_el)
        ro.observe(s_el)
      if (t_el)
        ro.observe(t_el)
      if (tb_el)
        ro.observe(tb_el)
    })

    let analytics_el = document.getElementById('dataview-analytics-drawer')
    let legend_el = document.getElementById('dataview-legend-card-container')
    let mapmodes_el = document.getElementById('dataview-mapmodes-tray')
    let settings_el = document.getElementById('dataview-settings-drawer')
    let timeline_el = document.getElementById('dataview-timelinebar-container')
    let toolbar_el = document.getElementById('dataview-top-right-toolbar')
    if (analytics_el)
      ro.observe(analytics_el)
    if (legend_el)
      ro.observe(legend_el)
    if (mapmodes_el)
      ro.observe(mapmodes_el)
    if (settings_el)
      ro.observe(settings_el)
    if (timeline_el)
      ro.observe(timeline_el)
    if (toolbar_el)
      ro.observe(toolbar_el)

    if (typeof document !== 'undefined' && document.body)
      mo.observe(document.body, { attributes: true, attributeFilter: ['style', 'class'], childList: true, subtree: true })

    return () => {
      mo.disconnect()
      ro.disconnect()
      window.removeEventListener('resize', updateClearance)
      if (typeof window !== 'undefined' && window.visualViewport)
        window.visualViewport.removeEventListener('resize', updateClearance)
    }
  }, [flyout_open, analytics_open, ui_visible, map_modes])

  //Return statement
  return {
    colourbarClearance: colourbar_clearance,
    mapmodesBounds: mapmodes_bounds,
    mapmodesTakenRight: mapmodes_taken_right,
    timelineBounds: timeline_bounds,
    timelineClearance: timeline_clearance,
    topRightTaken: top_right_taken,
  }
}
