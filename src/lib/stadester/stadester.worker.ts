import { projectEqualEarth } from '../geopng/equalEarth'
import {
  computeViewportBoundingBox,
  getZoomPopulationThreshold,
  getEraDisplayFloor,
} from './stadesterHeuristics'

export interface WorkerCityInput {
  area?: number
  colour?: [number, number, number]
  coords: [number, number] // [lat, lon]
  country?: string
  density?: number
  growthRate?: number
  id: number | string
  key: string
  name: string
  other_names?: string | string[]
  population: number
  region?: string
}

export interface WorkerProcessedPoint {
  color: [number, number, number, number]
  country?: string
  key: string
  name: string
  pixelRadius: number
  population: number
  position: [number, number, number]
  shortName: string
}

export interface WorkerPlacedLabel {
  key: string
  name: string
  pixelRadius: number
  population: number
  position: [number, number, number]
  shortName: string
}

export type WorkerInMessage =
  | {
      cities: WorkerCityInput[]
      type: 'SET_DATA'
      year: number
    }
  | {
      bubbleSize: number
      colorMode: 'growth' | 'population' | 'continent'
      growthPalette: string
      isHalo: boolean
      labelCollision: boolean
      projection: string
      reqId: number
      showLabels: boolean
      type: 'LAYOUT_VIEWPORT'
      viewState: any
      windowH: number
      windowW: number
    }

export type WorkerOutMessage =
  | {
      labels: WorkerPlacedLabel[]
      points: WorkerProcessedPoint[]
      reqId: number
      type: 'LAYOUT_RESULT'
    }
  | {
      error: string
      reqId: number
      type: 'LAYOUT_ERROR'
    }

let current_cities: WorkerCityInput[] = []
let current_year = 1950

const RAINBOW_GROWTH_STOPS: Array<[number, [number, number, number]]> = [
  [0.08, [232, 121, 249]],
  [0.06, [239, 68, 68]],
  [0.03, [251, 146, 60]],
  [0.01, [253, 224, 71]],
  [0.00, [198, 219, 85]],
  [-0.02, [69, 207, 119]],
  [-0.04, [72, 156, 240]],
  [-0.05, [93, 96, 226]],
]

let REGION_COLOR_MAP: Record<string, [number, number, number]> = {
  africa: [249, 115, 22],
  central_asia: [168, 85, 247],
  eastasia: [239, 68, 68],
  europe: [99, 102, 241],
  latin_america: [16, 185, 129],
  middle_east: [234, 179, 8],
  northern_america: [14, 165, 233],
  oceania: [20, 184, 166],
  south_asia: [236, 72, 153],
  southeast_asia: [139, 92, 246],
}

import { getPaletteLUT } from '../geopng/palettes'
import { ColorPalette } from '../geopng/types'

function getGrowthRgb (arg0_rate: number, arg1_palette?: string): [number, number, number] {
  //Convert from parameters
  let palette = (arg1_palette) ? arg1_palette : 'Rainbow'
  let r = arg0_rate

  if (palette !== 'Rainbow') {
    try {
      let lut = getPaletteLUT(palette as ColorPalette)
      let norm_t = Math.max(0, Math.min(1, (r - (-0.05)) / (0.08 - (-0.05))))
      let lut_idx = Math.min(255, Math.max(0, Math.round(norm_t * 255)))
      return [lut[lut_idx * 3], lut[lut_idx * 3 + 1], lut[lut_idx * 3 + 2]]
    } catch (_err) {
      //Fallback to rainbow
    }
  }

  if (r >= RAINBOW_GROWTH_STOPS[0][0])
    return RAINBOW_GROWTH_STOPS[0][1]

  let last_idx = RAINBOW_GROWTH_STOPS.length - 1
  if (r <= RAINBOW_GROWTH_STOPS[last_idx][0])
    return RAINBOW_GROWTH_STOPS[last_idx][1]

  for (let i = 0; i < last_idx; i++) {
    let hi = RAINBOW_GROWTH_STOPS[i][0]
    let lo = RAINBOW_GROWTH_STOPS[i + 1][0]
    if (r <= hi && r >= lo) {
      let t = (hi === lo) ? 0 : (r - lo) / (hi - lo)
      let c_hi = RAINBOW_GROWTH_STOPS[i][1]
      let c_lo = RAINBOW_GROWTH_STOPS[i + 1][1]
      return [
        Math.round(c_lo[0] + t * (c_hi[0] - c_lo[0])),
        Math.round(c_lo[1] + t * (c_hi[1] - c_lo[1])),
        Math.round(c_lo[2] + t * (c_hi[2] - c_lo[2])),
      ]
    }
  }

  return RAINBOW_GROWTH_STOPS[4][1]
}

