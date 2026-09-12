import { decode as decodePng } from 'fast-png'
import { DataFormat, DecodedRaster } from './types'

// Shared 4-byte buffer and DataView matching user specification
const sharedFloatBuffer = new ArrayBuffer(4)
const sharedView = new DataView(sharedFloatBuffer)

/**
 * Decodes an RGBA pixel array [r, g, b, a] to a number.
 * Matching the exact UF/Colour utility function.
 */
export function decodeRGBAAsNumber(
  rgba: [number, number, number, number] | Uint8Array | number[],
  options?: { format?: DataFormat }
): number {
  const format = options?.format || 'int32'

  if (format === 'float32') {
    sharedView.setUint8(0, rgba[0])
    sharedView.setUint8(1, rgba[1])
    sharedView.setUint8(2, rgba[2])
    sharedView.setUint8(3, rgba[3])

    const floatValue = sharedView.getFloat32(0, false)
    if (Number.isNaN(floatValue)) return 0
    return floatValue
  }

  const r = rgba[0]
  const g = rgba[1]
  const b = rgba[2]
  const a = rgba[3]

  return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0
}

/**
 * Decodes a raw PNG buffer directly into a Float32Array raster matrix using fast-png.
 * Bypasses HTML5 2D Canvas completely to prevent browser alpha pre-multiplication
 * and sRGB color profile corruption.
 */
export function decodeRawGeoPngBuffer(
  buffer: ArrayBuffer | Uint8Array,
  format: DataFormat
): DecodedRaster {
  const uint8Input =
    buffer instanceof Uint8Array
      ? buffer
      : new Uint8Array(buffer)

  // Pure JS PNG decoder: extracts uncompressed raw bytes without touching DOM canvas
  const png = decodePng(uint8Input)
  const width = png.width
  const height = png.height
  const totalCells = width * height
  const pixelBytes = png.data
  const channels = png.channels || 4

  const output = new Float32Array(totalCells)
  let min = Infinity
  let max = -Infinity
  let sum = 0
  let validCount = 0

  // Check if we can use fast 32-bit typed array path (RGBA 4-channel, 4-byte aligned on little-endian CPU)
  const isLittleEndian = new Uint8Array(new Uint32Array([0x12345678]).buffer)[0] === 0x78
  const canUseFastU32 = channels === 4 && pixelBytes.byteOffset % 4 === 0 && isLittleEndian

  if (canUseFastU32) {
    const srcU32 = new Uint32Array(pixelBytes.buffer, pixelBytes.byteOffset, totalCells)
    const outputU32 = new Uint32Array(output.buffer)

    if (format === 'float32') {
      for (let i = 0; i < totalCells; i++) {
        const raw = srcU32[i]
        if (raw === 0) {
          output[i] = Number.NaN
          continue
        }
        // Big-endian IEEE 754 float32 byte-swapped into shared Float32Array buffer
        outputU32[i] = ((raw & 0xff) << 24) | ((raw & 0xff00) << 8) | ((raw >>> 8) & 0xff00) | (raw >>> 24)
        const val = output[i]

        if (!Number.isNaN(val) && val !== 0 && Number.isFinite(val)) {
          if (val < min) min = val
          if (val > max) max = val
          sum += val
          validCount++
        } else {
          output[i] = Number.NaN
        }
      }
    } else {
      // Signed 32-bit integer
      for (let i = 0; i < totalCells; i++) {
        const raw = srcU32[i]
        if (raw === 0) {
          output[i] = Number.NaN
          continue
        }
        const swapped = ((raw & 0xff) << 24) | ((raw & 0xff00) << 8) | ((raw >>> 8) & 0xff00) | (raw >>> 24)
        const val = swapped | 0
        if (val === 0) {
          output[i] = Number.NaN
        } else {
          output[i] = val
          if (val < min) min = val
          if (val > max) max = val
          sum += val
          validCount++
        }
      }
    }
  } else {
    // Pixel iteration using DataView or sharedView
    const dv = new DataView(pixelBytes.buffer, pixelBytes.byteOffset, pixelBytes.byteLength)

    for (let i = 0; i < totalCells; i++) {
      const byteOffset = i * channels
      let val: number

      if (channels >= 4) {
        if (format === 'float32') {
          // Read big-endian IEEE 754 32-bit float directly
          val = dv.getFloat32(byteOffset, false)
          // NaN or exact 0 is treated as NoData (matching R: let_r[let_r == 0] = NA)
          if (Number.isNaN(val) || val === 0) {
            val = Number.NaN
          }
        } else {
          const r = pixelBytes[byteOffset]
          const g = pixelBytes[byteOffset + 1]
          const b = pixelBytes[byteOffset + 2]
          const a = pixelBytes[byteOffset + 3]
          val = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0
          if (val === 0) {
            val = Number.NaN
          }
        }
      } else if (channels === 3) {
        const r = pixelBytes[byteOffset]
        const g = pixelBytes[byteOffset + 1]
        const b = pixelBytes[byteOffset + 2]
        if (format === 'float32') {
          sharedView.setUint8(0, r)
          sharedView.setUint8(1, g)
          sharedView.setUint8(2, b)
          sharedView.setUint8(3, 0)
          val = sharedView.getFloat32(0, false)
          if (Number.isNaN(val) || val === 0) val = Number.NaN
        } else {
          val = ((r << 16) | (g << 8) | b) >>> 0
          if (val === 0) val = Number.NaN
        }
      } else {
        // 1 channel (grayscale)
        val = pixelBytes[byteOffset]
        if (val === 0) val = Number.NaN
      }

      output[i] = val

      if (!Number.isNaN(val) && Number.isFinite(val)) {
        if (val < min) min = val
        if (val > max) max = val
        sum += val
        validCount++
      }
    }
  }

  const mean = validCount > 0 ? sum / validCount : 0

  // Standard deviation (sample up to 100,000 cells)
  let varianceSum = 0
  if (validCount > 1) {
    const sampleStep = Math.max(1, Math.floor(totalCells / 100000))
    let sampleValid = 0
    for (let i = 0; i < totalCells; i += sampleStep) {
      const v = output[i]
      if (!Number.isNaN(v) && Number.isFinite(v)) {
        varianceSum += (v - mean) ** 2
        sampleValid++
      }
    }
    const stdDev = sampleValid > 1 ? Math.sqrt(varianceSum / (sampleValid - 1)) : 0
    return buildDecodedRasterResult(output, width, height, min, max, mean, stdDev, validCount, totalCells)
  }

  return buildDecodedRasterResult(output, width, height, min, max, mean, 0, validCount, totalCells)
}

