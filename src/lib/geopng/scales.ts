import { ScaleType, DecodedRaster } from './types'

/**
 * Computes quantiles for given probabilities using strided subsampling.
 *
 * @param {Float32Array} arg0_values
 * @param {number[]} arg1_probabilities
 *
 * @returns {number[]}
 */
export function computeQuantiles (arg0_values: Float32Array, arg1_probabilities: number[]): number[] {
  //Convert from parameters
  let probabilities = arg1_probabilities
  let values = arg0_values

  //Declare local instance variables
  let sample: number[] = []
  let step = Math.max(1, Math.floor(values.length/50000))

  //Function body
  for (let i = 0; i < values.length; i += step) {
    let v = values[i]
    if (!Number.isNaN(v) && Number.isFinite(v))
      sample.push(v)
  }

  //Guard clauses
  if (sample.length === 0)
    return probabilities.map(() => 0)

  sample.sort((arg0_a, arg0_b) => arg0_a - arg0_b)

  //Return statement
  return probabilities.map((arg0_p) => {
    let clamped_p = Math.max(0, Math.min(1, arg0_p))
    let index = Math.min(sample.length - 1, Math.floor(clamped_p*(sample.length - 1)))
    return sample[index]
  })
}

/**
 * Creates an empirical cumulative distribution function (ECDF) lookup.
 *
 * @param {DecodedRaster | null} arg0_raster
 * @param {{ bins: number[]; counts: number[]; min: number; max: number } | null} [arg1_histogram_override]
 *
 * @returns {(arg0_val: number) => number}
 */
export function createPercentileRankCalculator (
  arg0_raster: DecodedRaster | null,
  arg1_histogram_override?: { bins: number[]; counts: number[]; min: number; max: number } | null
): (arg0_val: number) => number {
  //Convert from parameters
  let histogram_override = arg1_histogram_override
  let raster = arg0_raster

  //Declare local instance variables
  let cdf: number[]
  let hist = histogram_override || raster?.histogram
  let max_iter: number
  let n_bins: number
  let sum = 0
  let total: number

  //Guard clauses
  if (!hist || !hist.bins || hist.bins.length === 0 || !hist.counts || hist.counts.length === 0) {
    let min = raster?.min ?? 0
    let max = raster?.max ?? 1
    let range = max - min || 1
    return (arg0_val: number) => Math.max(0, Math.min(1, (arg0_val - min)/range))
  }

  //Function body
  let { bins, counts } = hist
  n_bins = counts.length
  cdf = new Array(n_bins)

  for (let i = 0; i < n_bins; i++) {
    sum += counts[i]
    cdf[i] = sum
  }
  total = sum || 1
  max_iter = Math.ceil(Math.log2(n_bins + 1)) + 2

  //Return statement
  return (arg0_val: number): number => {
    let val = arg0_val

    if (Number.isNaN(val) || !Number.isFinite(val))
      return 0
    if (val <= bins[0])
      return 0
    if (val >= bins[bins.length - 1])
      return 1

    let high = n_bins - 1
    let low = 0

    for (let i = 0; i < max_iter && low <= high; i++) {
      let mid = (low + high) >> 1
      if (bins[mid] <= val) {
        low = mid + 1
      } else {
        high = mid - 1
      }
    }
    let idx = Math.max(0, Math.min(n_bins - 1, high))

    let bin_max = bins[idx + 1] ?? (hist?.max ?? bins[idx])
    let bin_min = bins[idx]
    let bin_span = bin_max - bin_min
    let curr_cdf = cdf[idx]
    let frac = bin_span > 0 ? Math.max(0, Math.min(1, (val - bin_min)/bin_span)) : 0
    let prev_cdf = idx > 0 ? cdf[idx - 1] : 0
    let interpolated_count = prev_cdf + frac*(curr_cdf - prev_cdf)

    return Math.max(0, Math.min(1, interpolated_count/total))
  }
}

/**
 * Inverse pseudo-log transform.
 *
 * @param {number} arg0_y
 * @param {number} arg1_sigma
 *
 * @returns {number}
 */
export function inversePseudoLogTransform (arg0_y: number, arg1_sigma: number): number {
  //Convert from parameters
  let sigma = arg1_sigma
  let y = arg0_y

  //Guard clauses
  if (Number.isNaN(y))
    return Number.NaN

  //Declare local instance variables
  let s = Math.max(0.0001, sigma)

  //Return statement
  return 2*s*Math.sinh(y*Math.LN10)
}

/**
 * Apply inverse transform based on scale type.
 *
 * @param {number} arg0_val
 * @param {ScaleType} arg1_scale_type
 * @param {number} [arg2_sigma=1]
 *
 * @returns {number}
 */
export function inverseTransformValue (arg0_val: number, arg1_scale_type: ScaleType, arg2_sigma?: number): number {
  //Convert from parameters
  let scale_type = arg1_scale_type
  let sigma = (arg2_sigma !== undefined) ? arg2_sigma : 1
  let val = arg0_val

  //Guard clauses
  if (scale_type === 'pseudo-log')
    return inversePseudoLogTransform(val, sigma)

  //Return statement
  return val
}

/**
 * Pseudo-log transform matching R scales::pseudo_log_trans(sigma).
 *
 * @param {number} arg0_x
 * @param {number} arg1_sigma
 *
 * @returns {number}
 */
export function pseudoLogTransform (arg0_x: number, arg1_sigma: number): number {
  //Convert from parameters
  let sigma = arg1_sigma
  let x = arg0_x

  //Guard clauses
  if (Number.isNaN(x))
    return Number.NaN

  //Declare local instance variables
  let s = Math.max(0.0001, sigma)

  //Return statement
  return Math.asinh(x/(2*s))/Math.LN10
}

/**
 * Apply forward transform based on scale type.
 *
 * @param {number} arg0_val
 * @param {ScaleType} arg1_scale_type
 * @param {number} [arg2_sigma=1]
 *
 * @returns {number}
 */
export function transformValue (arg0_val: number, arg1_scale_type: ScaleType, arg2_sigma?: number): number {
  //Convert from parameters
  let scale_type = arg1_scale_type
  let sigma = (arg2_sigma !== undefined) ? arg2_sigma : 1
  let val = arg0_val

  //Guard clauses
  if (scale_type === 'pseudo-log')
    return pseudoLogTransform(val, sigma)

  //Return statement
  return val
}
