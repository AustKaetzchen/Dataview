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
  leftbar: {
    width: number // 320px (w-80)
  }
  rightbar: {
    margin: number // 16px (right-4)
    toolbarWidth: number // 36px (w-9)
    gap: number // 16px (1rem)
    settingsDrawerWidth: number // 288px (w-72)
    settingsDrawerRight: number // 56px (right-14)
  }
  topbar: {
    margin: number // 16px (top-4)
  }
  bottombar: {
    margin: number // 16px (bottom-4)
    mapmodesWidth: number // 256px (w-64)
  }
}

export const UI_LAYOUT: UILayoutMetrics = {
  leftbar: {
    width: 320,
  },
  rightbar: {
    margin: 16,
    toolbarWidth: 36,
    gap: 16,
    settingsDrawerWidth: 288,
    settingsDrawerRight: 56,
  },
  topbar: {
    margin: 16,
  },
  bottombar: {
    margin: 16,
    mapmodesWidth: 256,
  },
}

/**
 * Computes the total taken width from the right edge for rightbar elements
 */
export function getRightbarTakenWidth(isSettingsDrawerOpen: boolean): number {
  if (isSettingsDrawerOpen) {
    // Toolbar (52px) + Settings Drawer (56px + 288px = 344px)
    return UI_LAYOUT.rightbar.settingsDrawerRight + UI_LAYOUT.rightbar.settingsDrawerWidth
  }
  // Toolbar only: margin (16px) + width (36px) = 52px
  return UI_LAYOUT.rightbar.margin + UI_LAYOUT.rightbar.toolbarWidth
}

/**
 * Computes the right offset for the Analytics view panel
 * so it leaves a clean 16px margin from whichever right-hand element is active
 */
export function getAnalyticsPanelRightOffset(isSettingsDrawerOpen: boolean): number {
  const taken = getRightbarTakenWidth(isSettingsDrawerOpen)
  return taken + UI_LAYOUT.rightbar.gap
}