function buildDecodedRasterResult(
  output: Float32Array,
  width: number,
  height: number,
  min: number,
  max: number,
  mean: number,
  stdDev: number,
  validCount: number,
  totalCells: number
): DecodedRaster {
  const safeMin = Number.isFinite(min) ? min : 0
  const safeMax = Number.isFinite(max) ? max : 1

  // Compute histogram and quantiles (sample directly with step for O(sample) complexity)
  const sampleValues: number[] = []
  const step = Math.max(1, Math.floor(totalCells / 50000))

  for (let i = 0; i < totalCells; i += step) {
    const v = output[i]
    if (!Number.isNaN(v) && Number.isFinite(v)) {
      sampleValues.push(v)
    }
  }

  sampleValues.sort((a, b) => a - b)

  const quantiles: Record<number, number> = {}
  if (sampleValues.length > 0) {
    const pKeys = [0, 5, 10, 25, 50, 75, 90, 95, 100]
    for (const p of pKeys) {
      const idx = Math.min(
        sampleValues.length - 1,
        Math.max(0, Math.floor((p / 100) * (sampleValues.length - 1)))
      )
      quantiles[p] = sampleValues[idx]
    }
  }

  // 60-bin histogram
  const binCount = 60
  const binEdges: number[] = []
  const binCounts: number[] = new Array(binCount).fill(0)
  const binWidth = (safeMax - safeMin) / binCount || 1

  for (let b = 0; b <= binCount; b++) {
    binEdges.push(safeMin + b * binWidth)
  }

  for (let i = 0; i < sampleValues.length; i++) {
    const v = sampleValues[i]
    let bIdx = Math.floor((v - safeMin) / binWidth)
    if (bIdx < 0) bIdx = 0
    if (bIdx >= binCount) bIdx = binCount - 1
    binCounts[bIdx]++
  }

  return {
    data: output,
    width,
    height,
    bounds: [-180, -90, 180, 90], // Global EPSG:4326 extent
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
    mean,
    stdDev,
    validCount,
    totalCells,
    total: validCount > 0 ? mean * validCount : 0,
    quantiles,
    histogram: {
      bins: binEdges,
      counts: binCounts,
      min: safeMin,
      max: safeMax,
    },
  }
}

