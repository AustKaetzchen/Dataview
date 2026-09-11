import { ScaleType } from './types'

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


