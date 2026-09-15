import { projectEqualEarth, invertEqualEarth } from '../geopng/equalEarth'

const FLOOR_KNOTS: Array<[number, number]> = [
  [600, 5000],
  [700, 10000],
  [1400, 10000],
  [1500, 20000],
]

/**
 * Computes historical era baseline population display floor.
 * Small settlements thin out in modern eras to prevent screen overcrowding.
 *
 * @param {number} arg0_year
 *
 * @returns {number}
 */
export function getEraDisplayFloor (arg0_year: number): number {
  //Convert from parameters
  let year = arg0_year

  //Guard clauses
  if (year <= 600)
    return 0
  if (year <= 1500)
    return 500

  //Return statement
  return 1000
}

export interface ZoomThresholds {
  bubbleMinPop: number
  labelMinPop: number
  maxBubbles: number
  maxLabels: number
}

/**
 * Returns calibrated population thresholds and maximum label counts for a given camera zoom.
 *
 * @param {number} arg0_zoom
 * @param {string} [arg1_projection='Mercator']
 *
 * @returns {ZoomThresholds}
 */
export function getZoomPopulationThreshold (
  arg0_zoom: number,
  arg1_projection?: string
): ZoomThresholds {
  //Convert from parameters
  let projection = (arg1_projection) ? arg1_projection : 'Mercator'
  let zoom = arg0_zoom

  //Declare local instance variables
  let is_cartesian = (projection === 'EqualEarth' || projection === 'Equirectangular')
  let norm_zoom = (is_cartesian) ? (zoom - 1.2) : zoom

  //Function body
  //1. World View (norm_zoom < 2.0)
  if (norm_zoom < 2.0) {
    return {
      bubbleMinPop: 15000,
      labelMinPop: 250000,
      maxBubbles: 1500,
      maxLabels: 40,
    }
  }

  //2. Continental View (2.0 <= norm_zoom < 3.5)
  if (norm_zoom < 3.5) {
    return {
      bubbleMinPop: 4000,
      labelMinPop: 50000,
      maxBubbles: 3500,
      maxLabels: 90,
    }
  }

  //3. Regional View (3.5 <= norm_zoom < 5.0)
  if (norm_zoom < 5.0) {
    return {
      bubbleMinPop: 500,
      labelMinPop: 5000,
      maxBubbles: 10000,
      maxLabels: 250,
    }
  }

  //4. Local View (norm_zoom >= 5.0)
  //Return statement
  return {
    bubbleMinPop: 0,
    labelMinPop: 0,
    maxBubbles: 30000,
    maxLabels: 800,
  }
}

/**
 * Computes the visible geographic bounding box [west, south, east, north] with margin.
 *
 * @param {any} arg0_view_state
 * @param {string} arg1_projection
 * @param {number} arg2_window_w
 * @param {number} arg3_window_h
 *
 * @returns {[number, number, number, number]} - [west, south, east, north]
 */
export function computeViewportBoundingBox (
  arg0_view_state: any,
  arg1_projection: string,
  arg2_window_w: number,
  arg3_window_h: number
): [number, number, number, number] {
  //Convert from parameters
  let projection = arg1_projection
  let view_state = arg0_view_state
  let window_h = arg3_window_h
  let window_w = arg2_window_w

  //Declare local instance variables
  let east: number
  let is_cartesian = (projection === 'EqualEarth' || projection === 'Equirectangular')
  let north: number
  let south: number
  let west: number

  //Function body
  if (!view_state)
    return [-180, -90, 180, 90]

  if (is_cartesian) {
    let half_h: number
    let half_w: number
    let max_x: number
    let max_y: number
    let min_x: number
    let min_y: number
    let scale = Math.pow(2, view_state.zoom ?? 2.8)
    let target = view_state.target || [0, 0, 0]

    half_w = (window_w/2)/scale
    half_h = (window_h/2)/scale
    min_x = target[0] - half_w*1.3
    max_x = target[0] + half_w*1.3
    min_y = target[1] - half_h*1.3
    max_y = target[1] + half_h*1.3

    if (projection === 'EqualEarth') {
      let ne = invertEqualEarth(max_x, max_y)
      let sw = invertEqualEarth(min_x, min_y)
      west = Math.max(-180, sw[0])
      south = Math.max(-90, sw[1])
      east = Math.min(180, ne[0])
      north = Math.min(90, ne[1])
    } else {
      west = Math.max(-180, min_x)
      south = Math.max(-90, min_y)
      east = Math.min(180, max_x)
      north = Math.min(90, max_y)
    }
  } else {
    let center_lat = view_state.latitude ?? 20
    let center_lng = view_state.longitude ?? 0
    let delta_y_mercator: number
    let half_h: number
    let half_w: number
    let lat_clamped: number
    let lat_rad: number
    let margin = 1.35
    let north_rad: number
    let south_rad: number
    let span_lng: number
    let world_size: number
    let y_mercator_center: number
    let y_north: number
    let y_south: number
    let zoom = view_state.zoom ?? 1.2

    //World scale in pixels at zoom: world_size = 512 * 2^zoom
    world_size = 512*Math.pow(2, zoom)

    //Longitude span
    half_w = (window_w/2)*margin
    span_lng = (360*half_w)/world_size

    if (span_lng >= 180) {
      west = -180
      east = 180
    } else {
      west = center_lng - span_lng
      east = center_lng + span_lng

      if (west < -180)
        west += 360
      if (east > 180)
        east -= 360
    }

    //Latitude calculation via conformal Web Mercator Gudermannian inverse
    half_h = (window_h/2)*margin
    lat_clamped = Math.max(-85.051129, Math.min(85.051129, center_lat))
    lat_rad = (lat_clamped*Math.PI)/180
    y_mercator_center = Math.log(Math.tan(Math.PI/4 + lat_rad/2))

    //Pixel delta to Mercator radian delta
    delta_y_mercator = (2*Math.PI*half_h)/world_size

    y_north = y_mercator_center + delta_y_mercator
    y_south = y_mercator_center - delta_y_mercator

    //Invert Web Mercator Y to latitude degrees
    if (y_north >= Math.PI) {
      north = 90
    } else {
      north_rad = 2*Math.atan(Math.exp(y_north)) - Math.PI/2
      north = Math.min(90, (north_rad*180)/Math.PI)
    }

    if (y_south <= -Math.PI) {
      south = -90
    } else {
      south_rad = 2*Math.atan(Math.exp(y_south)) - Math.PI/2
      south = Math.max(-90, (south_rad*180)/Math.PI)
    }
  }

  //Return statement
  return [west, south, east, north]
}
