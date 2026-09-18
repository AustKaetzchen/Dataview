/**
 * Shared utility functions for Deck.gl smooth map, globe, and orbit controllers.
 */

let smooth_pinch_state: {
  gesture_mode: 'undetermined' | 'pitch' | 'zoom_rotate'
  last_event: any
  start_center: [number, number] | null
  start_dist: number
  start_p0: { x: number; y: number } | null
  start_p1: { x: number; y: number } | null
  start_rotation: number | null
} = {
  gesture_mode: 'undetermined',
  last_event: null,
  start_center: null,
  start_dist: 0,
  start_p0: null,
  start_p1: null,
  start_rotation: null,
}

/**
 * Extracts the first two touch pointer client coordinates from a gesture event.
 *
 * @param {any} arg0_event
 *
 * @returns {Array<{ x: number; y: number }> | null}
 */
function extractTouchPoints (arg0_event: any): Array<{ x: number; y: number }> | null {
  //Convert from parameters
  let event = arg0_event

  //Declare local instance variables
  let src: any

  //Guard clauses
  if (!event)
    return null

  //Function body
  src = event.srcEvent
  if (event.pointers && event.pointers.length >= 2) {
    //Return statement
    return [
      { x: event.pointers[0].clientX, y: event.pointers[0].clientY },
      { x: event.pointers[1].clientX, y: event.pointers[1].clientY },
    ]
  }

  if (src && src.touches && src.touches.length >= 2) {
    //Return statement
    return [
      { x: src.touches[0].clientX, y: src.touches[0].clientY },
      { x: src.touches[1].clientX, y: src.touches[1].clientY },
    ]
  }

  //Return statement
  return null
}

/**
 * Handles pinch move event allowing two-finger vertical dragging to control camera tilt in place,
 * while preserving standard natural pinch-to-zoom and twist-to-rotate sensitivity.
 *
 * @param {any} arg0_controller
 * @param {any} arg1_event
 *
 * @returns {boolean}
 */
