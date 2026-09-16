/**
 * Scanline rasterisation and polygon bounding span calculations for GeoJSON geometries.
 */

export interface ScanlineSpan {
  c_end: number
  c_start: number
  row: number
}

let RASTER_HEIGHT = 2160
let RASTER_WIDTH = 4320

/**
 * Computes scanline bounding spans for a GeoJSON Polygon or MultiPolygon.
 * Uses the Jordan curve even-odd rule across all exterior and hole rings.
 *
 * @param {any} arg0_geometry
 * @param {number} [arg1_w=RASTER_WIDTH]
 * @param {number} [arg2_h=RASTER_HEIGHT]
 *
 * @returns {ScanlineSpan[]}
 */
export function computeScanlineSpans (
  arg0_geometry: any,
  arg1_w = RASTER_WIDTH,
  arg2_h = RASTER_HEIGHT
): ScanlineSpan[] {
  //Convert from parameters
  let geometry = arg0_geometry
  let h = arg2_h
  let w = arg1_w

  //Guard clauses
  if (!geometry || !geometry.coordinates)
    return []

  //Declare local instance variables
  let polygons: number[][][][] =
    geometry.type === 'Polygon'
      ? [geometry.coordinates as number[][][]]
      : (geometry.coordinates as number[][][][])
  let spans: ScanlineSpan[] = []

  //Function body
  for (let p_idx = 0; p_idx < polygons.length; p_idx++) {
    let poly_rings = polygons[p_idx]
    if (!poly_rings || poly_rings.length === 0)
      continue

    let ext_ring = poly_rings[0]
    let max_y = -Infinity
    let min_y = Infinity

    for (let pt_idx = 0; pt_idx < ext_ring.length; pt_idx++) {
      let y = ext_ring[pt_idx][1]
      if (y < min_y)
        min_y = y
      if (y > max_y)
        max_y = y
    }

    let max_r = Math.min(h - 1, Math.ceil(((90 - min_y)/180)*h))
    let min_r = Math.max(0, Math.floor(((90 - max_y)/180)*h))

    for (let r = min_r; r <= max_r; r++) {
      let lat = 90 - ((r + 0.5)/h)*180
      let intersections: number[] = []

      for (let ring_idx = 0; ring_idx < poly_rings.length; ring_idx++) {
        let ring = poly_rings[ring_idx]
        for (let x = 0, y_idx = ring.length - 1; x < ring.length; y_idx = x++) {
          let p1 = ring[x]
          let p2 = ring[y_idx]
          if ((p1[1] <= lat && p2[1] > lat) || (p2[1] <= lat && p1[1] > lat)) {
            let t = (lat - p1[1])/(p2[1] - p1[1])
            let lng = p1[0] + t*(p2[0] - p1[0])
            intersections.push(lng)
          }
        }
      }

      if (intersections.length < 2)
        continue
      intersections.sort((arg0_a, arg0_b) => arg0_a - arg0_b)

      for (let k = 0; k < intersections.length - 1; k += 2) {
        let c_end = Math.min(w - 1, Math.ceil(((intersections[k + 1] + 180)/360)*w))
        let c_start = Math.max(0, Math.floor(((intersections[k] + 180)/360)*w))
        if (c_start <= c_end)
          spans.push({ c_end, c_start, row: r })
      }
    }
  }

  //Return statement
  return spans
}

/**
 * Sums all valid positive cell values over the entire raster grid.
 *
 * @param {Float32Array} arg0_data
 *
 * @returns {number}
 */
export function sumGlobalRaster (arg0_data: Float32Array): number {
  //Convert from parameters
  let data = arg0_data

  //Declare local instance variables
  let sum = 0

  //Function body
  for (let i = 0; i < data.length; i++) {
    let v = data[i]
    if (v > 0 && v < 1e12)
      sum += v
  }

  //Return statement
  return sum
}

/**
 * Sums all valid positive cell values across precomputed scanline spans.
 *
 * @param {ScanlineSpan[]} arg0_spans
 * @param {Float32Array} arg1_data
 * @param {number} [arg2_w=RASTER_WIDTH]
 *
 * @returns {number}
 */
export function sumRasterSpans (
  arg0_spans: ScanlineSpan[],
  arg1_data: Float32Array,
  arg2_w = RASTER_WIDTH
): number {
  //Convert from parameters
  let data = arg1_data
  let spans = arg0_spans
  let w = arg2_w

  //Declare local instance variables
  let sum = 0

  //Function body
  for (let i = 0; i < spans.length; i++) {
    let span = spans[i]
    let row_offset = span.row*w
    for (let c = span.c_start; c <= span.c_end; c++) {
      let v = data[row_offset + c]
      if (v > 0 && v < 1e12)
        sum += v
    }
  }

  //Return statement
  return sum
}
