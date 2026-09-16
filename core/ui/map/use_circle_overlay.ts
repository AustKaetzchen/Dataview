import { useMemo } from 'react'
import { computeQuantiles } from '@framework/geopng/scales'
import { getPaletteLUT } from '@framework/geopng/palettes'
import { projectEqualEarth } from '@framework/geopng/equal_earth.ts'
import {
  CountryFeature,
  computeGeometryBBox,
  isPointInGeometry,
} from '@framework/geopng/polygon_binning.ts'
import {
  DecodedRaster,
  ProjectionType,
  HeightmapConfig,
  CircleOverlayConfig,
} from '@framework/geopng/types.ts'
import { getPixelOffset } from '@common'

export interface CirclePixelPoint {
  position: [number, number, number]
  value: number
  radius: number
  color: [number, number, number, number]
}

export interface UseCircleOverlayParams {
  circleOverlayConfig: CircleOverlayConfig
  raster: DecodedRaster | null
  palette: any
  invertPalette?: boolean
  minVal: number
  maxVal: number
  projection: ProjectionType
  heightmapConfig: HeightmapConfig
  countriesMode?: boolean
  selectedCountries?: CountryFeature[]
  selectedCountry?: CountryFeature | null
}

/**
 * Computes high-value proportional equal-area circle overlays (A ∝ Value => r ∝ sqrt(Value)).
 * Handles percentile cutoff filtering, stride downsampling, country masking, and palette mapping.
 *
 * @param {UseCircleOverlayParams} arg0_options
 * @returns {Array<CirclePixelPoint>}
 */
export let useCircleOverlay = function (arg0_options: UseCircleOverlayParams): CirclePixelPoint[] {
  //Convert from parameters
  let options = (arg0_options) ? arg0_options : ({} as UseCircleOverlayParams)

  //Return statement
  return useMemo(() => {
    //Declare local instance variables
    let circle_overlay_config = options.circleOverlayConfig
    let countries_mode = options.countriesMode
    let cutoff_quantiles: number[]
    let cutoff_val: number
    let effective_selected_array: CountryFeature[] = []
    let height: number
    let heightmap_config = options.heightmapConfig
    let invert_palette = options.invertPalette
    let is_cartesian: boolean
    let lat_offset: number
    let lut: Uint8Array
    let min_val = options.minVal
    let p_cutoff: number
    let palette = options.palette
    let pixel_offset: number
    let points_array: CirclePixelPoint[] = []
    let projection = options.projection
    let raster = options.raster
    let scale_factor: number
    let selected_countries = options.selectedCountries
    let selected_country = options.selectedCountry
    let stride: number
    let val_range: number
    let width: number

    //Guard clauses
    if (!circle_overlay_config.enabled || !raster)
      return []

    //Function body
    p_cutoff = circle_overlay_config.percentileCutoff/100
    cutoff_quantiles = computeQuantiles(raster.data, [p_cutoff])
    cutoff_val = cutoff_quantiles[0]

    if (!Number.isFinite(cutoff_val))
      return []

    width = raster.width
    height = raster.height
    val_range = raster.max - raster.min || 1
    lut = getPaletteLUT(palette, Boolean(invert_palette))
    is_cartesian = (projection === 'Equirectangular' || projection === 'EqualEarth')
    scale_factor = circle_overlay_config.baseRadius || 1.0

    if (selected_countries && selected_countries.length > 0) {
      effective_selected_array = selected_countries
    } else if (selected_country) {
      effective_selected_array = [selected_country]
    }

    if (countries_mode && effective_selected_array.length === 0)
      return []

    stride = Math.max(1, Math.floor(Math.sqrt((width*height)/100000)))
    pixel_offset = getPixelOffset(projection)
    lat_offset = pixel_offset*(180/height)

    for (let i = 0; i < height; i += stride) {
      let local_lat = 90 - ((i + 0.5)/height)*180 + lat_offset
      let local_row_offset = i*width

      for (let x = 0; x < width; x += stride) {
        let local_val = raster.data[local_row_offset + x]

        if (Number.isFinite(local_val) && local_val >= cutoff_val) {
          let local_alt = 0
          let local_color: [number, number, number, number]
          let local_is_inside = false
          let local_lng = -180 + ((x + 0.5)/width)*360
          let local_lut_idx: number
          let local_norm_all: number
          let local_pos_v = Math.max(0, local_val)
          let local_px = local_lng
          let local_py = local_lat
          let local_radius: number
          let local_radius_meters: number

          if (countries_mode && effective_selected_array.length > 0) {
            for (let y = 0; y < effective_selected_array.length; y++) {
              let local_country = effective_selected_array[y]
              let local_bbox = local_country.bbox || computeGeometryBBox(local_country.geometry)

              if (local_bbox) {
                let local_b_max_x = local_bbox[2]
                let local_b_max_y = local_bbox[3]
                let local_b_min_x = local_bbox[0]
                let local_b_min_y = local_bbox[1]

                if (local_lng < local_b_min_x || local_lng > local_b_max_x || local_lat < local_b_min_y || local_lat > local_b_max_y)
                  continue
              }

              if (isPointInGeometry(local_lng, local_lat, local_country.geometry)) {
                local_is_inside = true
                break
              }
            }

            if (!local_is_inside)
              continue
          }

          if (projection === 'EqualEarth') {
            let local_projected = projectEqualEarth(local_lng, local_lat)
            local_px = local_projected[0]
            local_py = local_projected[1]
          }

          if (heightmap_config.enabled) {
            let local_elevation_scale = heightmap_config.elevationScale || 250000
            let local_norm = Math.max(0, (local_val - min_val)/val_range)

            if (is_cartesian) {
              local_alt = local_norm*(local_elevation_scale/111000)*12
            } else {
              local_alt = local_norm*local_elevation_scale
            }
          }

          local_radius_meters = (local_pos_v > 0) ? Math.sqrt((local_pos_v*10000*scale_factor)/Math.PI) : 0
          local_radius = (is_cartesian) ? local_radius_meters/111320 : local_radius_meters

          local_norm_all = Math.max(0, Math.min(1, (local_val - min_val)/val_range))
          local_lut_idx = Math.floor(local_norm_all*255)*3
          local_color = [
            lut[local_lut_idx],
            lut[local_lut_idx + 1],
            lut[local_lut_idx + 2],
            230,
          ]

          points_array.push({
            position: [local_px, local_py, local_alt],
            value: local_val,
            radius: local_radius,
            color: local_color,
          })
        }
      }
    }

    //Return statement
    return points_array
  }, [
    options.circleOverlayConfig,
    options.raster,
    options.palette,
    options.invertPalette,
    options.minVal,
    options.maxVal,
    options.projection,
    options.heightmapConfig,
    options.countriesMode,
    options.selectedCountries,
    options.selectedCountry,
  ])
}
