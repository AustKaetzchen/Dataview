/**
 * UI Layout Anchor & Dimension Registry
 * 
 * Centralizes layout tracking for all docked bars and floating panels:
 * - leftbar: sidebar width
 * - rightbar: toolbar, settings drawer, analytics panel
 * - topbar: standard top margin & header elements
 * - bottombar: bottom margin & mapmodes tray
 */

export interface UILayoutMetrics {
  margin: number
  gap: number
  sidebarWidth: number
  toolbarWidth: number
  settingsDrawerWidth: number
  settingsDrawerRight: number
}

export const UI_LAYOUT: UILayoutMetrics = {
  margin: 12, // 12px standard outer margin
  gap: 12, // 12px standard gap between adjacent panels
  sidebarWidth: 336, // w-84 = 336px
  toolbarWidth: 38, // 28px button + 8px padding + 2px border = 38px
  settingsDrawerWidth: 288, // w-72 = 288px
  settingsDrawerRight: 62, // margin (12) + toolbarWidth (38) + gap (12) = 62px
}

/**
 * Computes total taken width from the right edge for right-docked elements
 */
export function getRightbarTakenWidth(isSettingsDrawerOpen: boolean): number {
  if (isSettingsDrawerOpen) {
    return UI_LAYOUT.settingsDrawerRight + UI_LAYOUT.settingsDrawerWidth
  }
  return UI_LAYOUT.margin + UI_LAYOUT.toolbarWidth
}

/**
 * Computes right offset for the Analytics view panel with guaranteed standard gap
 */
export function getAnalyticsPanelRightOffset(isSettingsDrawerOpen: boolean): number {
  const taken = getRightbarTakenWidth(isSettingsDrawerOpen)
  return taken + UI_LAYOUT.gap
}

/**
 * Offset from left screen edge for overlays adjacent to the floating sidebar
 */
export function getSidebarOverlayLeft(): number {
  return UI_LAYOUT.margin + UI_LAYOUT.sidebarWidth + UI_LAYOUT.gap
}

