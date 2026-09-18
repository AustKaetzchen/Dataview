/**
 * UI Layout Anchor & Dimension Registry.
 *
 * Centralises layout tracking for docked bars and floating panels.
 */

export interface UIBreakpoints {
  mobile: number
  smallScreen: number
  tablet: number
}

export interface UILayoutMetrics {
  gap: number
  margin: number
  mobileNavBarHeight: number
  settingsDrawerRight: number
  settingsDrawerWidth: number
  sidebarWidth: number
  toolbarWidth: number
}

export let UI_BREAKPOINTS: UIBreakpoints = {
  mobile: 768,
  smallScreen: 1280,
  tablet: 1024,
}

export let UI_LAYOUT: UILayoutMetrics = {
  gap: 12,
  margin: 12,
  mobileNavBarHeight: 56,
  settingsDrawerRight: 62,
  settingsDrawerWidth: 288,
  sidebarWidth: 336,
  toolbarWidth: 38,
}

/**
 * Computes right offset for the Analytics view panel with guaranteed standard gap.
 *
 * @param {boolean} arg0_is_settings_drawer_open
 *
 * @returns {number}
 */
export function getAnalyticsPanelRightOffset (arg0_is_settings_drawer_open: boolean): number {
  //Convert from parameters
  let is_settings_drawer_open = arg0_is_settings_drawer_open

  //Declare local instance variables
  let taken = getRightbarTakenWidth(is_settings_drawer_open)

  //Return statement
  return taken + UI_LAYOUT.gap
}

/**
 * Computes total taken width from the right edge for right-docked elements.
 *
 * @param {boolean} arg0_is_settings_drawer_open
 *
 * @returns {number}
 */
export function getRightbarTakenWidth (arg0_is_settings_drawer_open: boolean): number {
  //Convert from parameters
  let is_settings_drawer_open = arg0_is_settings_drawer_open

  //Guard clauses
  if (is_settings_drawer_open)
    return UI_LAYOUT.settingsDrawerRight + UI_LAYOUT.settingsDrawerWidth

  //Return statement
  return UI_LAYOUT.margin + UI_LAYOUT.toolbarWidth
}

/**
 * Offset from left screen edge for overlays adjacent to the floating sidebar.
 *
 * @returns {number}
 */
export function getSidebarOverlayLeft (): number {
  //Return statement
  return UI_LAYOUT.margin + UI_LAYOUT.sidebarWidth + UI_LAYOUT.gap
}

/**
 * Calculates bottom clearance for elements docked above the bottombar (TimelineBar).
 *
 * @param {number} arg0_timeline_height
 * @param {boolean} [arg1_is_visible=true]
 *
 * @returns {number}
 */
export function getBottombarClearance (arg0_timeline_height: number, arg1_is_visible?: boolean): number {
  //Convert from parameters
  let is_visible = (arg1_is_visible !== undefined) ? arg1_is_visible : true
  let timeline_height = arg0_timeline_height

  //Guard clauses
  if (!is_visible)
    return UI_LAYOUT.margin

  //Return statement
  return Math.max(UI_LAYOUT.margin, timeline_height + UI_LAYOUT.margin)
}

/**
 * Calculates bottom clearance for elements docked above the rightbar (MapmodesTray).
 *
 * @param {number} arg0_bottom_clearance
 * @param {number} arg0_mapmodes_height
 *
 * @returns {number}
 */
export function getMapmodesClearance (arg0_bottom_clearance: number, arg1_mapmodes_height: number): number {
  //Convert from parameters
  let bottom_clearance = arg0_bottom_clearance
  let mapmodes_height = arg1_mapmodes_height

  //Return statement
  return bottom_clearance + mapmodes_height + UI_LAYOUT.gap
}

/**
 * Calculates the left boundary of the flexible residual space between sidebars.
 *
 * @param {boolean} arg0_is_sidebar_visible
 * @param {number} [arg1_sidebar_width]
 *
 * @returns {number}
 */
export function getResidualLeft (arg0_is_sidebar_visible: boolean, arg1_sidebar_width?: number): number {
  //Convert from parameters
  let is_sidebar_visible = arg0_is_sidebar_visible
  let sidebar_width = (arg1_sidebar_width !== undefined) ? arg1_sidebar_width : UI_LAYOUT.sidebarWidth

  //Guard clauses
  if (!is_sidebar_visible)
    return UI_LAYOUT.margin

  //Return statement
  return UI_LAYOUT.margin + sidebar_width + UI_LAYOUT.gap
}

/**
 * Calculates the right boundary offset of the flexible residual space between sidebars.
 *
 * @param {boolean} [arg0_is_settings_drawer_open=false]
 *
 * @returns {number}
 */
export function getResidualRight (arg0_is_settings_drawer_open?: boolean): number {
  //Convert from parameters
  let is_settings_drawer_open = Boolean(arg0_is_settings_drawer_open)

  //Guard clauses
  if (is_settings_drawer_open)
    return UI_LAYOUT.settingsDrawerRight + UI_LAYOUT.settingsDrawerWidth + UI_LAYOUT.gap

  //Return statement
  return UI_LAYOUT.margin + UI_LAYOUT.toolbarWidth + UI_LAYOUT.gap
}


