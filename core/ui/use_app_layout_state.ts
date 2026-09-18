/**
 * Layout and sidebar clearance state management hook for root App.
 *
 * @module core/ui/use_app_layout_state
 */

import { useState, useEffect } from 'react'

import { UI_BREAKPOINTS } from '../framework/utils/ui_layout'

export type MobileTab = 'sidebar' | 'timeline' | 'analytics' | 'settings' | null

export interface AppLayoutStateResult {
  activeMobileTab: MobileTab
  colourbarWidth: number
  isHeadlessExport: boolean
  isMobile: boolean
  isSmallScreen: boolean
  isTablet: boolean
  isTouch: boolean
  legendPosition: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  setActiveMobileTab: React.Dispatch<React.SetStateAction<MobileTab>>
  setColourbarWidth: React.Dispatch<React.SetStateAction<number>>
  setLegendPosition: React.Dispatch<React.SetStateAction<'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'>>
  setSidebarBottomClearance: React.Dispatch<React.SetStateAction<number | undefined>>
  setSidebarWidth: React.Dispatch<React.SetStateAction<number>>
  setUiVisible: React.Dispatch<React.SetStateAction<boolean>>
  sidebarBottomClearance: number | undefined
  sidebarTopClearance: number | undefined
  sidebarWidth: number
  uiVisible: boolean
}

/**
 * Manages responsive sidebar clearance, colourbar bounds, headless export detection, and mobile navigation state.
 *
 * @returns {AppLayoutStateResult}
 */
