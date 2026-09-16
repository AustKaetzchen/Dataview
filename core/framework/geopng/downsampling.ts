import { DecodedRaster, DownsampleMethod } from './types.ts'

export interface DownsampledRasterResult {
  data: Float32Array
  height: number
  max: number
  mean: number
  min: number
  validCount: number
  width: number
}

/**
 * Creates a new DecodedRaster with downsampling applied according to target dimensions and method.
 *
 * @param {DecodedRaster} arg0_raster
 * @param {number} arg1_target_width
 * @param {number} arg2_target_height
 * @param {DownsampleMethod} arg3_method
 *
 * @returns {DecodedRaster}
 */
export function createBinnedRaster (
  arg0_raster: DecodedRaster,
  arg1_target_width: number,
  arg2_target_height: number,
  arg3_method: DownsampleMethod
): DecodedRaster {
  //Convert from parameters
  let method = arg3_method
  let raster = arg0_raster
  let target_height = arg2_target_height
  let target_width = arg1_target_width

  //Guard clauses
  if (target_width === raster.width && target_height === raster.height)
    return raster

  //Declare local instance variables
  let res: DownsampledRasterResult

  //Function body
  res = downsampleRaster(
    raster.data,
    raster.width,
    raster.height,
    target_width,
    target_height,
    method
  )

  //Return statement
  return {
    bounds: raster.bounds,
    data: res.data,
    height: res.height,
    histogram: raster.histogram,
    max: res.max,
    mean: res.mean,
    min: res.min,
    quantiles: raster.quantiles,
    stdDev: raster.stdDev,
    totalCells: res.width*res.height,
    validCount: res.validCount,
    width: res.width,
  }
}

/**
 * Downsamples a 2D Float32Array raster to (dstW, dstH) using average, minimum, maximum, or nearest neighbour.
 *
 * @param {Float32Array} arg0_src_data
 * @param {number} arg1_src_w
 * @param {number} arg2_src_h
 * @param {number} arg3_dst_w
 * @param {number} arg4_dst_h
 * @param {DownsampleMethod} arg5_method
 *
 * @returns {DownsampledRasterResult}
 */
export function downsampleRaster (
  arg0_src_data: Float32Array,
  arg1_src_w: number,
  arg2_src_h: number,
  arg3_dst_w: number,
  arg4_dst_h: number,
  arg5_method: DownsampleMethod
): DownsampledRasterResult {
  //Convert from parameters
  let dst_h = arg4_dst_h
  let dst_w = arg3_dst_w
  let method = arg5_method
  let src_data = arg0_src_data
  let src_h = arg2_src_h
  let src_w = arg1_src_w

  //Guard clauses
  if (dst_w === src_w && dst_h === src_h) {
    let max = -Infinity
    let min = Infinity
    let sum = 0
    let valid_count = 0
    for (let i = 0; i < src_data.length; i++) {
      let v = src_data[i]
      if (Number.isFinite(v)) {
        if (v < min)
          min = v
        if (v > max)
          max = v
        sum += v
        valid_count++
      }
    }
    return {
      data: src_data,
      height: src_h,
      max: Number.isFinite(max) ? max : 0,
      mean: valid_count > 0 ? sum/valid_count : 0,
      min: Number.isFinite(min) ? min : 0,
      validCount: valid_count,
      width: src_w,
    }
  }

  //Declare local instance variables
  let dst_data = new Float32Array(dst_w*dst_h)
  let global_max = -Infinity
  let global_min = Infinity
  let global_sum = 0
  let global_valid = 0
  let x_ratio = src_w/dst_w
  let y_ratio = src_h/dst_h

  //Function body
  for (let i = 0; i < dst_h; i++) {
    let dst_row_offset = i*dst_w

    if (method === 'near') {
      let sy = Math.min(src_h - 1, Math.floor((i + 0.5)*y_ratio))
      let src_row_offset = sy*src_w

      for (let x = 0; x < dst_w; x++) {
        let sx = Math.min(src_w - 1, Math.floor((x + 0.5)*x_ratio))
        let val = src_data[src_row_offset + sx]
        dst_data[dst_row_offset + x] = val

        if (Number.isFinite(val)) {
          if (val < global_min)
            global_min = val
          if (val > global_max)
            global_max = val
          global_sum += val
          global_valid++
        }
      }
      continue
    }

    let sy0 = Math.floor(i*y_ratio)
    let sy1 = Math.min(src_h - 1, Math.max(sy0, Math.floor((i + 1)*y_ratio - 1e-6)))

    for (let x = 0; x < dst_w; x++) {
      let count = 0
      let max = -Infinity
      let min = Infinity
      let sum = 0
      let sx0 = Math.floor(x*x_ratio)
      let sx1 = Math.min(src_w - 1, Math.max(sx0, Math.floor((x + 1)*x_ratio - 1e-6)))

      for (let y = sy0; y <= sy1; y++) {
        let row_offset = y*src_w
        for (let z = sx0; z <= sx1; z++) {
          let v = src_data[row_offset + z]
          if (Number.isFinite(v)) {
            sum += v
            count++
            if (v < min)
              min = v
            if (v > max)
              max = v
          }
        }
      }

      let val: number
      if (count === 0) {
        val = NaN
      } else if (method === 'average') {
        val = sum/count
      } else if (method === 'minimum') {
        val = min
      } else if (method === 'maximum') {
        val = max
      } else {
        val = src_data[sy0*src_w + sx0]
      }

      dst_data[dst_row_offset + x] = val

      if (Number.isFinite(val)) {
        if (val < global_min)
          global_min = val
        if (val > global_max)
          global_max = val
        global_sum += val
        global_valid++
      }
    }
  }

  //Return statement
  return {
    data: dst_data,
    height: dst_h,
    max: Number.isFinite(global_max) ? global_max : 0,
    mean: global_valid > 0 ? global_sum/global_valid : 0,
    min: Number.isFinite(global_min) ? global_min : 0,
    validCount: global_valid,
    width: dst_w,
  }
}
