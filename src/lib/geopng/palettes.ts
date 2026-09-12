import * as d3Chromatic from 'd3-scale-chromatic'
import { ColorPalette, ColorSchemeInfo, ScaleType, ProjectionType } from './types'
import { transformValue } from './scales'
import { CountryFeature } from './polygonBinning'

type RGB = [number, number, number]

// Map palette ID to d3-scale-chromatic interpolator
const D3_INTERPOLATOR_MAP: Record<ColorPalette, (t: number) => string> = {
  Viridis: d3Chromatic.interpolateViridis,
  Plasma: d3Chromatic.interpolatePlasma,
  Inferno: d3Chromatic.interpolateInferno,
  Magma: d3Chromatic.interpolateMagma,
  Cividis: d3Chromatic.interpolateCividis,
  Turbo: d3Chromatic.interpolateTurbo,
  Warm: d3Chromatic.interpolateWarm,
  Cool: d3Chromatic.interpolateCool,
  CubehelixDefault: d3Chromatic.interpolateCubehelixDefault,
  Rainbow: d3Chromatic.interpolateRainbow,
  Sinebow: d3Chromatic.interpolateSinebow,
  Spectral: d3Chromatic.interpolateSpectral,
  Blues: d3Chromatic.interpolateBlues,
  Greens: d3Chromatic.interpolateGreens,
  Greys: d3Chromatic.interpolateGreys,
  Oranges: d3Chromatic.interpolateOranges,
  Purples: d3Chromatic.interpolatePurples,
  Reds: d3Chromatic.interpolateReds,
  BuGn: d3Chromatic.interpolateBuGn,
  BuPu: d3Chromatic.interpolateBuPu,
  GnBu: d3Chromatic.interpolateGnBu,
  OrRd: d3Chromatic.interpolateOrRd,
  PuBu: d3Chromatic.interpolatePuBu,
  PuBuGn: d3Chromatic.interpolatePuBuGn,
  PuRd: d3Chromatic.interpolatePuRd,
  RdPu: d3Chromatic.interpolateRdPu,
  YlGn: d3Chromatic.interpolateYlGn,
  YlGnBu: d3Chromatic.interpolateYlGnBu,
  YlOrBr: d3Chromatic.interpolateYlOrBr,
  YlOrRd: d3Chromatic.interpolateYlOrRd,
  BrBG: d3Chromatic.interpolateBrBG,
  PRGn: d3Chromatic.interpolatePRGn,
  PiYG: d3Chromatic.interpolatePiYG,
  PuOr: d3Chromatic.interpolatePuOr,
  RdBu: d3Chromatic.interpolateRdBu,
  RdGy: d3Chromatic.interpolateRdGy,
  RdYlBu: d3Chromatic.interpolateRdYlBu,
  RdYlGn: d3Chromatic.interpolateRdYlGn,
}

