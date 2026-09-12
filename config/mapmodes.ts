import JSON5 from 'json5'
import rawMapmodesConfig from './panes/mapmodes.json5?raw'
import { MapModeId } from '@/lib/geopng/types'

export interface MapmodeConfigItem {
  id: MapModeId
  label: string
  description?: string
  active?: boolean
  controlDescription?: string
}

export interface MapmodesConfig {
  modes: MapmodeConfigItem[]
  controlsFooter: string[]
}

export const MAPMODES_CONFIG: MapmodesConfig = JSON5.parse(rawMapmodesConfig)
