import {
  MapController,
  OrbitController,
  _GlobeController,
  _GlobeViewport,
  _GlobeView,
} from '@deck.gl/core'

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

const MAX_LATITUDE = 89.9

function zoomAdjust(latitude: number, clampToPoles?: boolean): number {
  if (clampToPoles) {
    latitude = Math.max(Math.min(latitude, MAX_LATITUDE), -MAX_LATITUDE)
  }
  const scaleAdjust = Math.PI * Math.cos((latitude * Math.PI) / 180)
  return Math.log2(Math.max(0.0001, scaleAdjust))
}

/**
 * SmoothGlobeViewport eliminates deck.gl's latitude-dependent Mercator distance distortion.
 * In default deck.gl GlobeViewport, scale = Math.pow(2, zoom - zoomAdjust(scaleLatitude)),
 * which causes the globe to balloon by 1 / cos(latitude) when looking at higher latitudes.
 * By adjusting the zoom passed to super by (zoomAdjust(latitude, true) - zoomAdjust(0, true)),
 * the internal scale calculation cancels out the latitude term, resulting in:
 * scale = Math.pow(2, zoom - zoomAdjust(0, true))
 * This ensures the 3D globe diameter and camera distance remain 100% constant regardless of latitude,
 * exactly like Google Earth!
 */
export class SmoothGlobeViewport extends _GlobeViewport {
  constructor(opts: any = {}) {
    const lat = opts.latitude ?? 0
    const latAdjust = zoomAdjust(lat, true) - zoomAdjust(0, true)
    super({
      ...opts,
      zoom: (opts.zoom ?? 0) + latAdjust,
    })
    // Restore clean, unadjusted zoom on the viewport instance
    this.zoom = opts.zoom ?? 0
  }
}

/**
 * SmoothGlobeView ensures deck.gl uses SmoothGlobeViewport for rendering and projection.
 */
export class SmoothGlobeView extends _GlobeView {
  getViewportType() {
    return SmoothGlobeViewport
  }
}

/**
 * SmoothGlobeState provides Google Earth style globe panning:
 * - Natural spherical spin around Earth's polar axis (East-West)
 * - Meridian tilt (North-South) with pole clamping
 * - Preserved stable camera bearing during pan (no horizon twist)
 * - Invariant camera zoom (no ballooning or zoom changing during pan)
 * - Linear pitch/rotation when holding Ctrl + Left Click (or Right-click drag)
 */
class SmoothGlobeState extends BaseGlobeState {
  constructor(options: any) {
    super(options)
    const s = (this as any)._state
    if (options.startPanPos !== undefined) s.startPanPos = options.startPanPos
    if (options.startPanLng !== undefined) s.startPanLng = options.startPanLng
    if (options.startPanLat !== undefined) s.startPanLat = options.startPanLat
    if (options.startPanBearing !== undefined) s.startPanBearing = options.startPanBearing
    if (options.startPanZoom !== undefined) s.startPanZoom = options.startPanZoom
    if (options.lastPanLng !== undefined) s.lastPanLng = options.lastPanLng
    if (options.lastPanLat !== undefined) s.lastPanLat = options.lastPanLat
  }

  _constrainZoom(zoom: number, props?: any): number {
    const p = props || this.getViewportProps()
    const { minZoom = 0, maxZoom = 18 } = p
    return Math.max(minZoom, Math.min(maxZoom, zoom))
  }

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

  panStart({ pos }: { pos: [number, number] }): any {
    const { latitude, longitude, zoom, bearing = 0 } = this.getViewportProps()
    return this._getUpdatedState({
      startPanPos: pos,
      startPanLng: longitude,
      startPanLat: latitude,
      startPanBearing: bearing,
      startPanZoom: zoom,
      lastPanLng: longitude,
      lastPanLat: latitude,
    })
  }

  pan({ pos, startPos }: { pos: [number, number]; startPos?: [number, number] }): any {
    const state = this.getState() as any
    const origin = state.startPanPos || startPos
    if (!origin) return this

    const startLng = state.startPanLng ?? this.getViewportProps().longitude
    const startLat = state.startPanLat ?? this.getViewportProps().latitude
    const startBearing = state.startPanBearing ?? (this.getViewportProps().bearing || 0)
    const startZoom = state.startPanZoom ?? this.getViewportProps().zoom

    const dx = pos[0] - origin[0]
    const dy = pos[1] - origin[1]

    // Scale rotation speed inversely with zoom for 1:1 screen pixel tracking
    const scale = Math.pow(2, startZoom - zoomAdjust(0, true))
    const rotationSpeed = 0.2238 / scale

    // Rotate screen drag vector by camera bearing
    const bRad = (startBearing * Math.PI) / 180
    const cosB = Math.cos(bRad)
    const sinB = Math.sin(bRad)

    const dragEast = dx * cosB - dy * sinB
    const dragNorth = dx * sinB + dy * cosB

    // Delta latitude: dragging down tilts northern hemisphere into center
    const deltaLat = dragNorth * rotationSpeed
    const latitude = Math.max(-85, Math.min(85, startLat + deltaLat))

    // Delta longitude: scaled by 1 / cos(lat) to maintain 1:1 ground tracking
    const latRad = (latitude * Math.PI) / 180
    const cosLat = Math.max(0.15, Math.cos(latRad))
    const deltaLng = -(dragEast * rotationSpeed) / cosLat

    let longitude = startLng + deltaLng
    while (longitude > 180) longitude -= 360
    while (longitude < -180) longitude += 360

    return this._getUpdatedState({
      longitude,
      latitude,
      bearing: startBearing, // Bearing is invariant during normal left drag!
      zoom: startZoom,
      lastPanLng: longitude,
      lastPanLat: latitude,
    })
  }

  panEnd(): any {
    const state = this.getState() as any
    const longitude = state.lastPanLng ?? this.getViewportProps().longitude
    const latitude = state.lastPanLat ?? this.getViewportProps().latitude
    const bearing = state.startPanBearing ?? (this.getViewportProps().bearing || 0)
    const zoom = state.startPanZoom ?? this.getViewportProps().zoom

    return this._getUpdatedState({
      longitude,
      latitude,
      bearing,
      zoom,
      startPanPos: null,
      startPanLng: null,
      startPanLat: null,
      startPanBearing: null,
      startPanZoom: null,
      lastPanLng: null,
      lastPanLat: null,
    })
  }
}

/**
 * SmoothGlobeController for Globe projection.
 * Works exactly like Google Earth:
 * - Left Click Drag spins/tilts the globe smoothly around the polar axis without twisting bearing or snapping back
 * - Ctrl + Left Drag (or Right-Click Drag) orbits pitch & bearing in 3D
 */
export class SmoothGlobeController extends _GlobeController {
  // @ts-ignore
  ControllerState = SmoothGlobeState
  dragMode = 'pan' as const

  isFunctionKeyPressed(event: any): boolean {
    const src = event.srcEvent
    return Boolean(src?.ctrlKey || src?.metaKey)
  }

  protected _onPanMove(event: any): boolean {
    if (!this.dragPan) {
      return false
    }
    const pos = this.getCenter(event)
    const newControllerState = this.controllerState.pan({ pos })
    this.updateViewport(
      newControllerState,
      { transitionDuration: 0 },
      {
        isDragging: true,
        isPanning: true,
      }
    )
    return true
  }

  protected _onPanMoveEnd(_event: any): boolean {
    const newControllerState = this.controllerState.panEnd()
    this.updateViewport(newControllerState, null, {
      isDragging: false,
      isPanning: false,
    })
    return true
  }
}

