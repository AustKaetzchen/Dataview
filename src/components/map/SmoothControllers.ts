import { MapController, OrbitController, _GlobeController } from '@deck.gl/core'

// Retrieve underlying ControllerState classes
const dummyMap = new MapController({} as any)
const BaseMapState = (dummyMap as any).ControllerState

const dummyOrbit = new OrbitController({} as any)
const BaseOrbitState = (dummyOrbit as any).ControllerState

const dummyGlobe = new _GlobeController({} as any)
const BaseGlobeState = (dummyGlobe as any).ControllerState

/**
 * SmoothMapState overrides default deck.gl MapState rotation logic.
 * Default deck.gl MapState uses an erratic, startY-dependent formula that causes
 * wild jumps when dragging near the screen top and 7x slower response near the bottom.
 * SmoothMapState uses linear, height-normalized sensitivity so pitch feels
 * buttery smooth and predictable anywhere on the screen.
 */
class SmoothMapState extends BaseMapState {
  _getNewRotation(
    pos: [number, number],
    startPos: [number, number],
    startPitch: number,
    startBearing: number
  ): { pitch: number; bearing: number } {
    const deltaX = pos[0] - startPos[0]
    const deltaY = pos[1] - startPos[1]
    const { width, height } = this.getViewportProps()
    const { minPitch = 0, maxPitch = 85 } = this.getViewportProps()

    // Smooth linear bearing rotation
    const bearing = startBearing + (deltaX / width) * 180

    // Smooth linear pitch: Dragging UP (-deltaY) tilts camera into 3D (increases pitch).
    // Dragging DOWN (+deltaY) flattens camera down towards 0°.
    const pitchDelta = (-deltaY / (height * 0.5)) * 60
    const pitch = Math.max(minPitch, Math.min(maxPitch, startPitch + pitchDelta))

    return { pitch, bearing }
  }
}

/**
 * SmoothMapController ensures Ctrl + Left Drag (and Right-click Drag) rotates/pitches,
 * while regular Left Drag pans. Shift + Drag no longer hijacks camera pitch.
 */
export class SmoothMapController extends MapController {
  // @ts-ignore
  ControllerState = SmoothMapState
  dragMode = 'pan' as const

  isFunctionKeyPressed(event: any): boolean {
    const src = event.srcEvent
    return Boolean(src?.ctrlKey || src?.metaKey)
  }
}

/**
 * SmoothOrbitState provides unified linear tilt and rotation for OrbitView
 * (Equirectangular and EqualEarth projections), matching the MapView feel.
 */
class SmoothOrbitState extends BaseOrbitState {
  rotate({ pos, deltaAngleX = 0, deltaAngleY = 0 }: any): any {
    const { startRotatePos, startRotationX, startRotationOrbit } = this.getState()
    const { width, height } = this.getViewportProps()
    const { minRotationX = -85, maxRotationX = 0 } = this.getViewportProps()

    if (!startRotatePos || startRotationX === undefined || startRotationOrbit === undefined) {
      return this
    }

    if (pos) {
      const deltaX = pos[0] - startRotatePos[0]
      const deltaY = pos[1] - startRotatePos[1]

      const deltaScaleX = deltaX / width
      // In OrbitView (Cartesian), negative rotationX tilts camera UP into 3D perspective
      // (North recedes into the distance, relief points upwards towards the sky).
      // Dragging mouse UP (-deltaY) tilts UP (more negative, down towards -85°).
      // Dragging mouse DOWN (+deltaY) flattens camera back down (up towards 0°, clamped at 0°).
      // This guarantees the camera can only pitch UP (or rotate to the side), never pitch down into the ground!
      const tiltDelta = (deltaY / (height * 0.5)) * 60
      const rotationX = Math.max(minRotationX, Math.min(maxRotationX, startRotationX + tiltDelta))
      const rotationOrbit = startRotationOrbit + deltaScaleX * 180

      return this._getUpdatedState({ rotationX, rotationOrbit })
    }

    return this._getUpdatedState({
      rotationX: Math.max(minRotationX, Math.min(maxRotationX, startRotationX + deltaAngleY)),
      rotationOrbit: startRotationOrbit + deltaAngleX,
    })
  }
}

/**
 * SmoothOrbitController enables normal Left Drag panning and Ctrl + Left Drag pitching
 * on Cartesian projections (Equirectangular & EqualEarth).
 */
export class SmoothOrbitController extends OrbitController {
  // @ts-ignore
  ControllerState = SmoothOrbitState
  dragMode = 'pan' as const

  isFunctionKeyPressed(event: any): boolean {
    const src = event.srcEvent
    return Boolean(src?.ctrlKey || src?.metaKey)
  }
}

/**
 * SmoothGlobeState provides linear pitch and rotation for GlobeView.
 */
class SmoothGlobeState extends BaseGlobeState {
  _getNewRotation(
    pos: [number, number],
    startPos: [number, number],
    startPitch: number,
    startBearing: number
  ): { pitch: number; bearing: number } {
    const deltaX = pos[0] - startPos[0]
    const deltaY = pos[1] - startPos[1]
    const { width, height } = this.getViewportProps()
    const { minPitch = 0, maxPitch = 85 } = this.getViewportProps()

    const bearing = startBearing + (deltaX / width) * 180
    const pitchDelta = (-deltaY / (height * 0.5)) * 60
    const pitch = Math.max(minPitch, Math.min(maxPitch, startPitch + pitchDelta))

    return { pitch, bearing }
  }
}

/**
 * SmoothGlobeController for Globe projection.
 */
export class SmoothGlobeController extends _GlobeController {
  // @ts-ignore
  ControllerState = SmoothGlobeState
  dragMode = 'pan' as const

  isFunctionKeyPressed(event: any): boolean {
    const src = event.srcEvent
    return Boolean(src?.ctrlKey || src?.metaKey)
  }
}
