import { OrbitController } from '@deck.gl/core'

let dummy_orbit = new OrbitController({} as any)
let BaseOrbitState = (dummy_orbit as any).ControllerState

/**
 * SmoothOrbitState provides unified linear tilt and rotation for OrbitView.
 */
export class SmoothOrbitState extends BaseOrbitState {
  /**
   * Updates rotation angles based on position or angle deltas.
   *
   * @param {any} arg0_options
   *
   * @returns {any}
   */
  rotate (arg0_options: any): any {
    //Convert from parameters
    let options = (arg0_options) ? arg0_options : {}
    let { deltaAngleX: delta_angle_x = 0, deltaAngleY: delta_angle_y = 0, pos } = options

    //Declare local instance variables
    let delta_scale_x: number
    let delta_x: number
    let delta_y: number
    let rotation_orbit: number
    let rotation_x: number
    let state = this.getState()
    let { startRotatePos: start_rotate_pos, startRotationOrbit: start_rotation_orbit, startRotationX: start_rotation_x } = state
    let tilt_delta: number
    let viewport_props = this.getViewportProps()
    let { height, maxRotationX: max_rotation_x = 0, minRotationX: min_rotation_x = -85, width } = viewport_props

    //Guard clauses
    if (!start_rotate_pos || start_rotation_x === undefined || start_rotation_orbit === undefined)
      return this

    //Function body
    if (pos) {
      delta_x = pos[0] - start_rotate_pos[0]
      delta_y = pos[1] - start_rotate_pos[1]
      delta_scale_x = delta_x/width
      tilt_delta = (delta_y/(height*0.5))*60
      rotation_x = Math.max(min_rotation_x, Math.min(max_rotation_x, start_rotation_x + tilt_delta))
      rotation_orbit = start_rotation_orbit + delta_scale_x*180

      //Return statement
      return this._getUpdatedState({ rotationOrbit: rotation_orbit, rotationX: rotation_x })
    }

    //Return statement
    return this._getUpdatedState({
      rotationOrbit: start_rotation_orbit + delta_angle_x,
      rotationX: Math.max(min_rotation_x, Math.min(max_rotation_x, start_rotation_x + delta_angle_y)),
    })
  }
}

export default SmoothOrbitState
