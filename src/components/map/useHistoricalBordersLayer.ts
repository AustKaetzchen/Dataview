import { COORDINATE_SYSTEM } from '@deck.gl/core'
import { GeoJsonLayer } from '@deck.gl/layers'
import { transformGeometryToEqualEarth } from '@/lib/geopng/equalEarth'
import { GlobeAntipodeCullExtension } from './layers/GlobeAntipodeCullExtension'
import type { HistoricalBorderFeature } from '@/server/atlasBordersService'
import type { HistoricalBordersConfig, ProjectionType } from '@/lib/geopng/types'

export interface HistoricalBordersLayerOptions {
  config?: HistoricalBordersConfig
  hoveredHistoricalId?: string | number | null
  historicalBordersData?: {
    features: HistoricalBorderFeature[]
    type: 'FeatureCollection'
  } | null
  onHoverHistoricalFeature?: (arg0_feature: HistoricalBorderFeature | null, arg1_x?: number, arg2_y?: number) => void
  onSelectHistoricalFeature?: (arg0_feature: HistoricalBorderFeature, arg1_coord?: [number, number], arg2_x?: number, arg3_y?: number) => void
  projection: ProjectionType
  selectedHistoricalId?: string | number | null
  timelineYear: number
}

/**
 * Parses a hex colour string into an [r, g, b, a] tuple.
 *
 * @param {string} arg0_hex
 * @param {number} [arg1_alpha=255]
 *
 * @returns {[number, number, number, number]}
 */
function parseHexToRgba (arg0_hex: string, arg1_alpha: number = 255): [number, number, number, number] {
  //Convert from parameters
  let alpha = arg1_alpha
  let hex = (arg0_hex || '#d4af37').replace('#', '')

  //Function body
  if (hex.length === 3)
    hex = hex.split('').map((arg0_c) => arg0_c + arg0_c).join('')

  let num = parseInt(hex, 16)
  if (Number.isNaN(num))
    return [212, 175, 55, alpha]

  //Return statement
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, alpha]
}

/**
 * Builds a deck.gl GeoJsonLayer rendering temporally sliced historical borders from CShapes-2.0 and atlas.naissance.
 *
 * @param {HistoricalBordersLayerOptions} arg0_options
 *
 * @returns {GeoJsonLayer | null}
 */
export function createHistoricalBordersDeckLayer (
  arg0_options: HistoricalBordersLayerOptions
): GeoJsonLayer | null {
  //Convert from parameters
  let options = (arg0_options) ? arg0_options : ({} as HistoricalBordersLayerOptions)
  let borders_data = options.historicalBordersData
  let config = options.config
  let hovered_id = options.hoveredHistoricalId
  let on_hover = options.onHoverHistoricalFeature
  let on_select = options.onSelectHistoricalFeature
  let projection = options.projection
  let selected_id = options.selectedHistoricalId
  let timeline_year = options.timelineYear

  //Declare local instance variables
  let base_rgba: [number, number, number, number]
  let feature_count: number
  let fill_alpha: number
  let fill_opacity: number
  let is_cartesian: boolean
  let layer_data: any
  let layer_id: string
  let stroke_color: string
  let stroke_width: number

  //Guard clauses
  if (!borders_data || !borders_data.features || borders_data.features.length === 0)
    return null

  //Function body
  feature_count = borders_data.features.length
  fill_opacity = (config?.fillOpacity !== undefined) ? config.fillOpacity : 0.0
  fill_alpha = Math.round(fill_opacity * 255)
  is_cartesian = (projection === 'Equirectangular' || projection === 'EqualEarth')
  stroke_color = config?.strokeColor || '#d4af37'
  stroke_width = (config?.strokeWidth !== undefined) ? config.strokeWidth : 1.25
  base_rgba = parseHexToRgba(stroke_color, 200)

  layer_id = `historical-borders-${projection}-${timeline_year}-${feature_count}`

  if (projection === 'EqualEarth') {
    layer_data = borders_data.features.map((arg0_f) => ({
      ...arg0_f,
      geometry: transformGeometryToEqualEarth(arg0_f.geometry),
    }))
  } else {
    layer_data = borders_data.features
  }

  //Return statement
  return new GeoJsonLayer({
    id: layer_id,
    data: layer_data,
    coordinateSystem: (is_cartesian) ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
    pickable: true,
    stroked: true,
    filled: true,
    lineWidthUnits: 'pixels',
    lineWidthMinPixels: 1,
    getLineWidth: (arg0_d: any) => {
      let is_selected = Boolean(selected_id && (arg0_d.id === selected_id || arg0_d.properties?.id === selected_id || arg0_d.properties?.gwcode === selected_id))
      let is_hovered = Boolean(hovered_id && (arg0_d.id === hovered_id || arg0_d.properties?.id === hovered_id || arg0_d.properties?.gwcode === hovered_id))

      if (is_selected)
        return Math.max(stroke_width * 2.0, 2.5)
      if (is_hovered)
        return Math.max(stroke_width * 1.5, 2.0)
      return stroke_width
    },
    getLineColor: (arg0_d: any) => {
      let is_selected = Boolean(selected_id && (arg0_d.id === selected_id || arg0_d.properties?.id === selected_id || arg0_d.properties?.gwcode === selected_id))
      let is_hovered = Boolean(hovered_id && (arg0_d.id === hovered_id || arg0_d.properties?.id === hovered_id || arg0_d.properties?.gwcode === hovered_id))

      if (is_selected)
        return [250, 204, 21, 255]
      if (is_hovered)
        return [255, 255, 255, 240]
      return base_rgba
    },
    getFillColor: (arg0_d: any) => {
      let is_selected = Boolean(selected_id && (arg0_d.id === selected_id || arg0_d.properties?.id === selected_id || arg0_d.properties?.gwcode === selected_id))
      let is_hovered = Boolean(hovered_id && (arg0_d.id === hovered_id || arg0_d.properties?.id === hovered_id || arg0_d.properties?.gwcode === hovered_id))

      if (is_selected)
        return [250, 204, 21, Math.max(fill_alpha, 55)]
      if (is_hovered)
        return [255, 255, 255, Math.max(fill_alpha, 30)]

      //Use polity symbol polygonFill if defined in entity metadata
      let polity_color = arg0_d.properties?.symbol?.polygonFill || arg0_d.properties?.symbol?.fillColor || arg0_d.properties?.fillColor || arg0_d.properties?.color
      if (polity_color && fill_alpha > 0)
        return parseHexToRgba(polity_color, fill_alpha)

      //Default: clean black/white stroke, no random fill
      return [0, 0, 0, 0]
    },
    updateTriggers: {
      getFillColor: [selected_id, hovered_id, stroke_color, fill_opacity],
      getLineColor: [selected_id, hovered_id, stroke_color],
      getLineWidth: [selected_id, hovered_id, stroke_width],
    },
    onClick: (arg0_info: any) => {
      if (arg0_info.object && on_select) {
        let coord: [number, number] | undefined = arg0_info.coordinate
          ? [arg0_info.coordinate[0], arg0_info.coordinate[1]]
          : undefined
        on_select(arg0_info.object, coord, arg0_info.x, arg0_info.y)
        return true
      }
      return false
    },
    onHover: (arg0_info: any) => {
      if (on_hover)
        on_hover(arg0_info.object || null, arg0_info.x, arg0_info.y)
    },
    extensions: [new GlobeAntipodeCullExtension()],
    parameters: {
      depthTest: false,
    },
  })
}