export function useAppLayoutState (): AppLayoutStateResult {
  //Declare local instance variables
  let [active_mobile_tab, set_active_mobile_tab] = useState<MobileTab>(null)
  let [colourbar_width, set_colourbar_width] = useState<number>(336)
  let search_params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null

  let is_headless_export = search_params?.get('export_mode') === '1'
  let [is_mobile, set_is_mobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined')
      return window.innerWidth < UI_BREAKPOINTS.mobile
    return false
  })
  let [is_small_screen, set_is_small_screen] = useState<boolean>(() => {
    if (typeof window !== 'undefined')
      return window.innerWidth < UI_BREAKPOINTS.smallScreen
    return false
  })
  let [is_tablet, set_is_tablet] = useState<boolean>(() => {
    if (typeof window !== 'undefined')
      return window.innerWidth >= UI_BREAKPOINTS.mobile && window.innerWidth < UI_BREAKPOINTS.tablet
    return false
  })
  let [is_touch, set_is_touch] = useState<boolean>(() => {
    if (typeof window !== 'undefined')
      return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)
    return false
  })
  let [legend_position, set_legend_position] = useState<'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'>(() => {
    let url_leg = search_params?.get('legend_position')
    if (url_leg) {
      let normalized = url_leg.replace('centre', 'center') as any
      if (['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].includes(normalized))
        return normalized
    }
    return 'top-left'
  })
  let [sidebar_bottom_clearance, set_sidebar_bottom_clearance] = useState<number | undefined>(undefined)
  let [sidebar_top_clearance, set_sidebar_top_clearance] = useState<number | undefined>(undefined)
  let [sidebar_width, set_sidebar_width] = useState<number>(336)
  let [ui_visible, set_ui_visible] = useState<boolean>(true)

  //Function body
  useEffect(() => {
    let handleResize = () => {
      let current_width = window.innerWidth

      set_is_mobile(current_width < UI_BREAKPOINTS.mobile)
      set_is_small_screen(current_width < UI_BREAKPOINTS.smallScreen)
      set_is_tablet(current_width >= UI_BREAKPOINTS.mobile && current_width < UI_BREAKPOINTS.tablet)
      set_is_touch(('ontouchstart' in window) || (navigator.maxTouchPoints > 0))
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    let updateSidebarClearance = () => {
      //Declare local instance variables
      let from_bottom: number
      let legend_el = document.getElementById('dataview-legend-card-container')
      let max_from_bottom = 0
      let next_bottom_val: number | undefined
      let next_top_val: number | undefined
      let overlaps_bottom: boolean
      let overlaps_top: boolean
      let rect: DOMRect
      let timeline_el = document.getElementById('dataview-timelinebar-container')

      if (is_mobile) {
        if (timeline_el) {
          rect = timeline_el.getBoundingClientRect()
          from_bottom = window.innerHeight - rect.top
          max_from_bottom = Math.max(max_from_bottom, from_bottom)
          next_bottom_val = max_from_bottom + 12
        }
        if (legend_el) {
          rect = legend_el.getBoundingClientRect()
          if (rect.height > 0 && rect.top > window.innerHeight / 2) {
            from_bottom = window.innerHeight - rect.top
            next_bottom_val = Math.max(next_bottom_val ?? 0, from_bottom + 12)
          }
        }
      } else {
        if (timeline_el) {
          rect = timeline_el.getBoundingClientRect()
          from_bottom = window.innerHeight - rect.top
          overlaps_bottom = (rect.left < (sidebar_width + 24))
          if (overlaps_bottom) {
            max_from_bottom = Math.max(max_from_bottom, from_bottom)
            next_bottom_val = max_from_bottom + 12
          }
        }
        if (legend_el) {
          rect = legend_el.getBoundingClientRect()
          if (rect.height > 0) {
            if (rect.top < window.innerHeight / 2) {
              overlaps_top = (rect.left < (sidebar_width + 24))
              if (overlaps_top)
                next_top_val = Math.round(rect.bottom) + 12
            } else {
              overlaps_bottom = (rect.left < (sidebar_width + 24))
              if (overlaps_bottom) {
                from_bottom = window.innerHeight - rect.top
                max_from_bottom = Math.max(max_from_bottom, from_bottom)
                next_bottom_val = max_from_bottom + 12
              }
            }
          }
        }
      }
      set_sidebar_bottom_clearance((arg0_prev) => (arg0_prev === next_bottom_val ? arg0_prev : next_bottom_val))
      set_sidebar_top_clearance((arg0_prev) => (arg0_prev === next_top_val ? arg0_prev : next_top_val))
    }

    updateSidebarClearance()
    window.addEventListener('resize', updateSidebarClearance)
    let ro = new ResizeObserver(updateSidebarClearance)
    let mo = new MutationObserver(() => {
      updateSidebarClearance()
      let l_el = document.getElementById('dataview-legend-card-container')
      let t_el = document.getElementById('dataview-timelinebar-container')
      if (l_el)
        ro.observe(l_el)
      if (t_el)
        ro.observe(t_el)
    })
    let legend_el = document.getElementById('dataview-legend-card-container')
    let timeline_el = document.getElementById('dataview-timelinebar-container')
    if (legend_el)
      ro.observe(legend_el)
    if (timeline_el)
      ro.observe(timeline_el)
    if (typeof document !== 'undefined' && document.body)
      mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.removeEventListener('resize', updateSidebarClearance)
      ro.disconnect()
      mo.disconnect()
    }
  }, [sidebar_width])

  //Return statement
  return {
    activeMobileTab: active_mobile_tab,
    colourbarWidth: colourbar_width,
    isHeadlessExport: is_headless_export,
    isMobile: is_mobile,
    isSmallScreen: is_small_screen,
    isTablet: is_tablet,
    isTouch: is_touch,
    legendPosition: legend_position,
    setActiveMobileTab: set_active_mobile_tab,
    setColourbarWidth: set_colourbar_width,
    setLegendPosition: set_legend_position,
    setSidebarBottomClearance: set_sidebar_bottom_clearance,
    setSidebarWidth: set_sidebar_width,
    setUiVisible: set_ui_visible,
    sidebarBottomClearance: sidebar_bottom_clearance,
    sidebarTopClearance: sidebar_top_clearance,
    sidebarWidth: sidebar_width,
    uiVisible: ui_visible,
  }
}
