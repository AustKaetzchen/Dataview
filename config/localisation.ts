import JSON5 from 'json5'
import rawLocalisationConfig from './localisation.json5?raw'

export interface LocalisationConfig {
  app: {
    title: string
    subtitle: string
    badge: string
  }
  mapmodes: {
    title: string
    activeSuffix: string
    searchPlaceholder: string
    noResults: string
    hintConfigure: string
    hintReorder: string
    haloThicknessLabel: string
    haloThicknessUnit: string
    haloDescription: string
  }
  sidebar: {
    folders: {
      image: string
      palette: string
      display: string
    }
    fileInputMode: string
    singleImage: string
    imageDifference: string
    selectRaster: string
    selectRasterB: string
    binning: string
    colorPalette: string
    invertPalette: string
    valueColorScale: string
    manualRange: string
    basemapLayer: string
    projection: string
    cameraTilt: string
    opacity: string
    resetCamera: string
  }
  analytics: {
    title: string
    steepness: string
    totalCells: string
    validCells: string
    resolution: string
    minValue: string
    maxValue: string
    mean: string
    stdDev: string
    median: string
  }
  hud: {
    coordinate: string
    value: string
  }
}

export const LOCALISATION_CONFIG: LocalisationConfig = JSON5.parse(rawLocalisationConfig)