export const D3_COLOR_SCHEMES: ColorSchemeInfo[] = [
  // Sequential (Multi-Hue)
  { id: 'Viridis', name: 'Viridis', category: 'Sequential (Multi-Hue)' },
  { id: 'Plasma', name: 'Plasma', category: 'Sequential (Multi-Hue)' },
  { id: 'Inferno', name: 'Inferno', category: 'Sequential (Multi-Hue)' },
  { id: 'Magma', name: 'Magma', category: 'Sequential (Multi-Hue)' },
  { id: 'Cividis', name: 'Cividis', category: 'Sequential (Multi-Hue)' },
  { id: 'Turbo', name: 'Turbo', category: 'Sequential (Multi-Hue)' },
  { id: 'Warm', name: 'Warm', category: 'Sequential (Multi-Hue)' },
  { id: 'Cool', name: 'Cool', category: 'Sequential (Multi-Hue)' },
  { id: 'CubehelixDefault', name: 'Cubehelix Default', category: 'Sequential (Multi-Hue)' },
  { id: 'BuGn', name: 'Blue-Green (BuGn)', category: 'Sequential (Multi-Hue)' },
  { id: 'BuPu', name: 'Blue-Purple (BuPu)', category: 'Sequential (Multi-Hue)' },
  { id: 'GnBu', name: 'Green-Blue (GnBu)', category: 'Sequential (Multi-Hue)' },
  { id: 'OrRd', name: 'Orange-Red (OrRd)', category: 'Sequential (Multi-Hue)' },
  { id: 'PuBu', name: 'Purple-Blue (PuBu)', category: 'Sequential (Multi-Hue)' },
  { id: 'PuBuGn', name: 'Purple-Blue-Green (PuBuGn)', category: 'Sequential (Multi-Hue)' },
  { id: 'PuRd', name: 'Purple-Red (PuRd)', category: 'Sequential (Multi-Hue)' },
  { id: 'RdPu', name: 'Red-Purple (RdPu)', category: 'Sequential (Multi-Hue)' },
  { id: 'YlGn', name: 'Yellow-Green (YlGn)', category: 'Sequential (Multi-Hue)' },
  { id: 'YlGnBu', name: 'Yellow-Green-Blue (YlGnBu)', category: 'Sequential (Multi-Hue)' },
  { id: 'YlOrBr', name: 'Yellow-Orange-Brown (YlOrBr)', category: 'Sequential (Multi-Hue)' },
  { id: 'YlOrRd', name: 'Yellow-Orange-Red (YlOrRd)', category: 'Sequential (Multi-Hue)' },

  // Sequential (Single-Hue)
  { id: 'Blues', name: 'Blues', category: 'Sequential (Single-Hue)' },
  { id: 'Greens', name: 'Greens', category: 'Sequential (Single-Hue)' },
  { id: 'Greys', name: 'Greys', category: 'Sequential (Single-Hue)' },
  { id: 'Oranges', name: 'Oranges', category: 'Sequential (Single-Hue)' },
  { id: 'Purples', name: 'Purples', category: 'Sequential (Single-Hue)' },
  { id: 'Reds', name: 'Reds', category: 'Sequential (Single-Hue)' },

  // Diverging
  { id: 'Spectral', name: 'Spectral', category: 'Diverging' },
  { id: 'BrBG', name: 'Brown-BlueGreen (BrBG)', category: 'Diverging' },
  { id: 'PRGn', name: 'Purple-Green (PRGn)', category: 'Diverging' },
  { id: 'PiYG', name: 'Pink-YellowGreen (PiYG)', category: 'Diverging' },
  { id: 'PuOr', name: 'Purple-Orange (PuOr)', category: 'Diverging' },
  { id: 'RdBu', name: 'Red-Blue (RdBu)', category: 'Diverging' },
  { id: 'RdGy', name: 'Red-Grey (RdGy)', category: 'Diverging' },
  { id: 'RdYlBu', name: 'Red-Yellow-Blue (RdYlBu)', category: 'Diverging' },
  { id: 'RdYlGn', name: 'Red-Yellow-Green (RdYlGn)', category: 'Diverging' },

  // Cyclical
  { id: 'Rainbow', name: 'Rainbow', category: 'Cyclical' },
  { id: 'Sinebow', name: 'Sinebow', category: 'Cyclical' },
]

// Parses hex string '#rrggbb' or 'rgb(r, g, b)' into [r, g, b]
export function parseRgbString(str: string): RGB {
  if (str.startsWith('#')) {
    const hex = str.slice(1)
    const num = parseInt(hex, 16)
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
  }
  const match = str.match(/\d+/g)
  if (match && match.length >= 3) {
    return [parseInt(match[0], 10), parseInt(match[1], 10), parseInt(match[2], 10)]
  }
  return [0, 0, 0]
}

// Generate 256-entry RGB lookup table for given palette with optional inversion
export function getPaletteLUT(palette: ColorPalette, invert: boolean = false): Uint8Array {
  const interpolator = D3_INTERPOLATOR_MAP[palette] || d3Chromatic.interpolateViridis
  const lut = new Uint8Array(256 * 3)

  for (let i = 0; i < 256; i++) {
    const rawT = i / 255
    const t = invert ? 1 - rawT : rawT
    const colorStr = interpolator(t)
    const [r, g, b] = parseRgbString(colorStr)

    lut[i * 3 + 0] = r
    lut[i * 3 + 1] = g
    lut[i * 3 + 2] = b
  }

  return lut
}

// Helper to get CSS gradient string for UI legend & combobox preview
export function getPaletteCssGradient(palette: ColorPalette, invert: boolean = false): string {
  const interpolator = D3_INTERPOLATOR_MAP[palette] || d3Chromatic.interpolateViridis
  const stops: string[] = []
  const count = 10

  for (let i = 0; i <= count; i++) {
    const rawT = i / count
    const t = invert ? 1 - rawT : rawT
    stops.push(interpolator(t))
  }

  return `linear-gradient(to right, ${stops.join(', ')})`
}

export interface RenderRasterOptions {
  palette: ColorPalette
  invertPalette?: boolean
  scaleType: ScaleType
  logSigma: number
  minVal: number
  maxVal: number
  breaks?: number[]
  projection?: ProjectionType
  opacity?: number
  activeCountries?: CountryFeature[] | null
}

/**
 * Renders an Equirectangular Float32Array raster into an HTMLCanvasElement.
 *
 * When `activeCountries` is provided (Countries Mode isolation):
 * - Isolates the visible pixels strictly to within the country boundary/boundaries using
 *   native 2D canvas polygon clipping (`destination-in`).
 * - Stretches the visual color ramp to the min and max of those countries.
 */
