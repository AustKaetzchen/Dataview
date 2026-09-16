import { _Tileset2D as Tileset2D } from '@deck.gl/geo-layers'

/**
 * Custom Tileset2D index calculation for Equirectangular projection.
 * Calculates standard Web Mercator tile indices mapped to equirectangular coordinates.
 */
export class EquirectangularTileset2D extends Tileset2D {
  /**
   * Calculates tile indices within the viewport.
   * @param {Object} arg0_options
   * @returns {Array}
   */
  getTileIndices (arg0_options: any) {
    //Convert from parameters
    let options = (arg0_options) ? arg0_options : {}

    //Declare local instance variables
    let br: [number, number]
    let calculated_z: number
    let indices_array: { x: number; y: number; z: number }[] = []
    let lat_to_y: (lat: number) => number
    let max_lat: number
    let max_lng: number
    let max_zoom: number = options.maxZoom ?? 18
    let min_lat: number
    let min_lng: number
    let min_zoom: number = options.minZoom ?? 0
    let n: number
    let pixels_per_degree: number
    let tl: [number, number]
    let viewport = options.viewport
    let world_width_pixels: number
    let x_max: number
    let x_min: number
    let y_max: number
    let y_min: number
    let z: number

    //Guard clauses
    if (!viewport || !viewport.unproject)
      return []

    //Function body
    tl = viewport.unproject([0, 0], { targetZ: 0 }) || [-180, 85]
    br = viewport.unproject([viewport.width, viewport.height], { targetZ: 0 }) || [180, -85]

    min_lng = Math.max(-180, Math.min(Number.isFinite(tl[0]) ? tl[0] : -180, Number.isFinite(br[0]) ? br[0] : 180))
    max_lng = Math.min(180, Math.max(Number.isFinite(tl[0]) ? tl[0] : -180, Number.isFinite(br[0]) ? br[0] : 180))
    min_lat = Math.max(-85.051128, Math.min(Number.isFinite(tl[1]) ? tl[1] : -85, Number.isFinite(br[1]) ? br[1] : 85))
    max_lat = Math.min(85.051128, Math.max(Number.isFinite(tl[1]) ? tl[1] : -85, Number.isFinite(br[1]) ? br[1] : 85))

    if (min_lng >= max_lng || min_lat >= max_lat)
      return []

    pixels_per_degree = Math.pow(2, viewport.zoom)
    world_width_pixels = 360*pixels_per_degree
    calculated_z = Math.round(Math.log2(world_width_pixels/256))
    z = Math.max(min_zoom, Math.min(max_zoom, Math.max(0, calculated_z)))

    n = Math.pow(2, z)
    x_min = Math.max(0, Math.min(n - 1, Math.floor(((min_lng + 180)/360)*n)))
    x_max = Math.max(0, Math.min(n - 1, Math.floor(((max_lng + 180)/360)*n)))

    lat_to_y = function (arg0_lat: number) {
      let lat = arg0_lat
      let clamped_lat = Math.max(-85.051128, Math.min(85.051128, lat))
      let rad = (clamped_lat*Math.PI)/180
      return Math.floor(((1 - Math.log(Math.tan(Math.PI/4 + rad/2))/Math.PI)/2)*n)
    }

    y_min = Math.max(0, Math.min(n - 1, lat_to_y(max_lat)))
    y_max = Math.max(0, Math.min(n - 1, lat_to_y(min_lat)))

    for (let i = x_min; i <= x_max; i++)
      for (let x = y_min; x <= y_max; x++)
        indices_array.push({ x: i, y: x, z })

    //Return statement
    return indices_array
  }

  /**
   * Retrieves tile bounding box metadata.
   * @param {Object} arg0_index
   * @returns {Object}
   */
  getTileMetadata (arg0_index: any) {
    //Convert from parameters
    let index = arg0_index

    //Declare local instance variables
    let east: number
    let n: number
    let north: number
    let south: number
    let west: number
    let x = index.x
    let y = index.y
    let y_to_lat: (arg0_idx: number) => number
    let z = index.z

    //Function body
    n = Math.pow(2, z)
    west = (x/n)*360 - 180
    east = ((x + 1)/n)*360 - 180

    y_to_lat = function (arg0_idx: number) {
      let idx = arg0_idx
      let rad = 2*Math.atan(Math.exp(Math.PI*(1 - (2*idx)/n))) - Math.PI/2
      return (rad*180)/Math.PI
    }

    north = y_to_lat(y)
    south = y_to_lat(y + 1)

    //Return statement
    return { bbox: { west, south, east, north } }
  }

  /**
   * Calculates the parent tile index.
   * @param {Object} arg0_index
   * @returns {Object}
   */
  getParentIndex (arg0_index: any) {
    //Convert from parameters
    let index = arg0_index

    //Return statement
    return {
      x: Math.floor(index.x/2),
      y: Math.floor(index.y/2),
      z: index.z - 1,
    }
  }
}
