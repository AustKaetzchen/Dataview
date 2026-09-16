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
    pixelOffset?: number
  }
  initialGlobe: {
    longitude: number
    latitude: number
    zoom: number
    pitch: number
    bearing: number
    maxZoom: number
    minZoom: number
    pixelOffset?: number
  }
  initialEquirectangular: {
    target: [number, number, number]
    zoom: number
    minZoom: number
    maxZoom: number
    pixelOffset?: number
  }
  initialEqualEarth?: {
    target: [number, number, number]
    zoom: number
    minZoom: number
    maxZoom: number
    pixelOffset?: number
  }
  graticule: {
    latInterval: number
    lngInterval: number
    color: [number, number, number, number]
  }
}

export interface MapConfig {
  mercatorPixelOffset?: number
  equirectangularPixelOffset?: number
  globePixelOffset?: number
  equalEarthPixelOffset?: number
  defaultPercentileBreaks: string
  mapDefines: MapDefines
  basemapLayers: BasemapDefinition[]
}

export let MAP_CONFIG: MapConfig = JSON5.parse(rawMapConfig)

/**
 * Returns the configured pixel offset for a given projection mode.
 * Defaults to -1 if unspecified.
 *
 * @param {string} arg0_projection
 *
 * @returns {number}
 */
export function getPixelOffset (arg0_projection: string): number {
  //Convert from parameters
  let projection = arg0_projection

  //Declare local instance variables
  let defs = MAP_CONFIG.mapDefines as any

  //Guard clauses
  if (!defs)
    return -1

  //Function body
  if (projection === 'Mercator') {
    return defs.initialMercator?.pixelOffset ?? defs.mercator?.pixelOffset ?? MAP_CONFIG.mercatorPixelOffset ?? -1
  } else if (projection === 'Globe') {
    return defs.initialGlobe?.pixelOffset ?? defs.globe?.pixelOffset ?? MAP_CONFIG.globePixelOffset ?? -1
  } else if (projection === 'Equirectangular') {
    return defs.initialEquirectangular?.pixelOffset ?? defs.equirectangular?.pixelOffset ?? MAP_CONFIG.equirectangularPixelOffset ?? -1
  } else if (projection === 'EqualEarth') {
    return defs.initialEqualEarth?.pixelOffset ?? defs.equalEarth?.pixelOffset ?? MAP_CONFIG.equalEarthPixelOffset ?? -1
  }

  //Return statement
  return -1
}
