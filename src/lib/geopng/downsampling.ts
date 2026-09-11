import { DecodedRaster, DownsampleMethod } from './types'

export interface DownsampledRasterResult {
  data: Float32Array
  width: number
  height: number
  min: number
  max: number
  mean: number
  validCount: number
}

/**
 * Downsamples a 2D Float32Array raster to (dstW, dstH) using average, minimum, maximum, or nearest neighbor.
 */
export function downsampleRaster(
  srcData: Float32Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  method: DownsampleMethod
): DownsampledRasterResult {
  if (dstW === srcW && dstH === srcH) {
    let min = Infinity
    let max = -Infinity
    let sum = 0
    let validCount = 0
    for (let i = 0; i < srcData.length; i++) {
      const v = srcData[i]
      if (Number.isFinite(v)) {
        if (v < min) min = v
        if (v > max) max = v
        sum += v
        validCount++
      }
    }
    return {
      data: srcData,
      width: srcW,
      height: srcH,
      min: Number.isFinite(min) ? min : 0,
      max: Number.isFinite(max) ? max : 0,
      mean: validCount > 0 ? sum / validCount : 0,
      validCount,
    }
  }

  const dstData = new Float32Array(dstW * dstH)
  const xRatio = srcW / dstW
  const yRatio = srcH / dstH

  let globalMin = Infinity
  let globalMax = -Infinity
  let globalSum = 0
  let globalValid = 0

  for (let dy = 0; dy < dstH; dy++) {
    const dstRowOffset = dy * dstW

    if (method === 'near') {
      const sy = Math.min(srcH - 1, Math.floor((dy + 0.5) * yRatio))
      const srcRowOffset = sy * srcW

      for (let dx = 0; dx < dstW; dx++) {
        const sx = Math.min(srcW - 1, Math.floor((dx + 0.5) * xRatio))
        const val = srcData[srcRowOffset + sx]
        dstData[dstRowOffset + dx] = val

        if (Number.isFinite(val)) {
          if (val < globalMin) globalMin = val
          if (val > globalMax) globalMax = val
          globalSum += val
          globalValid++
        }
      }
      continue
    }

    const sy0 = Math.floor(dy * yRatio)
    const sy1 = Math.min(srcH - 1, Math.max(sy0, Math.floor((dy + 1) * yRatio - 1e-6)))

    for (let dx = 0; dx < dstW; dx++) {
      const sx0 = Math.floor(dx * xRatio)
      const sx1 = Math.min(srcW - 1, Math.max(sx0, Math.floor((dx + 1) * xRatio - 1e-6)))

      let sum = 0
      let count = 0
      let min = Infinity
      let max = -Infinity

      for (let sy = sy0; sy <= sy1; sy++) {
        const rowOffset = sy * srcW
        for (let sx = sx0; sx <= sx1; sx++) {
          const v = srcData[rowOffset + sx]
          if (Number.isFinite(v)) {
            sum += v
            count++
            if (v < min) min = v
            if (v > max) max = v
          }
        }
      }

      let val: number
      if (count === 0) {
        val = NaN
      } else if (method === 'average') {
        val = sum / count
      } else if (method === 'minimum') {
        val = min
      } else if (method === 'maximum') {
        val = max
      } else {
        val = srcData[sy0 * srcW + sx0]
      }

      dstData[dstRowOffset + dx] = val

      if (Number.isFinite(val)) {
        if (val < globalMin) globalMin = val
        if (val > globalMax) globalMax = val
        globalSum += val
        globalValid++
      }
    }
  }

  return {
    data: dstData,
    width: dstW,
    height: dstH,
    min: Number.isFinite(globalMin) ? globalMin : 0,
    max: Number.isFinite(globalMax) ? globalMax : 0,
    mean: globalValid > 0 ? globalSum / globalValid : 0,
    validCount: globalValid,
  }
}

/**
 * Creates a new DecodedRaster with downsampling applied according to target dimensions and method.
 */
export function createBinnedRaster(
  raster: DecodedRaster,
  targetWidth: number,
  targetHeight: number,
  method: DownsampleMethod
): DecodedRaster {
  if (targetWidth === raster.width && targetHeight === raster.height) {
    return raster
  }

  const res = downsampleRaster(
    raster.data,
    raster.width,
    raster.height,
    targetWidth,
    targetHeight,
    method
  )

  return {
    data: res.data,
    width: res.width,
    height: res.height,
    bounds: raster.bounds,
    min: res.min,
    max: res.max,
    mean: res.mean,
    stdDev: raster.stdDev,
    validCount: res.validCount,
    totalCells: res.width * res.height,
    histogram: raster.histogram,
    quantiles: raster.quantiles,
  }
}
