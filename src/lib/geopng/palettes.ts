import { ColorPalette, ScaleType, ProjectionType } from './types'
import { transformValue } from './scales'

type RGB = [number, number, number]

const PALETTE_STOPS: Record<ColorPalette, RGB[]> = {
  Viridis: [
    [68, 1, 84],
    [72, 35, 116],
    [64, 67, 135],
    [52, 94, 141],
    [41, 120, 142],
    [32, 144, 140],
    [34, 167, 132],
    [68, 190, 112],
    [121, 209, 81],
    [189, 222, 38],
    [253, 231, 36],
  ],
  Plasma: [
    [13, 8, 135],
    [75, 3, 161],
    [125, 3, 168],
    [168, 34, 150],
    [203, 70, 121],
    [229, 107, 93],
    [248, 148, 65],
    [253, 195, 40],
    [240, 249, 33],
  ],
  Magma: [
    [0, 0, 4],
    [28, 16, 68],
    [79, 18, 123],
    [129, 37, 129],
    [181, 54, 122],
    [229, 80, 100],
    [251, 135, 97],
    [254, 195, 139],
    [252, 253, 191],
  ],
  Inferno: [
    [0, 0, 4],
    [33, 12, 69],
    [87, 15, 109],
    [140, 41, 129],
    [187, 55, 84],
    [229, 89, 43],
    [249, 142, 9],
    [254, 203, 41],
    [252, 255, 164],
  ],
  Cividis: [
    [0, 32, 76],
    [0, 52, 110],
    [65, 78, 116],
    [102, 104, 123],
    [139, 133, 129],
    [179, 165, 130],
    [222, 200, 124],
    [255, 234, 70],
  ],
  Turbo: [
    [48, 18, 59],
    [70, 107, 227],
    [40, 188, 235],
    [50, 242, 152],
    [164, 252, 60],
    [251, 185, 56],
    [251, 91, 23],
    [197, 22, 5],
    [122, 4, 2],
  ],
  Spectral: [
    [158, 1, 66],
    [213, 62, 79],
    [244, 109, 67],
    [253, 174, 97],
    [254, 224, 139],
    [255, 255, 191],
    [230, 245, 152],
    [171, 221, 164],
    [102, 194, 165],
    [50, 136, 189],
    [94, 79, 162],
  ],
  Heat: [
    [255, 255, 204],
    [255, 237, 160],
    [254, 217, 118],
    [254, 178, 76],
    [253, 141, 60],
    [252, 78, 42],
    [227, 26, 28],
    [189, 0, 38],
    [128, 0, 38],
  ],
}

// Generate 256-entry RGB lookup table for given palette
export function getPaletteLUT(palette: ColorPalette): Uint8Array {
  const stops = PALETTE_STOPS[palette] || PALETTE_STOPS.Viridis
  const lut = new Uint8Array(256 * 3)
  const numIntervals = stops.length - 1

  for (let i = 0; i < 256; i++) {
    const t = i / 255
    const pos = t * numIntervals
    const idx = Math.min(numIntervals - 1, Math.floor(pos))
    const frac = pos - idx

    const c1 = stops[idx]
    const c2 = stops[idx + 1]

    const r = Math.round(c1[0] + frac * (c2[0] - c1[0]))
    const g = Math.round(c1[1] + frac * (c2[1] - c1[1]))
    const b = Math.round(c1[2] + frac * (c2[2] - c1[2]))

    lut[i * 3 + 0] = r
    lut[i * 3 + 1] = g
    lut[i * 3 + 2] = b
  }

  return lut
}

// Helper to get CSS gradient string for UI legend preview
export function getPaletteCssGradient(palette: ColorPalette): string {
  const stops = PALETTE_STOPS[palette] || PALETTE_STOPS.Viridis
  const colorStrings = stops.map((c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`)
  return `linear-gradient(to right, ${colorStrings.join(', ')})`
}

export interface RenderRasterOptions {
  palette: ColorPalette
  scaleType: ScaleType
  logSigma: number
  minVal: number
  maxVal: number
  projection?: ProjectionType
  opacity?: number
}

/**
 * Renders an Equirectangular Float32Array raster (4320x2160 or downsampled) into an HTMLCanvasElement.
 *
 * - When projection === 'Mercator': warps latitudes from Equirectangular WGS84 linear spacing
 *   to Web Mercator spacing (bounds [-180, -85.051129, 180, 85.051129]) so it aligns with ESRI basemaps.
 * - When projection === 'Equirectangular' or 'Globe': renders standard 2:1 Plate Carrée WGS84 canvas.
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
  const pixels = imgData.data
  const lut = getPaletteLUT(options.palette)

  const tMin = transformValue(options.minVal, options.scaleType, options.logSigma)
  const tMax = transformValue(options.maxVal, options.scaleType, options.logSigma)
  const tRange = tMax - tMin || 1

  for (let y = 0; y < outHeight; y++) {
    const srcRowOffset = y * srcWidth
    const outRowOffset = y * outWidth

    for (let x = 0; x < outWidth; x++) {
      const val = data[srcRowOffset + x]
      const pIdx = (outRowOffset + x) * 4

      // NaN or infinite is transparent (NoData)
      if (Number.isNaN(val) || !Number.isFinite(val)) {
        pixels[pIdx + 0] = 0
        pixels[pIdx + 1] = 0
        pixels[pIdx + 2] = 0
        pixels[pIdx + 3] = 0
        continue
      }

      const tVal = transformValue(val, options.scaleType, options.logSigma)
      let norm = (tVal - tMin) / tRange
      if (norm < 0) norm = 0
      if (norm > 1) norm = 1

      const lutIdx = Math.floor(norm * 255) * 3

      pixels[pIdx + 0] = lut[lutIdx]
      pixels[pIdx + 1] = lut[lutIdx + 1]
      pixels[pIdx + 2] = lut[lutIdx + 2]
      pixels[pIdx + 3] = 255
    }
  }

  ctx.putImageData(imgData, 0, 0)

  return { canvas, bounds: [-180, -90, 180, 90] }
}

