/**
 * Layout and sidebar clearance state management hook for root App.
 *
 * @module core/ui/use_app_layout_state
 */

import { useState, useEffect } from 'react'

export interface AppLayoutStateResult {
  colourbarWidth: number
  isHeadlessExport: boolean
  legendPosition: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  setColourbarWidth: React.Dispatch<React.SetStateAction<number>>
  setLegendPosition: React.Dispatch<React.SetStateAction<'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'>>
  setSidebarBottomClearance: React.Dispatch<React.SetStateAction<number | undefined>>
  setSidebarWidth: React.Dispatch<React.SetStateAction<number>>
  setUiVisible: React.Dispatch<React.SetStateAction<boolean>>
  sidebarBottomClearance: number | undefined
  sidebarWidth: number
  uiVisible: boolean
}

/**
 * Manages responsive sidebar clearance, colourbar bounds, and headless export detection.
 *
 * @returns {AppLayoutStateResult}
 */
export function useAppLayoutState (): AppLayoutStateResult {
  //Declare local instance variables
  let [colourbar_width, set_colourbar_width] = useState<number>(336)
  let search_params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  let is_headless_export = search_params?.get('export_mode') === '1'
  let [legend_position, set_legend_position] = useState<'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'>(() => {
    let url_leg = search_params?.get('legend_position')
    if (url_leg) {
      let normalized = url_leg.replace('centre', 'center') as any
      if (['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].includes(normalized))
        return normalized
    }
    return 'bottom-right'
  })
  let [sidebar_bottom_clearance, set_sidebar_bottom_clearance] = useState<number | undefined>(undefined)
  let [sidebar_width, set_sidebar_width] = useState<number>(336)
  let [ui_visible, set_ui_visible] = useState<boolean>(true)

  //Function body
  useEffect(() => {
    let updateSidebarClearance = () => {
      let clearance: number
      let is_vertical = window.innerHeight > window.innerWidth
      let next_val: number | undefined
      let overlaps: boolean
      let timeline_el = document.getElementById('dataview-timelinebar-container')
      if (timeline_el) {
        let rect = timeline_el.getBoundingClientRect()
        let from_bottom = window.innerHeight - rect.top
        clearance = Math.max(from_bottom, 0) + 12
        overlaps = is_vertical || (rect.left < (sidebar_width + 24))
        next_val = overlaps ? clearance : undefined
        set_sidebar_bottom_clearance((arg0_prev) => (arg0_prev === next_val ? arg0_prev : next_val))
      } else {
        set_sidebar_bottom_clearance((arg0_prev) => (arg0_prev === undefined ? undefined : undefined))
      }
    }

    updateSidebarClearance()
    window.addEventListener('resize', updateSidebarClearance)
    let observer = typeof MutationObserver !== 'undefined' ? new MutationObserver(updateSidebarClearance) : null
    let target = document.getElementById('dataview-timelinebar-container')
    if (observer && target)
      observer.observe(target, { attributes: true, childList: true, subtree: true })

    return () => {
      window.removeEventListener('resize', updateSidebarClearance)
      if (observer)
        observer.disconnect()
    }
  }, [sidebar_width])

  //Return statement
  return {
    colourbarWidth: colourbar_width,
    isHeadlessExport: is_headless_export,
    legendPosition: legend_position,
    setColourbarWidth: set_colourbar_width,
    setLegendPosition: set_legend_position,
    setSidebarBottomClearance: set_sidebar_bottom_clearance,
    setSidebarWidth: set_sidebar_width,
    setUiVisible: set_ui_visible,
    sidebarBottomClearance: sidebar_bottom_clearance,
    sidebarWidth: sidebar_width,
    uiVisible: ui_visible,
  }
}
