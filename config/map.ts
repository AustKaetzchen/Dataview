import JSON5 from 'json5'
import rawMapConfig from './map.json5?raw'

export interface BasemapDefinition {
  id: 'dark' | 'light' | 'satellite' | 'topo' | 'none'
  label: string
  url?: string
  attribution?: string
}

export interface MapDefines {
  initialMercator: {
    longitude: number
    latitude: number
    zoom: number
    pitch: number
    bearing: number
    maxZoom: number
    minZoom: number
  }
  initialGlobe: {
    longitude: number
    latitude: number
    zoom: number
    pitch: number
    bearing: number
    maxZoom: number
    minZoom: number
  }
  initialEquirectangular: {
    target: [number, number, number]
    zoom: number
    minZoom: number
    maxZoom: number
  }
  graticule: {
    latInterval: number
    lngInterval: number
    color: [number, number, number, number]
  }
}

export interface MapConfig {
  mercatorPixelOffset: number
  equirectangularPixelOffset: number
  defaultPercentileBreaks: string
  mapDefines: MapDefines
  basemapLayers: BasemapDefinition[]
}

export const MAP_CONFIG: MapConfig = JSON5.parse(rawMapConfig)
