import { BitmapLayer } from '@deck.gl/layers'
import { lngLatToWorld } from '@math.gl/web-mercator'

/**
 * BitmapLayer performing coordinate conversion for warped Mercator tiles.
 */
export class WarpedTileBitmapLayer extends BitmapLayer {
  static layerName = 'WarpedTileBitmapLayer'

  /**
   * Generates coordinate transformation uniforms for planar texture projection.
   * @returns {Object}
   */
  _getCoordinateUniforms () {
    //Declare local instance variables
    let bottom_left: [number, number]
    let bounds = (this.props as any).bounds
    let east: number
    let north: number
    let south: number
    let top_right: [number, number]
    let west: number

    //Function body
    west = bounds[0]
    south = Math.max(-85.051128, bounds[1])
    east = bounds[2]
    north = Math.min(85.051128, bounds[3])

    bottom_left = lngLatToWorld([west, south])
    top_right = lngLatToWorld([east, north])

    //Return statement
    return {
      coordinateConversion: 1,
      bounds: [bottom_left[0], bottom_left[1], top_right[0], top_right[1]],
    }
  }
}
