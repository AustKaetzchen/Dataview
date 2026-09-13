import { useState, useEffect, useRef } from 'react'
import { DecodedRaster } from './types'
import { CountryFeature, CountryStats, binRasterByMultipleCountries } from './polygonBinning'
import type { WorkerInMessage, WorkerOutMessage } from './countryStats.worker'

export interface UseCountryStatsAsyncOptions {
  activeCountries: CountryFeature[]
  activeRaster: DecodedRaster | null
  isHoverOnly?: boolean
}

/**
 * Hook to asynchronously compute raster statistics over active country polygons via Web Worker.
 *
 * @param {UseCountryStatsAsyncOptions} arg0_options
 *
 * @returns {{ countryStats: CountryStats | null; isCalculatingStats: boolean }}
 */
export function useCountryStatsAsync (arg0_options: UseCountryStatsAsyncOptions): {
  countryStats: CountryStats | null
  isCalculatingStats: boolean
} {
  //Convert from parameters
  let options = arg0_options
  let {
    activeCountries: active_countries,
    activeRaster: active_raster,
    isHoverOnly: is_hover_only = false,
  } = options

  //Declare local instance variables
  let country_stats: CountryStats | null
  let is_calculating_stats: boolean
  let last_raster_ref = useRef<DecodedRaster | null>(null)
  let req_id_ref = useRef<number>(0)
  let set_country_stats: React.Dispatch<React.SetStateAction<CountryStats | null>>
  let set_is_calculating_stats: React.Dispatch<React.SetStateAction<boolean>>
  let worker_ref = useRef<Worker | null>(null)

  //Function body
  ;[country_stats, set_country_stats] = useState<CountryStats | null>(null)
  ;[is_calculating_stats, set_is_calculating_stats] = useState<boolean>(false)

  //Initialise Web Worker
  useEffect(() => {
    let worker: Worker | null = null
    try {
      worker = new Worker(new URL('./countryStats.worker.ts', import.meta.url), {
        type: 'module',
      })

      worker.onmessage = (arg0_e: MessageEvent<WorkerOutMessage>) => {
        let msg = arg0_e.data
        if (!msg)
          return
        if (msg.reqId === req_id_ref.current) {
          if (msg.type === 'COUNTRY_STATS_RESULT') {
            set_country_stats(msg.stats)
            set_is_calculating_stats(false)
          } else if (msg.type === 'COUNTRY_STATS_ERROR') {
            console.error('Country stats worker error:', msg.error)
            set_country_stats(null)
            set_is_calculating_stats(false)
          }
        }
      }

      worker_ref.current = worker
    } catch (arg0_err) {
      console.warn('Web Worker initialisation failed, will use async fallback:', arg0_err)
    }

    return () => {
      if (worker)
        worker.terminate()
      worker_ref.current = null
    }
  }, [])

  //Reset stats and invalidate worker raster cache whenever activeRaster changes
  useEffect(() => {
    req_id_ref.current++
    set_country_stats(null)
    last_raster_ref.current = null

    if (!active_raster)
      set_is_calculating_stats(false)
  }, [active_raster])

  //Compute stats asynchronously when activeCountries or activeRaster changes
  useEffect(() => {
    if (!active_raster || active_countries.length === 0) {
      req_id_ref.current++
      set_country_stats(null)
      set_is_calculating_stats(false)
      return
    }

    let current_req_id = ++req_id_ref.current
    set_is_calculating_stats(true)

    let delay = is_hover_only ? 150 : 0
    let timeout_id: number | null = null

    timeout_id = window.setTimeout(() => {
      if (current_req_id !== req_id_ref.current)
        return

      if (worker_ref.current) {
        if (last_raster_ref.current !== active_raster) {
          worker_ref.current.postMessage({
            bounds: active_raster.bounds,
            data: active_raster.data,
            height: active_raster.height,
            max: active_raster.max,
            min: active_raster.min,
            type: 'SET_RASTER',
            width: active_raster.width,
          } as WorkerInMessage)
          last_raster_ref.current = active_raster
        }

        worker_ref.current.postMessage({
          features: active_countries,
          reqId: current_req_id,
          type: 'CALCULATE_COUNTRY_STATS',
        } as WorkerInMessage)
      } else {
        setTimeout(() => {
          if (current_req_id !== req_id_ref.current)
            return
          try {
            let stats = binRasterByMultipleCountries(active_raster, active_countries)
            if (current_req_id === req_id_ref.current) {
              set_country_stats(stats)
              set_is_calculating_stats(false)
            }
          } catch (arg0_err) {
            if (current_req_id === req_id_ref.current) {
              console.error('Async fallback failed:', arg0_err)
              set_country_stats(null)
              set_is_calculating_stats(false)
            }
          }
        }, 0)
      }
    }, delay)

    return () => {
      if (timeout_id !== null)
        clearTimeout(timeout_id)
    }
  }, [active_raster, active_countries, is_hover_only])

  //Return statement
  return { countryStats: country_stats, isCalculatingStats: is_calculating_stats }
}

export default useCountryStatsAsync
