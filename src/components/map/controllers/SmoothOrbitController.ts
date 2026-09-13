import { OrbitController } from '@deck.gl/core'
import { SmoothOrbitState } from './SmoothOrbitState'

/**
 * SmoothOrbitController enables normal Left Drag panning and Ctrl + Left Drag pitching on Cartesian projections.
 */
export class SmoothOrbitController extends OrbitController {
  // @ts-ignore
  ControllerState = SmoothOrbitState
  dragMode = 'pan' as const

  /**
   * Checks whether the function key (Ctrl or Meta) is pressed.
   *
   * @param {any} arg0_event
   *
   * @returns {boolean}
   */
  isFunctionKeyPressed (arg0_event: any): boolean {
    //Convert from parameters
    let event = arg0_event

    //Declare local instance variables
    let src = event.srcEvent

    //Return statement
    return Boolean(src?.ctrlKey || src?.metaKey)
  }
}

export default SmoothOrbitController