export function handleSmoothPinch (arg0_controller: any, arg1_event: any): boolean {
  //Convert from parameters
  let controller = arg0_controller
  let event = arg1_event

  //Declare local instance variables
  let avg_dy = 0
  let current_dist = 0
  let delta_angle_x = 0
  let delta_angle_y = 0
  let delta_dist = 0
  let delta_rot = 0
  let delta_scale = 0
  let dx0 = 0
  let dx1 = 0
  let dy0 = 0
  let dy1 = 0
  let is_parallel_vertical = false
  let new_controller_state: any
  let pos: [number, number]
  let touch_pts: Array<{ x: number; y: number }> | null
  let viewport_height: number
  let viewport_props: any

  //Guard clauses
  if (!controller || !event)
    return false
  if (!controller.touchZoom && !controller.touchRotate)
    return false
  if (!controller.isDragging())
    return false

  //Function body
  new_controller_state = controller.controllerState
  pos = controller.getCenter(event)
  touch_pts = extractTouchPoints(event)

  //1. Determine gesture mode if undetermined (Google Maps/Earth mobile gesture classification)
  if (smooth_pinch_state.gesture_mode === 'undetermined') {
    delta_scale = Math.abs((event.scale || 1) - 1)
    delta_rot = Math.abs((event.rotation || 0) - (smooth_pinch_state.start_rotation || 0))

    if (touch_pts && touch_pts.length >= 2 && smooth_pinch_state.start_p0 && smooth_pinch_state.start_p1) {
      dx0 = touch_pts[0].x - smooth_pinch_state.start_p0.x
      dy0 = touch_pts[0].y - smooth_pinch_state.start_p0.y
      dx1 = touch_pts[1].x - smooth_pinch_state.start_p1.x
      dy1 = touch_pts[1].y - smooth_pinch_state.start_p1.y
      current_dist = Math.hypot(touch_pts[1].x - touch_pts[0].x, touch_pts[1].y - touch_pts[0].y)
      delta_dist = Math.abs(current_dist - smooth_pinch_state.start_dist)
      avg_dy = (dy0 + dy1)/2

      //Check if both touches are moving in parallel in the same vertical direction
      is_parallel_vertical = (dy0*dy1 > 0) &&
        (Math.abs(dy0) > Math.abs(dx0)*0.6) &&
        (Math.abs(dy1) > Math.abs(dx1)*0.6)

      if (is_parallel_vertical && Math.abs(avg_dy) > 10 && delta_dist < Math.abs(avg_dy)*0.7 && delta_rot < 20) {
        smooth_pinch_state.gesture_mode = 'pitch'
      } else if (delta_scale > 0.05 || delta_dist > 14 || delta_rot > 15) {
        smooth_pinch_state.gesture_mode = 'zoom_rotate'
      }
    } else {
      //Fallback for events without discrete pointer arrays
      if (smooth_pinch_state.start_center) {
        avg_dy = pos[1] - smooth_pinch_state.start_center[1]
        if (Math.abs(avg_dy) > 12 && delta_scale < 0.06 && delta_rot < 15) {
          smooth_pinch_state.gesture_mode = 'pitch'
        } else if (delta_scale > 0.05 || delta_rot > 15) {
          smooth_pinch_state.gesture_mode = 'zoom_rotate'
        }
      }
    }
  }

  //2. Execute gesture based on determined mode
  if (smooth_pinch_state.gesture_mode === 'pitch') {
    //Mode: PITCH IN PLACE (two fingers dragging vertically)
    if (touch_pts && touch_pts.length >= 2 && smooth_pinch_state.start_p0 && smooth_pinch_state.start_p1) {
      dy0 = touch_pts[0].y - smooth_pinch_state.start_p0.y
      dy1 = touch_pts[1].y - smooth_pinch_state.start_p1.y
      avg_dy = (dy0 + dy1)/2
    } else if (smooth_pinch_state.start_center) {
      avg_dy = pos[1] - smooth_pinch_state.start_center[1]
    }

    viewport_props = controller.controllerState.getViewportProps()
    viewport_height = viewport_props?.height || (typeof window !== 'undefined' ? window.innerHeight : 600)
    delta_angle_y = (-avg_dy/(viewport_height*0.4))*60

    //Ensure startRotateLngLat is null so rotation/pitch is strictly in place without panning or zooming
    new_controller_state = new_controller_state
      ._getUpdatedState({ startRotateLngLat: null })
      .rotate(
        { deltaAngleX: 0, deltaAngleY: delta_angle_y },
        controller._getConstraintContext('rotate', 'update')
      )

    controller.updateViewport(new_controller_state, { transitionDuration: 0 }, {
      isDragging: true,
      isPanning: false,
      isRotating: true,
      isZooming: false,
    })
  } else if (smooth_pinch_state.gesture_mode === 'zoom_rotate') {
    //Mode: STANDARD ZOOM & ROTATE (natural Deck.gl/Google Maps pinch zoom sensitivity)
    if (controller.touchZoom && event.scale !== undefined)
      new_controller_state = new_controller_state.zoom(
        { pos: controller.getZoomPosition(pos), scale: event.scale },
        controller._getConstraintContext('zoom', 'update')
      )

    if (controller.touchRotate && event.rotation !== undefined && smooth_pinch_state.start_rotation !== null) {
      delta_angle_x = smooth_pinch_state.start_rotation - event.rotation
      new_controller_state = new_controller_state.rotate(
        { deltaAngleX: delta_angle_x, deltaAngleY: 0 },
        controller._getConstraintContext('rotate', 'update')
      )
    }

    controller.updateViewport(new_controller_state, { transitionDuration: 0 }, {
      isDragging: true,
      isPanning: Boolean(controller.touchZoom),
      isRotating: Boolean(controller.touchRotate),
      isZooming: Boolean(controller.touchZoom),
    })
  }

  smooth_pinch_state.last_event = event

  //Return statement
  return true
}

/**
 * Handles pinch end event, finalising zoom and rotate transitions.
 *
 * @param {any} arg0_controller
 * @param {any} arg1_event
 *
 * @returns {boolean}
 */
