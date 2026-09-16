import JSON5 from 'json5'
import rawAlertsConfig from './alerts.json5?raw'

export interface AlertStyle {
  title: string
  icon: string
  borderColour: string
  bgColour: string
  titleColour: string
  iconColour: string
}

export const ALERT_CONFIGS: Record<string, AlertStyle> = JSON5.parse(rawAlertsConfig)
