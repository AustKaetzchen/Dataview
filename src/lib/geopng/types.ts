export type DataFormat = 'float32' | 'int32'
export type AppMode = 'Single Image' | 'Image Difference'
export type ProjectionType = 'Equirectangular' | 'Mercator' | 'Globe' | 'EqualEarth'
export type ScaleType = 'linear' | 'pseudo-log'
export type ColorPalette =
  | 'Viridis'
  | 'Plasma'
  | 'Inferno'
  | 'Magma'
  | 'Cividis'
  | 'Turbo'
  | 'Warm'
  | 'Cool'
  | 'CubehelixDefault'
  | 'Rainbow'
  | 'Sinebow'
  | 'Spectral'
  | 'Blues'
  | 'Greens'
  | 'Greys'
  | 'Oranges'
  | 'Purples'
  | 'Reds'
  | 'BuGn'
  | 'BuPu'
  | 'GnBu'
  | 'OrRd'
  | 'PuBu'
  | 'PuBuGn'
  | 'PuRd'
  | 'RdPu'
  | 'YlGn'
  | 'YlGnBu'
  | 'YlOrBr'
  | 'YlOrRd'
  | 'BrBG'
  | 'PRGn'
  | 'PiYG'
  | 'PuOr'
  | 'RdBu'
  | 'RdGy'
  | 'RdYlBu'
  | 'RdYlGn'

export interface ColorSchemeInfo {
  id: ColorPalette
  name: string
  category: 'Sequential (Multi-Hue)' | 'Sequential (Single-Hue)' | 'Diverging' | 'Cyclical'
}
export type BoundsMode = 'Manual' | 'Percentile' | 'Absolute'

export type DownsampleMethod = 'average' | 'minimum' | 'maximum' | 'near'

export interface BinningConfig {
  enabled: boolean
  width: number
  height: number
  method: DownsampleMethod
}

export interface HeightmapConfig {
  enabled: boolean
  elevationScale: number // height multiplier in meters
  opacity?: number // 0.0 to 1.0 (defaults to 0.9)
  opacityByPercentile?: boolean // tie opacity to cell empirical percentile rank
  opacityByPercentileStrength?: number // 0.0 to 1.0 (defaults to 1.0)
}

export type MapModeId = 'default' | 'country_analysis' | 'spike_map' | 'circle_sizing'

export interface MapModeItem {
  id: MapModeId
  label: string
  active: boolean
}

export interface CircleOverlayConfig {
  enabled: boolean
  percentileCutoff: number // e.g. 99 for P99
  baseRadius: number // base size scale
  strokeWidth: number // coloured stroke width in pixels
  haloWidth: number // black halo width in pixels
}

export interface DecodedRaster {
  data: Float32Array
  width: number
  height: number
  bounds: [number, number, number, number] // [west, south, east, north] (e.g. [-180, -90, 180, 90])
  min: number
  max: number
  mean: number
  stdDev: number
  validCount: number
  totalCells: number
  total?: number // Sum of all valid raster cell values
  histogram?: { bins: number[]; counts: number[]; min: number; max: number }
  quantiles?: Record<number, number>
}

export interface InspectionData {
  pixelX: number
  pixelY: number
  lng: number
  lat: number
  value: number | null
  rawRGBA?: [number, number, number, number]
  countryName?: string | null
}

export interface TransectPoint {
  distanceRatio: number // 0 to 1
  lng: number
  lat: number
  value: number | null
}