export function renderRasterToCanvas(
  data: Float32Array,
  srcWidth: number,
  srcHeight: number,
  options: RenderRasterOptions
): { canvas: HTMLCanvasElement; bounds: [number, number, number, number] } {
  const outWidth = srcWidth
  const outHeight = srcHeight

  const canvas = document.createElement('canvas')
  canvas.width = outWidth
  canvas.height = outHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return { canvas, bounds: [-180, -90, 180, 90] }
  }

  const imgData = ctx.createImageData(outWidth, outHeight)
  const pixels32 = new Uint32Array(imgData.data.buffer)
  const totalPixels = outWidth * outHeight
  const lut = getPaletteLUT(options.palette, Boolean(options.invertPalette))

  // Precompute 32-bit packed ABGR color table for 4x faster writes
  const lut32 = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    const r = lut[i * 3]
    const g = lut[i * 3 + 1]
    const b = lut[i * 3 + 2]
    // Little-endian memory layout for Canvas ImageData: 0xAABBGGRR
    lut32[i] = (255 << 24) | (b << 16) | (g << 8) | r
  }

  const hasBreaks = Boolean(options.breaks && options.breaks.length >= 2)
  const sortedBreaks = hasBreaks ? [...options.breaks!].sort((a, b) => a - b) : []
  const numSegments = sortedBreaks.length - 1

  const tMin = transformValue(options.minVal, options.scaleType, options.logSigma)
  const tMax = transformValue(options.maxVal, options.scaleType, options.logSigma)
  const tRange = tMax - tMin || 1
  const invRange = 1 / tRange
  const isLinear = (!options.scaleType || options.scaleType === 'linear') && !hasBreaks

  if (isLinear) {
    // Fast path: linear scale without custom breaks
    for (let i = 0; i < totalPixels; i++) {
      const val = data[i]
      if (Number.isNaN(val) || !Number.isFinite(val)) {
        pixels32[i] = 0
        continue
      }

      let norm = (val - tMin) * invRange
      if (norm < 0) norm = 0
      else if (norm > 1) norm = 1

      const lutIdx = Math.floor(norm * 255)
      pixels32[i] = lut32[lutIdx]
    }
  } else {
    // General path: custom breaks or pseudo-log transformation
    for (let i = 0; i < totalPixels; i++) {
      const val = data[i]
      if (Number.isNaN(val) || !Number.isFinite(val)) {
        pixels32[i] = 0
        continue
      }

      let norm = 0
      if (hasBreaks && numSegments > 0) {
        if (val <= sortedBreaks[0]) {
          norm = 0
        } else if (val >= sortedBreaks[numSegments]) {
          norm = 1
        } else {
          let seg = 0
          while (seg < numSegments - 1 && val >= sortedBreaks[seg + 1]) {
            seg++
          }
          const segMin = sortedBreaks[seg]
          const segMax = sortedBreaks[seg + 1]
          const segT = segMax - segMin > 0 ? (val - segMin) / (segMax - segMin) : 0
          norm = (seg + segT) / numSegments
        }
      } else {
        const tVal = transformValue(val, options.scaleType, options.logSigma)
        norm = (tVal - tMin) * invRange
      }

      if (norm < 0) norm = 0
      else if (norm > 1) norm = 1

      const lutIdx = Math.floor(norm * 255)
      pixels32[i] = lut32[lutIdx]
    }
  }

  ctx.putImageData(imgData, 0, 0)

  // Countries Mode isolation: Mask canvas strictly to active country polygon(s)
  if (options.activeCountries && options.activeCountries.length > 0) {
    ctx.save()
    ctx.globalCompositeOperation = 'destination-in'
    ctx.beginPath()

    for (const country of options.activeCountries) {
      const geometry = country.geometry
      if (!geometry) continue
      const polygons: number[][][][] =
        geometry.type === 'Polygon'
          ? [geometry.coordinates as number[][][]]
          : geometry.type === 'MultiPolygon'
          ? (geometry.coordinates as number[][][][])
          : []

      for (const poly of polygons) {
        for (const ring of poly) {
          for (let i = 0; i < ring.length; i++) {
            const [lng, lat] = ring[i]
            const x = ((lng + 180) / 360) * outWidth
            const y = ((90 - lat) / 180) * outHeight
            if (i === 0) {
              ctx.moveTo(x, y)
            } else {
              ctx.lineTo(x, y)
            }
          }
          ctx.closePath()
        }
      }
    }

    ctx.fillStyle = '#ffffff'
    ctx.fill('evenodd')
    ctx.restore()
  }

  return { canvas, bounds: [-180, -90, 180, 90] }
}
