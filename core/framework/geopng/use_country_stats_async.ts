import { useState, useEffect, useRef } from 'react'
import { DecodedRaster } from './types.ts'
import { CountryFeature, CountryStats, binRasterByMultipleCountries } from './polygon_binning.ts'
import type { WorkerInMessage, WorkerOutMessage } from './country_stats.worker.ts'

export interface UseCountryStatsAsyncOptions {
  activeCountries: CountryFeature[]
  activeRaster: DecodedRaster | null
  isHoverOnly?: boolean
}

/**
 * Checks whether two raster references represent identical data and dimensions.
 *
 * @param {DecodedRaster | null} arg0_a
 * @param {DecodedRaster | null} arg1_b
 *
 * @returns {boolean}
 */
function isSameRaster (arg0_a: DecodedRaster | null, arg1_b: DecodedRaster | null): boolean {
  //Convert from parameters
  let a = arg0_a
  let b = arg1_b

  //Guard clauses
  if (a === b)
    return true
  if (!a || !b)
    return false

  //Return statement
  return (
    a.data === b.data &&
    a.width === b.width &&
    a.height === b.height &&
    a.min === b.min &&
    a.max === b.max
  )
}

/**
 * Sanitises country features into clean, serialisable GeoJSON objects without deck.gl internals.
 *
 * @param {CountryFeature[]} arg0_features
 *
 * @returns {CountryFeature[]}
 */
function sanitizeCountryFeatures (arg0_features: CountryFeature[]): CountryFeature[] {
  //Convert from parameters
  let features = arg0_features

  //Declare local instance variables
  let clean_features: CountryFeature[] = []

  //Function body
  for (let i = 0; i < features.length; i++) {
    let f = features[i]
    if (!f || !f.geometry)
      continue
    clean_features.push({
      geometry: {
        coordinates: f.geometry.coordinates,
        type: f.geometry.type,
      },
      properties: {
        adm0_a3: f.properties?.adm0_a3,
        area: f.properties?.area,
        gwcode: f.properties?.gwcode,
        id: f.properties?.id ?? (f as any).id,
        iso_a3: f.properties?.iso_a3,
        name: f.properties?.name || f.properties?.name_long || 'Unknown',
        name_long: f.properties?.name_long,
      },
      type: 'Feature',
    })
  }

  //Return statement
  return clean_features
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
      worker = new Worker(new URL('./country_stats.worker.ts', import.meta.url), {
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

      worker.onerror = (arg0_err: ErrorEvent) => {
        console.warn('Web Worker error in country stats, falling back to sync:', arg0_err)
        worker_ref.current = null
        set_is_calculating_stats(false)
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

  //Reset stats and invalidate worker raster cache whenever activeRaster actually changes
  useEffect(() => {
    if (!isSameRaster(last_raster_ref.current, active_raster)) {
      req_id_ref.current++
      set_country_stats(null)
      last_raster_ref.current = null

      if (!active_raster)
        set_is_calculating_stats(false)
    }
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
    let watchdog_id: number | null = null

    let run_sync_fallback = () => {
      try {
        let stats = binRasterByMultipleCountries(active_raster, active_countries)
        if (current_req_id === req_id_ref.current) {
          set_country_stats(stats)
          set_is_calculating_stats(false)
        }
      } catch (arg0_err) {
        if (current_req_id === req_id_ref.current) {
          console.error('Country stats calculation fallback failed:', arg0_err)
          set_country_stats(null)
          set_is_calculating_stats(false)
        }
      }
    }

    timeout_id = window.setTimeout(() => {
      if (current_req_id !== req_id_ref.current)
        return

      if (worker_ref.current) {
        try {
          if (!isSameRaster(last_raster_ref.current, active_raster)) {
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

          let clean_features = sanitizeCountryFeatures(active_countries)

          worker_ref.current.postMessage({
            features: clean_features,
            reqId: current_req_id,
            type: 'CALCULATE_COUNTRY_STATS',
          } as WorkerInMessage)

          // Watchdog: If worker doesn't respond within 4s (e.g. Firefox deadlock or dropped message), fall back cleanly
          watchdog_id = window.setTimeout(() => {
            if (current_req_id === req_id_ref.current) {
              console.warn('Country stats worker timed out, running synchronous fallback.')
              run_sync_fallback()
            }
          }, 4000)
        } catch (arg0_post_err) {
          console.warn('Worker postMessage failed (e.g. cloning error in Firefox), using fallback:', arg0_post_err)
          run_sync_fallback()
        }
      } else {
        setTimeout(() => {
          if (current_req_id !== req_id_ref.current)
            return
          run_sync_fallback()
        }, 0)
      }
    }, delay)

    return () => {
      if (timeout_id !== null)
        clearTimeout(timeout_id)
      if (watchdog_id !== null)
        clearTimeout(watchdog_id)
    }
  }, [active_raster, active_countries, is_hover_only])

  //Return statement
  return { countryStats: country_stats, isCalculatingStats: is_calculating_stats }
}

export default useCountryStatsAsync
