import JSON5 from 'json5'
import rawInfoConfig from './info.json5?raw'

export interface InfoPanelShortcut {
  key: string
  action: string
}

export interface InfoPanelSection {
  heading: string
  text: string
}

export interface InfoPanelTab {
  id: string
  label: string
  icon?: string
  type: 'controls' | 'content' | string
  title?: string
  description?: string
  badge?: string
  shortcutsHeader?: string
  shortcuts?: InfoPanelShortcut[]
  sections?: InfoPanelSection[]
}

export interface InfoPanelConfig {
  title: string
  defaultTab?: string
  tabs: InfoPanelTab[]
}

export const INFO_PANEL_CONFIG: InfoPanelConfig = JSON5.parse(rawInfoConfig)
