import { _GlobeController } from '@deck.gl/core'
import { zoomAdjust } from './SmoothGlobeViewport'

let dummy_globe = new _GlobeController({} as any)
let BaseGlobeState = (dummy_globe as any).ControllerState

/**
 * SmoothGlobeState provides Google Earth style globe panning with polar-axis rotation and stable bearing.
 */
export class SmoothGlobeState extends BaseGlobeState {
  constructor (arg0_options: any) {
    //Convert from parameters
    let options = arg0_options
    super(options)

    //Declare local instance variables
    let s = (this as any)._state

    //Function body
    if (options.startPanPos !== undefined)
      s.startPanPos = options.startPanPos
    if (options.startPanLng !== undefined)
      s.startPanLng = options.startPanLng
    if (options.startPanLat !== undefined)
      s.startPanLat = options.startPanLat
    if (options.startPanBearing !== undefined)
      s.startPanBearing = options.startPanBearing
    if (options.startPanZoom !== undefined)
      s.startPanZoom = options.startPanZoom
    if (options.lastPanLng !== undefined)
      s.lastPanLng = options.lastPanLng
    if (options.lastPanLat !== undefined)
      s.lastPanLat = options.lastPanLat
  }

  /**
   * Constrains zoom within min/max bounds.
   *
   * @param {number} arg0_zoom
   * @param {any} [arg1_props]
   *
   * @returns {number}
   */
  _constrainZoom (arg0_zoom: number, arg1_props?: any): number {
    //Convert from parameters
    let props = arg1_props
    let zoom = arg0_zoom

    //Declare local instance variables
    let p = props || this.getViewportProps()
    let { maxZoom: max_zoom = 18, minZoom: min_zoom = 0 } = p

    //Return statement
    return Math.max(min_zoom, Math.min(max_zoom, zoom))
  }

  /**
   * Computes smooth linear pitch and bearing rotation.
   *
   * @param {[number, number]} arg0_pos
   * @param {[number, number]} arg1_start_pos
   * @param {number} arg2_start_pitch
   * @param {number} arg3_start_bearing
   *
   * @returns {{ pitch: number; bearing: number }}
   */
  _getNewRotation (
    arg0_pos: [number, number],
    arg1_start_pos: [number, number],
    arg2_start_pitch: number,
    arg3_start_bearing: number
  ): { pitch: number; bearing: number } {
    //Convert from parameters
    let pos = arg0_pos
    let start_bearing = arg3_start_bearing
    let start_pitch = arg2_start_pitch
    let start_pos = arg1_start_pos

    //Declare local instance variables
    let bearing: number
    let delta_x = pos[0] - start_pos[0]
    let delta_y = pos[1] - start_pos[1]
    let pitch: number
    let pitch_delta: number
    let viewport_props = this.getViewportProps()
    let { height, maxPitch: max_pitch = 85, minPitch: min_pitch = 0, width } = viewport_props

    //Function body
    bearing = start_bearing + (delta_x/width)*180
    pitch_delta = (-delta_y/(height*0.5))*60
    pitch = Math.max(min_pitch, Math.min(max_pitch, start_pitch + pitch_delta))

    //Return statement
    return { bearing, pitch }
  }

  /**
   * Begins panning gesture.
   *
   * @param {{ pos: [number, number] }} arg0_options
   *
   * @returns {any}
   */
  panStart (arg0_options: { pos: [number, number] }): any {
    //Convert from parameters
    let options = arg0_options
    let { pos } = options

    //Declare local instance variables
    let viewport_props = this.getViewportProps()
    let { bearing = 0, latitude, longitude, zoom } = viewport_props

    //Return statement
    return this._getUpdatedState({
      lastPanLat: latitude,
      lastPanLng: longitude,
      startPanBearing: bearing,
      startPanLat: latitude,
      startPanLng: longitude,
      startPanPos: pos,
      startPanZoom: zoom,
    })
  }

  /**
   * Performs continuous globe pan update with ground tracking.
   *
   * @param {{ pos: [number, number]; startPos?: [number, number] }} arg0_options
   *
   * @returns {any}
   */
  pan (arg0_options: { pos: [number, number]; startPos?: [number, number] }): any {
    //Convert from parameters
    let options = arg0_options
    let { pos, startPos: start_pos } = options

    //Declare local instance variables
    let b_rad: number
    let cos_b: number
    let cos_lat: number
    let delta_lat: number
    let delta_lng: number
    let drag_east: number
    let drag_north: number
    let dx: number
    let dy: number
    let lat_rad: number
    let latitude: number
    let longitude: number
    let origin: [number, number] | undefined
    let rotation_speed: number
    let scale: number
    let sin_b: number
    let start_bearing: number
    let start_lat: number
    let start_lng: number
    let start_zoom: number
    let state = this.getState() as any
    let viewport_props = this.getViewportProps()

    //Guard clauses
    origin = state.startPanPos || start_pos
    if (!origin)
      return this

    //Function body
    start_lng = state.startPanLng ?? viewport_props.longitude
    start_lat = state.startPanLat ?? viewport_props.latitude
    start_bearing = state.startPanBearing ?? (viewport_props.bearing || 0)
    start_zoom = state.startPanZoom ?? viewport_props.zoom

    dx = pos[0] - origin[0]
    dy = pos[1] - origin[1]

    scale = Math.pow(2, start_zoom - zoomAdjust(0, true))
    rotation_speed = 0.2238/scale

    b_rad = (start_bearing*Math.PI)/180
    cos_b = Math.cos(b_rad)
    sin_b = Math.sin(b_rad)

    drag_east = dx*cos_b - dy*sin_b
    drag_north = dx*sin_b + dy*cos_b

    delta_lat = drag_north*rotation_speed
    latitude = Math.max(-85, Math.min(85, start_lat + delta_lat))

    lat_rad = (latitude*Math.PI)/180
    cos_lat = Math.max(0.15, Math.cos(lat_rad))
    delta_lng = -(drag_east*rotation_speed)/cos_lat

    longitude = start_lng + delta_lng
    longitude = ((longitude + 180)%360 + 360)%360 - 180

    //Return statement
    return this._getUpdatedState({
      bearing: start_bearing,
      lastPanLat: latitude,
      lastPanLng: longitude,
      latitude,
      longitude,
      zoom: start_zoom,
    })
  }

  /**
   * Finalises pan gesture.
   *
   * @returns {any}
   */
  panEnd (): any {
    //Declare local instance variables
    let bearing: number
    let latitude: number
    let longitude: number
    let state = this.getState() as any
    let viewport_props = this.getViewportProps()
    let zoom: number

    //Function body
    longitude = state.lastPanLng ?? viewport_props.longitude
    latitude = state.lastPanLat ?? viewport_props.latitude
    bearing = state.startPanBearing ?? (viewport_props.bearing || 0)
    zoom = state.startPanZoom ?? viewport_props.zoom

    //Return statement
    return this._getUpdatedState({
      bearing,
      lastPanLat: null,
      lastPanLng: null,
      latitude,
      longitude,
      startPanBearing: null,
      startPanLat: null,
      startPanLng: null,
      startPanPos: null,
      startPanZoom: null,
      zoom,
    })
  }
}

export default SmoothGlobeState
