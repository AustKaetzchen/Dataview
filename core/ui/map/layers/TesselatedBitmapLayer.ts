import { BitmapLayer } from '@deck.gl/layers'
import { projectEqualEarth } from '@framework/geopng/equal_earth.ts'

export interface TesselatedBitmapLayerProps {
  bounds?: any
  projection?: any
  heightmapEnabled?: boolean
  elevationScale?: number
  rasterData?: any
  rasterWidth?: number
  rasterHeight?: number
  minVal?: number
  maxVal?: number
  [key: string]: any
}

/**
 * Dynamic tesselated mesh layer supporting 3D elevation displacement and Equal Earth projection.
 */
export class TesselatedBitmapLayer extends BitmapLayer<TesselatedBitmapLayerProps> {
  static layerName = 'TesselatedBitmapLayer'
  static meshCache = new Map<string, any>()

  /**
   * Constructs the 3D surface mesh vertex buffers with static caching.
   * @returns {Object}
   */
  _createMesh (): any {
    //Declare local instance variables
    let altitude_offset: number
    let bounds = (this.props as any).bounds
    let cached_mesh: any
    let heightmap_enabled = Boolean((this.props as any).heightmapEnabled)
    let index: number = 0
    let indices: Uint32Array
    let max_x: number = 180
    let max_y: number = 90
    let mesh_key: string
    let min_x: number = -180
    let min_y: number = -90
    let positions: Float64Array
    let projection = (this.props as any).projection
    let step_deg: number
    let tex_coords: Float32Array
    let u_count: number
    let v_count: number
    let vertex: number = 0
    let vertex_count: number
    let x_span: number
    let y_span: number

    //Function body
    if (bounds && Number.isFinite(bounds[0])) {
      min_x = bounds[0]
      min_y = bounds[1]
      max_x = bounds[2]
      max_y = bounds[3]
    }

    // On Globe, 0.4 degree grid ensures maximum chord sag is < 38m, preventing basemap puncture
    step_deg = (projection === 'Globe') ? 0.4 : ((heightmap_enabled) ? 1.5 : 2.0)
    mesh_key = `${projection}:${step_deg}:${min_x.toFixed(3)}:${min_y.toFixed(3)}:${max_x.toFixed(3)}:${max_y.toFixed(3)}:${heightmap_enabled}`

    cached_mesh = TesselatedBitmapLayer.meshCache.get(mesh_key)
    if (cached_mesh)
      return cached_mesh

    x_span = max_x - min_x
    y_span = max_y - min_y
    u_count = Math.max(16, Math.ceil(x_span/step_deg) + 1)
    v_count = Math.max(16, Math.ceil(y_span/step_deg) + 1)

    vertex_count = (u_count - 1)*(v_count - 1)*6
    indices = new Uint32Array(vertex_count)
    tex_coords = new Float32Array(u_count*v_count*2)
    positions = new Float64Array(u_count*v_count*3)

    altitude_offset = (projection === 'Globe') ? 150 : 0

    for (let i = 0; i < u_count; i++) {
      let local_ut = i/(u_count - 1)
      let local_lng = min_x + local_ut*x_span

      for (let x = 0; x < v_count; x++) {
        let local_lat = min_y + (x/(v_count - 1))*y_span
        let local_px = local_lng
        let local_py = local_lat
        let local_vt = x/(v_count - 1)

        if (projection === 'EqualEarth') {
          let local_projected_coords = projectEqualEarth(local_lng, local_lat)
          local_px = local_projected_coords[0]
          local_py = local_projected_coords[1]
        }

        positions[vertex*3 + 0] = local_px
        positions[vertex*3 + 1] = local_py
        positions[vertex*3 + 2] = altitude_offset

        tex_coords[vertex*2 + 0] = local_ut
        tex_coords[vertex*2 + 1] = 1 - local_vt

        if (i > 0 && x > 0) {
          indices[index++] = vertex - v_count
          indices[index++] = vertex - v_count - 1
          indices[index++] = vertex - 1
          indices[index++] = vertex - v_count
          indices[index++] = vertex - 1
          indices[index++] = vertex
        }
        vertex++
      }
    }

    let mesh_result = { vertexCount: vertex_count, positions, indices, texCoords: tex_coords }
    TesselatedBitmapLayer.meshCache.set(mesh_key, mesh_result)

    //Return statement
    return mesh_result
  }
}
