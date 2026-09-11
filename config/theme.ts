import JSON5 from 'json5'
import rawThemeConfig from './theme.json5?raw'

export interface ThemeConfig {
  accentPrimary: string
  accentSecondary: string
  accentTertiary: string
  bgPrimary: string
  bgSecondary: string
  bgMuted: string
  hoverColour: string
  textPrimary: string
  textMuted: string
  iconColor: string
  toggleActive: string
  toggleInactive: string
  p99Active: string
  badgeActiveBg: string
  badgeActiveBorder: string
  badgeActiveText: string
  buttonActiveBg: string
  buttonActiveText: string
  buttonActiveBorder: string
}

export const THEME_CONFIG: ThemeConfig = JSON5.parse(rawThemeConfig)
