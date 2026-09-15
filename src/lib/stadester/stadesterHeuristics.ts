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

  //Declare local instance variables
  let knots = FLOOR_KNOTS

  //Guard clauses
  if (year <= knots[0][0])
    return knots[0][1]

  let last_idx = knots.length - 1
  if (year >= knots[last_idx][0])
    return knots[last_idx][1]

  //Function body
  for (let i = 1; i < knots.length; i++) {
    let a = knots[i - 1]
    let b = knots[i]

    if (year <= b[0]) {
      if (a[1] === b[1])
        return a[1]

      let f = (year - a[0]) / (b[0] - a[0])
      let log_a = Math.log10(a[1])
      let log_b = Math.log10(b[1])

      //Return statement
      return Math.round(Math.pow(10, log_a + (log_b - log_a) * f))
    }
  }

  //Return statement
  return knots[last_idx][1]
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
      bubbleMinPop: 50000,
      labelMinPop: 1000000,
      maxBubbles: 600,
      maxLabels: 25,
    }
  }

  //2. Continental View (2.0 <= norm_zoom < 3.5)
  if (norm_zoom < 3.5) {
    return {
      bubbleMinPop: 20000,
      labelMinPop: 250000,
      maxBubbles: 1500,
      maxLabels: 50,
    }
  }

  //3. Regional View (3.5 <= norm_zoom < 5.0)
  if (norm_zoom < 5.0) {
    return {
      bubbleMinPop: 5000,
      labelMinPop: 50000,
      maxBubbles: 3000,
      maxLabels: 75,
    }
  }

  //4. Local View (norm_zoom >= 5.0)
  //Return statement
  return {
    bubbleMinPop: 1000,
    labelMinPop: 10000,
    maxBubbles: 5000,
    maxLabels: 100,
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
    let scale = Math.pow(2, view_state.zoom ?? 2.8)
    let target = view_state.target || [0, 0, 0]
    let half_w = (window_w / 2) / scale
    let half_h = (window_h / 2) / scale

    let min_x = target[0] - half_w * 1.2
    let max_x = target[0] + half_w * 1.2
    let min_y = target[1] - half_h * 1.2
    let max_y = target[1] + half_h * 1.2

    if (projection === 'EqualEarth') {
      let sw = invertEqualEarth(min_x, min_y)
      let ne = invertEqualEarth(max_x, max_y)
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
    let zoom = view_state.zoom ?? 1.2

    //Approximate geographic span from zoom
    let span_lng = (360 / Math.pow(2, zoom)) * (window_w / 512) * 1.2
    let span_lat = (180 / Math.pow(2, zoom)) * (window_h / 512) * 1.2

    west = Math.max(-180, center_lng - span_lng / 2)
    east = Math.min(180, center_lng + span_lng / 2)
    south = Math.max(-90, center_lat - span_lat / 2)
    north = Math.min(90, center_lat + span_lat / 2)

    if (span_lng >= 360) {
      west = -180
      east = 180
    }
  }

  //Return statement
  return [west, south, east, north]
}
