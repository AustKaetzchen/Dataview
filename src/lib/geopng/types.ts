export type DataFormat = 'float32' | 'int32'
export type AppMode = 'Single Image' | 'Image Difference'
export type ProjectionType = 'Equirectangular' | 'Mercator' | 'Globe'
export type ScaleType = 'linear' | 'pseudo-log'
export type ColorPalette = 'Plasma' | 'Viridis' | 'Magma' | 'Inferno' | 'Cividis' | 'Turbo' | 'Spectral' | 'Heat'
export type BoundsMode = 'Manual' | 'Percentile'

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
