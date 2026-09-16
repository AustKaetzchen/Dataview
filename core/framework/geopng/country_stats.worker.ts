import { binRasterByMultipleCountries, CountryFeature, CountryStats } from './polygon_binning.ts'
import { DecodedRaster } from './types.ts'

export type WorkerInMessage =
  | {
      bounds?: [number, number, number, number]
      data: Float32Array
      height: number
      max: number
      min: number
      type: 'SET_RASTER'
      width: number
    }
  | {
      features: CountryFeature[]
      reqId: number
      type: 'CALCULATE_COUNTRY_STATS'
    }

export type WorkerOutMessage =
  | {
      reqId: number
      stats: CountryStats | null
      type: 'COUNTRY_STATS_RESULT'
    }
  | {
      error: string
      reqId: number
      type: 'COUNTRY_STATS_ERROR'
    }

let current_raster: DecodedRaster | null = null

self.onmessage = function (arg0_e: MessageEvent<WorkerInMessage>) {
  //Convert from parameters
  let e = arg0_e

  //Declare local instance variables
  let msg = e.data

  //Guard clauses
  if (!msg)
    return

  //Function body
  if (msg.type === 'SET_RASTER') {
    current_raster = {
      bounds: msg.bounds || [-180, -90, 180, 90],
      data: msg.data,
      height: msg.height,
      max: msg.max,
      mean: 0,
      min: msg.min,
      stdDev: 0,
      totalCells: msg.width*msg.height,
      validCount: 0,
      width: msg.width,
    }
    return
  }

  if (msg.type === 'CALCULATE_COUNTRY_STATS') {
    let { features, reqId: req_id } = msg
    if (!current_raster || !features || features.length === 0) {
      self.postMessage({
        reqId: req_id,
        stats: null,
        type: 'COUNTRY_STATS_RESULT',
      } as WorkerOutMessage)
      return
    }

    try {
      let stats = binRasterByMultipleCountries(current_raster, features)
      self.postMessage({
        reqId: req_id,
        stats,
        type: 'COUNTRY_STATS_RESULT',
      } as WorkerOutMessage)
    } catch (arg0_err) {
      self.postMessage({
        error: arg0_err instanceof Error ? arg0_err.message : String(arg0_err),
        reqId: req_id,
        type: 'COUNTRY_STATS_ERROR',
      } as WorkerOutMessage)
    }
  }
}
