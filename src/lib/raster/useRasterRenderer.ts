import React, { useMemo, useRef, useEffect } from 'react'
import {
  ColorPalette,
  DecodedRaster,
  ProjectionType,
  ScaleType,
} from '@/lib/geopng/types'
import { renderRasterToCanvas } from '@/lib/geopng/palettes'
import { CountryFeature } from '@/lib/geopng/polygonBinning'
import { getPixelOffset } from '@config'

export interface UseRasterRendererParams {
  activeCountries: CountryFeature[]
  activeRaster: DecodedRaster | null
  breaks?: number[]
  colorPalette: ColorPalette
  countriesMode: boolean
  countryStats?: { max: number; min: number; validCount: number } | null
  invertPalette: boolean
  logSigma: number
  maxVal: number
  minVal: number
  projection: ProjectionType
  scaleType: ScaleType
}

export interface UseRasterRendererResult {
  rasterBounds: [number, number, number, number]
  renderedCanvas: HTMLCanvasElement | null
}

/**
 * Custom hook to render decoded raster matrices to GPU-backed Canvas elements with explicit texture release.
 *
 * @param {UseRasterRendererParams} arg0_params
 *
 * @returns {UseRasterRendererResult}
 */
export function useRasterRenderer (arg0_params: UseRasterRendererParams): UseRasterRendererResult {
  //Convert from parameters
  let active_countries = arg0_params.activeCountries
  let active_raster = arg0_params.activeRaster
  let breaks = arg0_params.breaks
  let color_palette = arg0_params.colorPalette
  let countries_mode = arg0_params.countriesMode
  let country_stats = arg0_params.countryStats
  let invert_palette = arg0_params.invertPalette
  let log_sigma = arg0_params.logSigma
  let max_val = arg0_params.maxVal
  let min_val = arg0_params.minVal
  let projection = arg0_params.projection
  let scale_type = arg0_params.scaleType

  //Declare local instance variables
  let prev_canvas_ref = useRef<HTMLCanvasElement | null>(null)

  //Function body
  let result = useMemo(() => {
    let r = active_raster
    if (!r) {
      //Release previous canvas
      if (prev_canvas_ref.current) {
        prev_canvas_ref.current.width = 0
        prev_canvas_ref.current.height = 0
        prev_canvas_ref.current = null
      }
      return {
        rasterBounds: [-180, -90, 180, 90] as [number, number, number, number],
        renderedCanvas: null,
      }
    }

    let is_country_isolated = Boolean(
      countries_mode &&
        active_countries.length > 0 &&
        country_stats &&
        country_stats.validCount > 0 &&
        Number.isFinite(country_stats.min) &&
        Number.isFinite(country_stats.max)
    )

    let effective_max = is_country_isolated ? country_stats!.max : max_val
    let effective_min = is_country_isolated ? country_stats!.min : min_val

    let { canvas } = renderRasterToCanvas(
      r.data,
      r.width,
      r.height,
      {
        activeCountries: is_country_isolated ? active_countries : null,
        breaks,
        invertPalette: invert_palette,
        logSigma: log_sigma,
        maxVal: effective_max,
        minVal: effective_min,
        palette: color_palette,
        projection,
        scaleType: scale_type,
      }
    )

    //Release previous canvas backing texture to actively cap GPU RAM
    if (prev_canvas_ref.current && prev_canvas_ref.current !== canvas) {
      prev_canvas_ref.current.width = 0
      prev_canvas_ref.current.height = 0
    }
    prev_canvas_ref.current = canvas

    let pixel_height = 180/r.height
    let pixel_offset = getPixelOffset(projection)
    let offset = pixel_offset*pixel_height
    let final_bounds: [number, number, number, number] = [-180, -90 + offset, 180, 90 + offset]

    return { rasterBounds: final_bounds, renderedCanvas: canvas }
  }, [
    active_raster,
    active_countries,
    breaks,
    color_palette,
    countries_mode,
    country_stats,
    invert_palette,
    log_sigma,
    max_val,
    min_val,
    projection,
    scale_type,
  ])

  //Clean up canvas when component unmounts
  useEffect(() => {
    return () => {
      if (prev_canvas_ref.current) {
        prev_canvas_ref.current.width = 0
        prev_canvas_ref.current.height = 0
        prev_canvas_ref.current = null
      }
    }
  }, [])

  //Return statement
  return result
}
