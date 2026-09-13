/**
 * UI Layout Anchor & Dimension Registry.
 *
 * Centralises layout tracking for docked bars and floating panels.
 */

export interface UILayoutMetrics {
  gap: number
  margin: number
  settingsDrawerRight: number
  settingsDrawerWidth: number
  sidebarWidth: number
  toolbarWidth: number
}

export let UI_LAYOUT: UILayoutMetrics = {
  gap: 12,
  margin: 12,
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