export function handleSmoothPinchEnd (arg0_controller: any, arg1_event: any): boolean {
  //Convert from parameters
  let controller = arg0_controller
  let event = arg1_event

  //Declare local instance variables
  let end_scale: number
  let last_event: any
  let new_controller_state: any
  let pos: [number, number]
  let velocity_z: number
  let z: number
  let zoom_position: [number, number]

  //Guard clauses
  if (!controller || !controller.isDragging()) {
    smooth_pinch_state.gesture_mode = 'undetermined'
    smooth_pinch_state.last_event = null
    smooth_pinch_state.start_center = null
    smooth_pinch_state.start_dist = 0
    smooth_pinch_state.start_p0 = null
    smooth_pinch_state.start_p1 = null
    smooth_pinch_state.start_rotation = null
    return false
  }

  //Function body
  last_event = smooth_pinch_state.last_event
  if (
    smooth_pinch_state.gesture_mode === 'zoom_rotate' &&
    controller.touchZoom &&
    controller.inertia &&
    last_event &&
    event &&
    event.scale !== last_event.scale
  ) {
    pos = controller.getCenter(event)
    zoom_position = controller.getZoomPosition(pos)
    new_controller_state = controller.controllerState.rotateEnd()
    z = Math.log2(event.scale)
    velocity_z = (z - Math.log2(last_event.scale))/(event.deltaTime - last_event.deltaTime)
    end_scale = Math.pow(2, z + (velocity_z*controller.inertia)/2)
    new_controller_state = new_controller_state.zoom({ pos: zoom_position, scale: end_scale }).zoomEnd()

    controller.updateViewport(
      new_controller_state,
      {
        ...controller._getTransitionProps({ around: zoom_position }),
        transitionDuration: controller.inertia,
      },
      {
        isDragging: false,
        isPanning: controller.touchZoom,
        isRotating: false,
        isZooming: controller.touchZoom,
      }
    )
  } else {
    new_controller_state = controller.controllerState.zoomEnd().rotateEnd()
    controller.updateViewport(new_controller_state, null, {
      isDragging: false,
      isPanning: false,
      isRotating: false,
      isZooming: false,
    })
  }

  //Block trailing single-finger pan events right after multi-touch ends
  if (typeof controller.blockEvents === 'function')
    controller.blockEvents(150)

  smooth_pinch_state.gesture_mode = 'undetermined'
  smooth_pinch_state.last_event = null
  smooth_pinch_state.start_center = null
  smooth_pinch_state.start_dist = 0
  smooth_pinch_state.start_p0 = null
  smooth_pinch_state.start_p1 = null
  smooth_pinch_state.start_rotation = null

  //Return statement
  return true
}

/**
 * Handles pinch start event for smooth two-finger gestures including tilt and rotation in place.
 *
 * @param {any} arg0_controller
 * @param {any} arg1_event
 *
 * @returns {boolean}
 */
export function handleSmoothPinchStart (arg0_controller: any, arg1_event: any): boolean {
  //Convert from parameters
  let controller = arg0_controller
  let event = arg1_event

  //Declare local instance variables
  let new_controller_state: any
  let pos: [number, number]
  let touch_pts: Array<{ x: number; y: number }> | null

  //Guard clauses
  if (!controller || !event)
    return false

  pos = controller.getCenter(event)
  if (!controller.isPointInBounds(pos, event))
    return false

  //Function body
  new_controller_state = controller.controllerState
    .zoomStart({ pos: controller.getZoomPosition(pos) }, controller._getConstraintContext('zoom', 'start'))
    .rotateStart({ pos }, controller._getConstraintContext('rotate', 'start'))

  touch_pts = extractTouchPoints(event)
  smooth_pinch_state.gesture_mode = 'undetermined'
  smooth_pinch_state.last_event = event
  smooth_pinch_state.start_center = pos
  smooth_pinch_state.start_rotation = event.rotation !== undefined ? event.rotation : 0

  if (touch_pts && touch_pts.length >= 2) {
    smooth_pinch_state.start_p0 = touch_pts[0]
    smooth_pinch_state.start_p1 = touch_pts[1]
    smooth_pinch_state.start_dist = Math.hypot(touch_pts[1].x - touch_pts[0].x, touch_pts[1].y - touch_pts[0].y)
  } else {
    smooth_pinch_state.start_p0 = null
    smooth_pinch_state.start_p1 = null
    smooth_pinch_state.start_dist = 0
  }

  controller.updateViewport(new_controller_state, { transitionDuration: 0 }, { isDragging: true })

  //Return statement
  return true
}

/**
 * Checks whether the modifier function key (Ctrl or Meta) is pressed on an input event.
 *
 * @param {any} arg0_event
 *
 * @returns {boolean}
 */
export function isFunctionKeyPressed (arg0_event: any): boolean {
  //Convert from parameters
  let event = arg0_event

  //Declare local instance variables
  let src = event?.srcEvent

  //Return statement
  return Boolean(src?.ctrlKey || src?.metaKey)
}

/**
 * Clears and resets all smooth pinch and two-finger gesture state.
 */
export function resetSmoothPinchState (): void {
  //Function body
  smooth_pinch_state.gesture_mode = 'undetermined'
  smooth_pinch_state.last_event = null
  smooth_pinch_state.start_center = null
  smooth_pinch_state.start_dist = 0
  smooth_pinch_state.start_p0 = null
  smooth_pinch_state.start_p1 = null
  smooth_pinch_state.start_rotation = null
}

