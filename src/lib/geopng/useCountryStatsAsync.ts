import { useState, useEffect, useRef } from 'react'
import { DecodedRaster } from './types'
import { CountryFeature, CountryStats, binRasterByMultipleCountries } from './polygonBinning'
import type { WorkerInMessage, WorkerOutMessage } from './countryStats.worker'

interface UseCountryStatsAsyncOptions {
  activeRaster: DecodedRaster | null
  activeCountries: CountryFeature[]
  isHoverOnly?: boolean
}

export function useCountryStatsAsync({
  activeRaster,
  activeCountries,
  isHoverOnly = false,
}: UseCountryStatsAsyncOptions) {
  const [countryStats, setCountryStats] = useState<CountryStats | null>(null)
  const [isCalculatingStats, setIsCalculatingStats] = useState<boolean>(false)

  const workerRef = useRef<Worker | null>(null)
  const reqIdRef = useRef<number>(0)
  const lastRasterRef = useRef<DecodedRaster | null>(null)

  // Initialize Web Worker
  useEffect(() => {
    let worker: Worker | null = null
    try {
      worker = new Worker(new URL('./countryStats.worker.ts', import.meta.url), {
        type: 'module',
      })

      worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
        const msg = e.data
        if (!msg) return
        if (msg.reqId === reqIdRef.current) {
          if (msg.type === 'COUNTRY_STATS_RESULT') {
            setCountryStats(msg.stats)
            setIsCalculatingStats(false)
          } else if (msg.type === 'COUNTRY_STATS_ERROR') {
            console.error('Country stats worker error:', msg.error)
            setCountryStats(null)
            setIsCalculatingStats(false)
          }
        }
      }

      workerRef.current = worker
    } catch (err) {
      console.warn('Web Worker initialization failed, will use async fallback:', err)
    }

    return () => {
      if (worker) {
        worker.terminate()
      }
      workerRef.current = null
    }
  }, [])

  // Sync raster to worker whenever activeRaster changes
  useEffect(() => {
    if (!activeRaster) {
      lastRasterRef.current = null
      return
    }

    lastRasterRef.current = activeRaster

    if (workerRef.current) {
      const msg: WorkerInMessage = {
        type: 'SET_RASTER',
        data: activeRaster.data,
        width: activeRaster.width,
        height: activeRaster.height,
        min: activeRaster.min,
        max: activeRaster.max,
        bounds: activeRaster.bounds,
      }
      workerRef.current.postMessage(msg)
    }
  }, [activeRaster])

  // Compute stats asynchronously when activeCountries changes
  useEffect(() => {
    if (!activeRaster || activeCountries.length === 0) {
      reqIdRef.current++
      setCountryStats(null)
      setIsCalculatingStats(false)
      return
    }

    const currentReqId = ++reqIdRef.current
    setIsCalculatingStats(true)

    // Debounce hover requests slightly (150ms) to prevent flood during rapid mouse movements.
    // Click selections trigger immediately.
    const delay = isHoverOnly ? 150 : 0
    let timeoutId: number | null = null

    timeoutId = window.setTimeout(() => {
      if (currentReqId !== reqIdRef.current) return

      if (workerRef.current) {
        // Ensure worker has latest raster before calculating
        if (lastRasterRef.current !== activeRaster) {
          workerRef.current.postMessage({
            type: 'SET_RASTER',
            data: activeRaster.data,
            width: activeRaster.width,
            height: activeRaster.height,
            min: activeRaster.min,
            max: activeRaster.max,
            bounds: activeRaster.bounds,
          } as WorkerInMessage)
          lastRasterRef.current = activeRaster
        }

        workerRef.current.postMessage({
          type: 'CALCULATE_COUNTRY_STATS',
          reqId: currentReqId,
          features: activeCountries,
        } as WorkerInMessage)
      } else {
        // Asynchronous fallback via requestIdleCallback / setTimeout
        setTimeout(() => {
          if (currentReqId !== reqIdRef.current) return
          try {
            const stats = binRasterByMultipleCountries(activeRaster, activeCountries)
            if (currentReqId === reqIdRef.current) {
              setCountryStats(stats)
              setIsCalculatingStats(false)
            }
          } catch (err) {
            if (currentReqId === reqIdRef.current) {
              console.error('Async fallback failed:', err)
              setCountryStats(null)
              setIsCalculatingStats(false)
            }
          }
        }, 0)
      }
    }, delay)

    return () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
    }
  }, [activeRaster, activeCountries, isHoverOnly])

  return { countryStats, isCalculatingStats }
}
