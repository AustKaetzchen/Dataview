import { MapController } from '@deck.gl/core'

let dummy_map = new MapController({} as any)
let BaseMapState = (dummy_map as any).ControllerState

/**
 * SmoothMapState overrides default deck.gl MapState rotation logic.
 */
export class SmoothMapState extends BaseMapState {
  /**
   * Calculates new pitch and bearing from drag offsets.
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
}

export default SmoothMapState
