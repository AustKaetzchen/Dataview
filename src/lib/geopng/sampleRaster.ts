import { CountryFeature, findCountryAtLngLat, isPointInGeometry } from './polygonBinning'
import { invertEqualEarth } from './equalEarth'
import { DecodedRaster, InspectionData, ProjectionType } from './types'
import { getPixelOffset } from '@config'

/**
 * Samples raster matrix value and country identity at given projection coordinates.
 *
 * @param {number} arg0_coord_x
 * @param {number} arg1_coord_y
 * @param {DecodedRaster | null} arg2_raster
 * @param {ProjectionType} arg3_projection
 * @param {CountryFeature[]} arg4_country_features
 * @param {boolean} arg5_countries_mode
 * @param {CountryFeature | null} [arg6_last_country]
 *
 * @returns {InspectionData | null}
 */
export const sampleRasterAt = function (
  arg0_coord_x: number,
  arg1_coord_y: number,
  arg2_raster: DecodedRaster | null,
  arg3_projection: ProjectionType,
  arg4_country_features: CountryFeature[],
  arg5_countries_mode: boolean,
  arg6_last_country?: CountryFeature | null
): InspectionData | null {
  //Convert from parameters
  let coord_x = arg0_coord_x
  let coord_y = arg1_coord_y
  let countries_mode = arg5_countries_mode
  let country_features = arg4_country_features
  let last_country = arg6_last_country
  let projection = arg3_projection
  let raster = arg2_raster

  //Guard clauses
  if (!raster)
    return null

  //Declare local instance variables
  let clamped_x: number
  let clamped_y: number
  let country_name: string | null = null
  let eff_lat: number
  let lat = coord_y
  let lng = coord_x
  let offset: number
  let pixel_height: number
  let pixel_offset: number
  let pixel_x: number
  let pixel_y: number
  let raster_val: number

  //Function body
  if (projection === 'EqualEarth') {
    let local_inverted = invertEqualEarth(coord_x, coord_y)
    lng = local_inverted[0]
    lat = local_inverted[1]
  }

  if (lng < -180 || lng > 180 || lat < -90 || lat > 90)
    return null

  pixel_height = 180/raster.height
  pixel_x = Math.floor(((lng + 180)/360)*raster.width)
  pixel_offset = getPixelOffset(projection)
  offset = pixel_offset*pixel_height
  eff_lat = lat - offset
  pixel_y = Math.floor(((90 - eff_lat)/180)*raster.height)

  clamped_x = Math.max(0, Math.min(raster.width - 1, pixel_x))
  clamped_y = Math.max(0, Math.min(raster.height - 1, pixel_y))

  raster_val = raster.data[clamped_y*raster.width + clamped_x]

  if (country_features.length > 0) {
    if (last_country && last_country.bbox) {
      let b_max_x = last_country.bbox[2]
      let b_max_y = last_country.bbox[3]
      let b_min_x = last_country.bbox[0]
      let b_min_y = last_country.bbox[1]
      if (lng >= b_min_x && lng <= b_max_x && lat >= b_min_y && lat <= b_max_y && isPointInGeometry(lng, lat, last_country.geometry))
        country_name = last_country.properties.name || last_country.properties.name_long || null
    }
    if (!country_name && countries_mode) {
      let local_c = findCountryAtLngLat(lng, lat, country_features)
      if (local_c)
        country_name = local_c.properties.name || local_c.properties.name_long || null
    }
  }

  //Return statement
  return {
    countryName: country_name,
    lat,
    lng,
    pixelX: clamped_x,
    pixelY: clamped_y,
    value: Number.isNaN(raster_val) ? null : raster_val,
  }
}
