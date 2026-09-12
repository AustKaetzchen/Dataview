import { binRasterByMultipleCountries, CountryFeature, CountryStats } from './polygonBinning'
import { DecodedRaster } from './types'

export type WorkerInMessage =
  | {
      type: 'SET_RASTER'
      data: Float32Array
      width: number
      height: number
      min: number
      max: number
      bounds?: [number, number, number, number]
    }
  | {
      type: 'CALCULATE_COUNTRY_STATS'
      reqId: number
      features: CountryFeature[]
    }

export type WorkerOutMessage =
  | {
      type: 'COUNTRY_STATS_RESULT'
      reqId: number
      stats: CountryStats | null
    }
  | {
      type: 'COUNTRY_STATS_ERROR'
      reqId: number
      error: string
    }

let currentRaster: DecodedRaster | null = null

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data
  if (!msg) return

  if (msg.type === 'SET_RASTER') {
    currentRaster = {
      data: msg.data,
      width: msg.width,
      height: msg.height,
      min: msg.min,
      max: msg.max,
      bounds: msg.bounds || [-180, -90, 180, 90],
      mean: 0,
      stdDev: 0,
      validCount: 0,
      totalCells: msg.width * msg.height,
    }
    return
  }

  if (msg.type === 'CALCULATE_COUNTRY_STATS') {
    const { reqId, features } = msg
    if (!currentRaster || !features || features.length === 0) {
      self.postMessage({
        type: 'COUNTRY_STATS_RESULT',
        reqId,
        stats: null,
      } as WorkerOutMessage)
      return
    }

    try {
      const stats = binRasterByMultipleCountries(currentRaster, features)
      self.postMessage({
        type: 'COUNTRY_STATS_RESULT',
        reqId,
        stats,
      } as WorkerOutMessage)
    } catch (err) {
      self.postMessage({
        type: 'COUNTRY_STATS_ERROR',
        reqId,
        error: err instanceof Error ? err.message : String(err),
      } as WorkerOutMessage)
    }
  }
}
