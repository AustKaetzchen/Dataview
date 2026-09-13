import { _GlobeController } from '@deck.gl/core'
import { SmoothGlobeState } from './SmoothGlobeState'

/**
 * SmoothGlobeController for Globe projection with Google Earth style navigation.
 */
export class SmoothGlobeController extends _GlobeController {
  // @ts-ignore
  ControllerState = SmoothGlobeState
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

  /**
   * Handles pan move event.
   *
   * @param {any} arg0_event
   *
   * @returns {boolean}
   */
  protected _onPanMove (arg0_event: any): boolean {
    //Convert from parameters
    let event = arg0_event

    //Guard clauses
    if (!this.dragPan)
      return false

    //Declare local instance variables
    let new_controller_state: any
    let pos = this.getCenter(event)

    //Function body
    new_controller_state = this.controllerState.pan({ pos })
    this.updateViewport(
      new_controller_state,
      { transitionDuration: 0 },
      {
        isDragging: true,
        isPanning: true,
      }
    )

    //Return statement
    return true
  }

  /**
   * Handles pan move end event.
   *
   * @param {any} _arg0_event
   *
   * @returns {boolean}
   */
  protected _onPanMoveEnd (_arg0_event: any): boolean {
    //Declare local instance variables
    let new_controller_state = this.controllerState.panEnd()

    //Function body
    this.updateViewport(new_controller_state, null, {
      isDragging: false,
      isPanning: false,
    })

    //Return statement
    return true
  }
}

export default SmoothGlobeController
