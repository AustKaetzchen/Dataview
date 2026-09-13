import { MapController } from '@deck.gl/core'
import { SmoothMapState } from './SmoothMapState'

/**
 * SmoothMapController ensures Ctrl + Left Drag rotates/pitches while Left Drag pans.
 */
export class SmoothMapController extends MapController {
  // @ts-ignore
  ControllerState = SmoothMapState
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

export default SmoothMapController