function getPopRgb (arg0_pop: number): [number, number, number] {
  let p = Math.max(1, arg0_pop)
  let t = Math.max(0, Math.min(1, (Math.log10(p) - 3.7) / 3.6))
  let r = Math.round(Math.min(255, 13 + t * 240))
  let g = Math.round(Math.min(255, 8 + t * 210))
  let b = Math.round(Math.max(0, 135 - t * 100))
  return [r, g, b]
}

function getShortCityLabel (arg0_name: string): string {
  if (!arg0_name)
    return ''
  let primary_name = arg0_name.split(';')[0].trim()
  return primary_name
}

self.onmessage = function (arg0_e: MessageEvent<WorkerInMessage>) {
  //Convert from parameters
  let e = arg0_e

  //Declare local instance variables
  let msg = e.data

  //Guard clauses
  if (!msg)
    return

  //Function body
  if (msg.type === 'SET_DATA') {
    current_cities = Array.isArray(msg.cities) ? msg.cities : []
    current_year = msg.year
    return
  }

  if (msg.type === 'LAYOUT_VIEWPORT') {
    let {
      bubbleSize: b_scale,
      colorMode: color_mode,
      isHalo: is_halo,
      labelCollision: is_collision_active,
      projection,
      reqId: req_id,
      showLabels: is_labels_visible,
      viewState: view_state,
      windowH: window_h,
      windowW: window_w,
    } = msg

    try {
      let is_cartesian = (projection === 'EqualEarth' || projection === 'Equirectangular')
      let zoom = view_state?.zoom ?? 1.2
      let thresholds = getZoomPopulationThreshold(zoom, projection)
      let era_floor = getEraDisplayFloor(current_year)
      let effective_min_pop = Math.max(thresholds.bubbleMinPop, era_floor)
      let bbox = computeViewportBoundingBox(view_state, projection, window_w, window_h)
      let [w, s, east_bound, n] = bbox

      let processed_points: WorkerProcessedPoint[] = []
      let label_candidates: WorkerProcessedPoint[] = []

      for (let i = 0; i < current_cities.length; i++) {
        let c = current_cities[i]
        let c_lat = c.coords[0]
        let c_lon = c.coords[1]

        //Viewport bounding box culling
        if (w <= east_bound) {
          if (c_lon < w || c_lon > east_bound || c_lat < s || c_lat > n)
            continue
        } else {
          //Wraparound dateline
          if ((c_lon < w && c_lon > east_bound) || c_lat < s || c_lat > n)
            continue
        }

        if (c.population < effective_min_pop)
          continue

        let fill_color: [number, number, number, number] = [255, 255, 255, 220]
        let px = c_lon
        let py = c_lat

        if (projection === 'EqualEarth') {
          let projected = projectEqualEarth(c_lon, c_lat)
          px = projected[0]
          py = projected[1]
        }

        let min_radius = 4.5 * b_scale
        let pop_radius = Math.sqrt(Math.max(0, c.population)) * 0.0115 * b_scale
        let pixel_radius = Math.max(min_radius, Math.min(65.0, min_radius + pop_radius))

        if (color_mode === 'growth') {
          let g_rate = (c.growthRate !== undefined) ? c.growthRate : 0
          let g_rgb = getGrowthRgb(g_rate, msg.growthPalette)
          fill_color = [g_rgb[0], g_rgb[1], g_rgb[2], 220]
        } else if (color_mode === 'population') {
          let p_rgb = getPopRgb(c.population)
          fill_color = [p_rgb[0], p_rgb[1], p_rgb[2], 220]
        } else if (color_mode === 'continent') {
          let reg_key = c.region || ''
          let reg_rgb = REGION_COLOR_MAP[reg_key] || [148, 163, 184]
          fill_color = [reg_rgb[0], reg_rgb[1], reg_rgb[2], 220]
        }

        let pt: WorkerProcessedPoint = {
          color: fill_color,
          country: c.country,
          key: c.key,
          name: c.name,
          pixelRadius: pixel_radius,
          population: c.population,
          position: [px, py, 0],
          shortName: getShortCityLabel(c.name),
        }

        processed_points.push(pt)

        if (c.population >= thresholds.labelMinPop)
          label_candidates.push(pt)

        if (processed_points.length >= thresholds.maxBubbles)
          break
      }

      //Place labels
      let placed_labels: WorkerPlacedLabel[] = []

      if (is_labels_visible && label_candidates.length > 0) {
        label_candidates.sort((arg0_a, arg0_b) => arg0_b.population - arg0_a.population)

        let placed_boxes: Array<[number, number, number, number]> = []
        let scale = Math.pow(2, zoom)

        for (let i = 0; i < label_candidates.length; i++) {
          let cand = label_candidates[i]
          let sx: number
          let sy: number

          if (is_cartesian) {
            let target = view_state?.target || [0, 0, 0]
            sx = window_w / 2 + (cand.position[0] - target[0]) * scale
            sy = window_h / 2 - (cand.position[1] - target[1]) * scale
          } else {
            let center_lat = view_state?.latitude ?? 20
            let center_lng = view_state?.longitude ?? 0
            let rad_factor = Math.PI / 180

            let x_norm = (cand.position[0] + 180) / 360
            let c_norm = (center_lng + 180) / 360
            sx = window_w / 2 + (x_norm - c_norm) * 512 * scale

            let lat_rad = Math.max(-85, Math.min(85, cand.position[1])) * rad_factor
            let c_lat_rad = Math.max(-85, Math.min(85, center_lat)) * rad_factor
            let y_proj = (1 - Math.log(Math.tan(Math.PI / 4 + lat_rad / 2)) / Math.PI) / 2
            let c_y_proj = (1 - Math.log(Math.tan(Math.PI / 4 + c_lat_rad / 2)) / Math.PI) / 2
            sy = window_h / 2 + (y_proj - c_y_proj) * 512 * scale
          }

          if (sx < -80 || sx > window_w + 80 || sy < -40 || sy > window_h + 40)
            continue

          let label_text = cand.shortName
          if (!label_text)
            continue

          let text_w = label_text.length * 7.2 + 12
          let text_h = 16
          let r = cand.pixelRadius

          let box_x1 = sx + r + 4
          let box_y1 = sy - text_h / 2
          let box_x2 = box_x1 + text_w
          let box_y2 = box_y1 + text_h

          if (is_collision_active) {
            let collides = false
            for (let b = 0; b < placed_boxes.length; b++) {
              let pb = placed_boxes[b]
              if (
                box_x1 < pb[2] + 4 &&
                box_x2 > pb[0] - 4 &&
                box_y1 < pb[3] + 2 &&
                box_y2 > pb[1] - 2
              ) {
                collides = true
                break
              }
            }
            if (collides)
              continue
          }

          placed_boxes.push([box_x1, box_y1, box_x2, box_y2])
          placed_labels.push({
            key: cand.key,
            name: cand.name,
            pixelRadius: cand.pixelRadius,
            population: cand.population,
            position: cand.position,
            shortName: cand.shortName,
          })

          if (placed_labels.length >= thresholds.maxLabels)
            break
        }
      }

      self.postMessage({
        labels: placed_labels,
        points: processed_points,
        reqId: req_id,
        type: 'LAYOUT_RESULT',
      } as WorkerOutMessage)
    } catch (arg0_err) {
      self.postMessage({
        error: arg0_err instanceof Error ? arg0_err.message : String(arg0_err),
        reqId: req_id,
        type: 'LAYOUT_ERROR',
      } as WorkerOutMessage)
    }
  }
}