let decoderWorker: Worker | null = null
let nextDecoderReqId = 1
const pendingDecoderRequests = new Map<
  number,
  { resolve: (r: DecodedRaster) => void; reject: (err: any) => void }
>()

function getDecoderWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null
  if (!decoderWorker) {
    try {
      decoderWorker = new Worker(new URL('./pngDecoder.worker.ts', import.meta.url), {
        type: 'module',
      })
      decoderWorker.onmessage = (e: MessageEvent<any>) => {
        const msg = e.data
        if (!msg) return
        const handlers = pendingDecoderRequests.get(msg.reqId)
        if (!handlers) return
        pendingDecoderRequests.delete(msg.reqId)
        if (msg.type === 'PNG_DECODE_SUCCESS') {
          handlers.resolve(msg.raster)
        } else {
          handlers.reject(new Error(msg.error || 'Worker decoding failed'))
        }
      }
      decoderWorker.onerror = (err) => {
        console.warn('PNG decoder worker error, will fall back to sync:', err)
      }
    } catch (err) {
      console.warn('Could not spawn PNG decoder worker:', err)
      return null
    }
  }
  return decoderWorker
}

/**
 * Decodes a raw PNG buffer asynchronously in a background Web Worker with zero-copy buffer transfer.
 * Falls back to optimized synchronous main-thread decoding if worker is unavailable.
 */
export async function decodeRawGeoPngBufferAsync(
  buffer: ArrayBuffer | Uint8Array,
  format: DataFormat
): Promise<DecodedRaster> {
  const worker = getDecoderWorker()

  if (worker) {
    const arrayBuf =
      buffer instanceof Uint8Array
        ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        : buffer.slice(0)

    const reqId = nextDecoderReqId++
    return new Promise<DecodedRaster>((resolve, reject) => {
      pendingDecoderRequests.set(reqId, { resolve, reject })
      try {
        worker.postMessage({ reqId, buffer: arrayBuf, format }, [arrayBuf])
      } catch {
        worker.postMessage({ reqId, buffer: arrayBuf, format })
      }
    }).catch((err) => {
      console.warn('Worker decoding failed, falling back to sync:', err)
      return decodeRawGeoPngBuffer(buffer, format)
    })
  }

  return decodeRawGeoPngBuffer(buffer, format)
}

/**
 * Loads a GeoPNG from File or URL using pure fast-png (zero canvas pre-multiplication).
 */
export async function loadAndDecodeGeoPng(
  source: File | string | ArrayBuffer,
  format: DataFormat
): Promise<DecodedRaster> {
  let buffer: ArrayBuffer

  if (source instanceof File) {
    buffer = await source.arrayBuffer()
  } else if (typeof source === 'string') {
    const response = await fetch(source)
    buffer = await response.arrayBuffer()
  } else {
    buffer = source
  }

  return decodeRawGeoPngBufferAsync(buffer, format)
}

/**
 * Computes difference (Raster A - Raster B), resampling B to A if dimensions differ.
 */
export function computeRasterDifference(rasterA: DecodedRaster, rasterB: DecodedRaster): DecodedRaster {
  const width = rasterA.width
  const height = rasterA.height
  const totalCells = width * height
  const diffData = new Float32Array(totalCells)

  let min = Infinity
  let max = -Infinity
  let sum = 0
  let validCount = 0

  const bWidth = rasterB.width
  const bHeight = rasterB.height

  for (let y = 0; y < height; y++) {
    const bY = Math.min(bHeight - 1, Math.floor((y / height) * bHeight))
    for (let x = 0; x < width; x++) {
      const idxA = y * width + x
      const valA = rasterA.data[idxA]

      const bX = Math.min(bWidth - 1, Math.floor((x / width) * bWidth))
      const idxB = bY * bWidth + bX
      const valB = rasterB.data[idxB]

      if (Number.isNaN(valA) || Number.isNaN(valB)) {
        diffData[idxA] = Number.NaN
      } else {
        const diff = valA - valB
        diffData[idxA] = diff
        if (!Number.isNaN(diff) && Number.isFinite(diff)) {
          if (diff < min) min = diff
          if (diff > max) max = diff
          sum += diff
          validCount++
        }
      }
    }
  }

  const mean = validCount > 0 ? sum / validCount : 0

  return {
    data: diffData,
    width,
    height,
    bounds: [-180, -90, 180, 90],
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
    mean,
    stdDev: 0,
    validCount,
    totalCells,
  }
}
