import JSON5 from 'json5'
import rawLandmarksConfig from './landmarks.json5?raw'
import type { UfDateObject } from '@framework/utils/uf_date'

export interface LandmarkPreset {
  date: UfDateObject
  description?: string
  id: string
  label: string
}

export let LANDMARK_PRESETS: LandmarkPreset[] = JSON5.parse(rawLandmarksConfig)
