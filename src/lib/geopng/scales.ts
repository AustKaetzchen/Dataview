import { ScaleType, DecodedRaster } from './types'

/**
 * Creates an empirical cumulative distribution function (ECDF) lookup
 * to determine the percentile rank (0.0 to 1.0) of any value.
 * Uses the histogram (bins & counts) for fast estimation with linear interpolation.
 */
export function createPercentileRankCalculator(
  raster: DecodedRaster | null,
  histogramOverride?: { bins: number[]; counts: number[]; min: number; max: number } | null
): (val: number) => number {
  const hist = histogramOverride || raster?.histogram
  if (!hist || !hist.bins || hist.bins.length === 0 || !hist.counts || hist.counts.length === 0) {
    const min = raster?.min ?? 0
    const max = raster?.max ?? 1
    const range = max - min || 1
    return (val: number) => Math.max(0, Math.min(1, (val - min) / range))
  }

  const { bins, counts } = hist
  const nBins = counts.length

  // Compute prefix sums of counts
  const cdf: number[] = new Array(nBins)
  let sum = 0
  for (let i = 0; i < nBins; i++) {
    sum += counts[i]
    cdf[i] = sum
  }
  const total = sum || 1

  return (val: number): number => {
    if (Number.isNaN(val) || !Number.isFinite(val)) return 0
    if (val <= bins[0]) return 0
    if (val >= bins[bins.length - 1]) return 1

    // Binary search for bin index where bins[idx] <= val < bins[idx + 1]
    let low = 0
    let high = nBins - 1
    while (low <= high) {
      const mid = (low + high) >> 1
      if (bins[mid] <= val) {
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    const idx = Math.max(0, Math.min(nBins - 1, high))

    // Linear interpolation within the bin for smooth percentile calculation
    const prevCdf = idx > 0 ? cdf[idx - 1] : 0
    const currCdf = cdf[idx]
    const binMin = bins[idx]
    const binMax = bins[idx + 1] ?? (hist.max ?? binMin)
    const binSpan = binMax - binMin
    const frac = binSpan > 0 ? Math.max(0, Math.min(1, (val - binMin) / binSpan)) : 0
    const interpolatedCount = prevCdf + frac * (currCdf - prevCdf)

    return Math.max(0, Math.min(1, interpolatedCount / total))
  }
}


/**
 * Pseudo-log transform matching R scales::pseudo_log_trans(sigma)
 * f(x) = asinh(x / (2 * sigma)) / ln(10)
 */
export function pseudoLogTransform(x: number, sigma: number): number {
  if (Number.isNaN(x)) return Number.NaN
  const s = Math.max(0.0001, sigma)
  return Math.asinh(x / (2 * s)) / Math.LN10
}

/**
 * Inverse pseudo-log transform
 * f^-1(y) = 2 * sigma * sinh(y * ln(10))
 */
export function inversePseudoLogTransform(y: number, sigma: number): number {
  if (Number.isNaN(y)) return Number.NaN
  const s = Math.max(0.0001, sigma)
  return 2 * s * Math.sinh(y * Math.LN10)
}

/**
 * Apply forward transform based on scale type
 */
export function transformValue(val: number, scaleType: ScaleType, sigma: number = 1): number {
  if (scaleType === 'pseudo-log') {
    return pseudoLogTransform(val, sigma)
  }
  return val
}

/**
 * Apply inverse transform based on scale type
 */
export function inverseTransformValue(val: number, scaleType: ScaleType, sigma: number = 1): number {
  if (scaleType === 'pseudo-log') {
    return inversePseudoLogTransform(val, sigma)
  }
  return val
}

/**
 * Computes quantiles for given probabilities
 */
export function computeQuantiles(values: Float32Array, probabilities: number[]): number[] {
  // Sample up to 50,000 cells for fast quantile computation
  const step = Math.max(1, Math.floor(values.length / 50000))
  const sample: number[] = []

  for (let i = 0; i < values.length; i += step) {
    const v = values[i]
    if (!Number.isNaN(v) && Number.isFinite(v)) {
      sample.push(v)
    }
  }

  if (sample.length === 0) return probabilities.map(() => 0)

  sample.sort((a, b) => a - b)

  return probabilities.map((p) => {
    const clampedP = Math.max(0, Math.min(1, p))
    const index = Math.min(sample.length - 1, Math.floor(clampedP * (sample.length - 1)))
    return sample[index]
  })
}


