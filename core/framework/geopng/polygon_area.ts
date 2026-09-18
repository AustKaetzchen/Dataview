/**
 * Geodesic polygon area calculations on the WGS84 authalic sphere.
 * Provides high-precision clientside area calculations for GeoJSON geometries,
 * accounting for antimeridian wrapping and polygon interior holes.
 */

/**
 * Calculates the geodesic surface area of a GeoJSON Feature or historical entity in square kilometres.
 *
 * @param {any} arg0_feature
 *
 * @returns {number}
 */
export let calculateFeatureArea = function (arg0_feature: any): number {
  //Convert from parameters
  let feature = arg0_feature

  //Declare local instance variables
  let geometry: any

  //Guard clauses
  if (!feature)
    return 0

  //Function body
  geometry = feature.geometry || (feature.type && feature.coordinates ? feature : null)
  if (!geometry)
    return 0

  //Return statement
  return calculateGeodesicArea(geometry)
}


/**
 * Calculates the geodesic surface area of any GeoJSON geometry in square kilometres.
 * Supports Polygon, MultiPolygon, and GeometryCollection geometries.
 *
 * @param {any} arg0_geometry
 *
 * @returns {number}
 */
export let calculateGeodesicArea = function (arg0_geometry: any): number {
  //Convert from parameters
  let geometry = arg0_geometry

  //Declare local instance variables
  let total_area = 0

  //Guard clauses
  if (!geometry)
    return 0

  //Function body
  if (geometry.type === 'Feature') {
    return calculateGeodesicArea(geometry.geometry)
  } else if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    return calculatePolygonArea(geometry.coordinates)
  } else if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
    return calculateMultiPolygonArea(geometry.coordinates)
  } else if (geometry.type === 'GeometryCollection' && Array.isArray(geometry.geometries)) {
    for (let i = 0; i < geometry.geometries.length; i++)
      total_area += calculateGeodesicArea(geometry.geometries[i])
    return total_area
  }

  //Return statement
  return 0
}


/**
 * Calculates the total geodesic surface area of a GeoJSON MultiPolygon coordinate tree in square kilometres.
 *
 * @param {number[][][][]} arg0_coordinates
 *
 * @returns {number}
 */
export let calculateMultiPolygonArea = function (arg0_coordinates: number[][][][]): number {
  //Convert from parameters
  let coordinates = arg0_coordinates

  //Declare local instance variables
  let total_area = 0

  //Guard clauses
  if (!coordinates || !Array.isArray(coordinates))
    return 0

  //Function body
  for (let i = 0; i < coordinates.length; i++)
    total_area += calculatePolygonArea(coordinates[i])

  //Return statement
  return total_area
}


/**
 * Calculates the geodesic surface area of a single GeoJSON Polygon coordinate set (exterior ring minus holes) in square kilometres.
 *
 * @param {number[][][]} arg0_coordinates
 *
 * @returns {number}
 */
export let calculatePolygonArea = function (arg0_coordinates: number[][][]): number {
  //Convert from parameters
  let coordinates = arg0_coordinates

  //Declare local instance variables
  let exterior_area = 0

  //Guard clauses
  if (!coordinates || !Array.isArray(coordinates) || coordinates.length === 0)
    return 0

  //Function body
  exterior_area = calculateRingArea(coordinates[0])
  if (exterior_area <= 0)
    return 0

  for (let x = 1; x < coordinates.length; x++) {
    let hole_area = calculateRingArea(coordinates[x])
    exterior_area -= hole_area
  }

  //Return statement
  return Math.max(0, exterior_area)
}


/**
 * Calculates the geodesic spherical surface area of a single ring of [lng, lat] coordinates in square kilometres.
 * Uses a second-order central difference spherical line integral on the WGS84 authalic sphere (R = 6371.0088 km).
 *
 * @param {number[][]} arg0_ring
 *
 * @returns {number}
 */
export let calculateRingArea = function (arg0_ring: number[][]): number {
  //Convert from parameters
  let ring = arg0_ring

  //Declare local instance variables
  let authalic_radius_sq = 40589753.1288
  let d_lambda: number
  let deg_to_rad = Math.PI / 180
  let effective_pts: number[][]
  let is_closed: boolean
  let lambda_1: number
  let lambda_3: number
  let num_pts: number
  let p_1: number[]
  let p_2: number[]
  let p_3: number[]
  let phi_2: number
  let solid_angle: number
  let sum = 0

  //Guard clauses
  if (!ring || !Array.isArray(ring) || ring.length < 3)
    return 0

  //Function body
  is_closed = (ring.length > 3 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1])
  effective_pts = is_closed ? ring.slice(0, ring.length - 1) : ring

  if (effective_pts.length < 3)
    return 0

  num_pts = effective_pts.length

  for (let i = 0; i < num_pts; i++) {
    p_1 = effective_pts[(i - 1 + num_pts) % num_pts]
    p_2 = effective_pts[i]
    p_3 = effective_pts[(i + 1) % num_pts]

    lambda_1 = p_1[0] * deg_to_rad
    lambda_3 = p_3[0] * deg_to_rad
    phi_2 = p_2[1] * deg_to_rad

    d_lambda = lambda_3 - lambda_1

    //Antimeridian wrapping for coordinate longitude differences
    while (d_lambda > Math.PI)
      d_lambda -= 2 * Math.PI
    while (d_lambda < -Math.PI)
      d_lambda += 2 * Math.PI

    sum += d_lambda * Math.sin(phi_2)
  }

  solid_angle = Math.abs(sum) / 2

  //Wrap complement if ring was oriented clockwise enclosing globe exterior
  if (solid_angle > 2 * Math.PI)
    solid_angle = 4 * Math.PI - solid_angle

  //Return statement
  return solid_angle * authalic_radius_sq
}


/**
 * Formats a numeric area in square kilometres into a standardised European locale display string.
 *
 * @param {number} arg0_area_km2
 * @param {string} [arg1_locale="de-DE"]
 *
 * @returns {string}
 */
export let formatAreaKm2 = function (arg0_area_km2: number, arg1_locale?: string): string {
  //Convert from parameters
  let area_km2 = arg0_area_km2
  let locale = (arg1_locale) ? arg1_locale : 'de-DE'

  //Declare local instance variables
  let rounded_area: number

  //Guard clauses
  if (!Number.isFinite(area_km2) || area_km2 < 0)
    return '0 km²'

  //Function body
  rounded_area = Math.round(area_km2)

  //Return statement
  return `${rounded_area.toLocaleString(locale)} km²`
}


/**
 * Resolves the area of a historical feature, computing and caching clientside if not already present.
 *
 * @param {any} arg0_feature
 *
 * @returns {number}
 */
export let getFeatureArea = function (arg0_feature: any): number {
  //Convert from parameters
  let feature = arg0_feature

  //Declare local instance variables
  let computed_area: number

  //Guard clauses
  if (!feature)
    return 0

  //Function body
  if (feature.properties?.calculated_area && typeof feature.properties.calculated_area === 'number')
    return feature.properties.calculated_area

  computed_area = calculateFeatureArea(feature)

  if (computed_area > 0 && feature.properties) {
    feature.properties.calculated_area = Math.round(computed_area)
    feature.properties.area = Math.round(computed_area)
  }

  //Return statement
  return (computed_area > 0)
    ? computed_area
    : (typeof feature.properties?.area === 'number' ? feature.properties.area : 0)
}
