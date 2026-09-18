import { _GlobeViewport } from '@deck.gl/core'

let MAX_LATITUDE = 89.9

/**
 * Calculates latitude-dependent scale adjustment to normalise globe size.
 *
 * @param {number} arg0_latitude
 * @param {boolean} [arg1_clamp_to_poles=false]
 *
 * @returns {number}
 */
export function zoomAdjust (arg0_latitude: number, arg1_clamp_to_poles?: boolean): number {
  //Convert from parameters
  let clamp_to_poles = (arg1_clamp_to_poles) ? arg1_clamp_to_poles : false
  let latitude = arg0_latitude

  //Declare local instance variables
  let scale_adjust: number

  //Function body
  if (clamp_to_poles)
    latitude = Math.max(Math.min(latitude, MAX_LATITUDE), -MAX_LATITUDE)

  scale_adjust = Math.PI*Math.cos((latitude*Math.PI)/180)

  //Return statement
  return Math.log2(Math.max(0.0001, scale_adjust))
}

/**
 * SmoothGlobeViewport eliminates deck.gl's latitude-dependent Mercator distance distortion.
 */
export class SmoothGlobeViewport extends _GlobeViewport {
  constructor (arg0_options: any = {}) {
    //Convert from parameters
    let options = (arg0_options) ? arg0_options : {}

    //Declare local instance variables
    let lat = options.latitude ?? 0
    let lat_adjust = zoomAdjust(lat, true) - zoomAdjust(0, true)

    super({
      ...options,
      zoom: (options.zoom ?? 0) + lat_adjust,
    })

    //Restore clean, unadjusted zoom on the viewport instance
    this.zoom = options.zoom ?? 0
  }
}

export default SmoothGlobeViewport
