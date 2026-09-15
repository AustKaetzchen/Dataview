import { useMemo } from 'react'
import { COORDINATE_SYSTEM, WebMercatorViewport } from '@deck.gl/core'
import {
  BitmapLayer,
  PathLayer,
  PolygonLayer,
  GeoJsonLayer,
  ScatterplotLayer,
  SolidPolygonLayer,
  TextLayer,
} from '@deck.gl/layers'
import { CollisionFilterExtension } from '@deck.gl/extensions'
import { TileLayer } from '@deck.gl/geo-layers'
import { CountryFeature } from '@/lib/geopng/polygonBinning'
import {
  transformGeometryToEqualEarth,
  projectEqualEarth,
} from '@/lib/geopng/equalEarth'
import {
  DecodedRaster,
  ProjectionType,
  HeightmapConfig,
  CircleOverlayConfig,
  CityPoint,
  StadesterConfig,
} from '@/lib/geopng/types'
import { MAP_CONFIG } from '@config'
import {
  EquirectangularTileset2D,
  WarpedTileBitmapLayer,
  TesselatedBitmapLayer,
} from './deckLayers'
import { ElevationSpikePoint } from './useElevationSpikes'
import { CirclePixelPoint } from './useCircleOverlay'

import * as d3Chromatic from 'd3-scale-chromatic'

let REGION_COLOR_MAP: Record<string, string> = {
  africa: '#f97316',
  central_asia: '#a855f7',
  eastasia: '#ef4444',
  eastern_europe_and_russia: '#3b82f6',
  europe: '#6366f1',
  indian_subcontinent: '#ec4899',
  latin_america: '#10b981',
  maghreb_egypt: '#eab308',
  middle_east: '#d97706',
  northern_america: '#0ea5e9',
  oceania: '#14b8a6',
  south_asia: '#ec4899',
  southeast_asia: '#8b5cf6',
  sub_saharan_africa: '#f97316',
}

function resolveRegionColorHex (arg0_region?: string, arg1_coords?: [number, number]): string {
  //Convert from parameters
  let coords = arg1_coords
  let reg = (arg0_region || '').toLowerCase().trim()

  //Guard clauses
  if (reg && REGION_COLOR_MAP[reg])
    return REGION_COLOR_MAP[reg]

  if (coords && Array.isArray(coords) && coords.length >= 2) {
    let lat = coords[0]
    let lon = coords[1]

    if (lat < -10 && lon > 110)
      return REGION_COLOR_MAP.oceania
    if (lat > 18 && lon >= 98 && lon <= 150)
      return REGION_COLOR_MAP.eastasia
    if (lat > 0 && lat <= 25 && lon >= 90 && lon < 150)
      return REGION_COLOR_MAP.southeast_asia
    if (lat > 5 && lat < 38 && lon > 60 && lon < 90)
      return REGION_COLOR_MAP.indian_subcontinent
    if (lat > 40 && lon >= 30 && lon <= 180)
      return REGION_COLOR_MAP.eastern_europe_and_russia
    if (lat > 35 && lat < 72 && lon > -15 && lon < 30)
      return REGION_COLOR_MAP.europe
    if (lat > 15 && lat <= 36 && lon > 25 && lon < 60)
      return REGION_COLOR_MAP.middle_east
    if (lat > 20 && lat <= 37 && lon > -18 && lon < 35)
      return REGION_COLOR_MAP.maghreb_egypt
    if (lat <= 20 && lon > -20 && lon < 55)
      return REGION_COLOR_MAP.sub_saharan_africa
    if (lat > 15 && lon > -170 && lon < -50)
      return REGION_COLOR_MAP.northern_america
    if (lat <= 15 && lon > -120 && lon < -30)
      return REGION_COLOR_MAP.latin_america
  }

  //Return statement
  return '#ef4444'
}

function hexToRgb (arg0_hex: string): [number, number, number] {
  let hex = arg0_hex.replace('#', '')
  if (hex.length === 3)
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  let num = parseInt(hex, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function getShortCityLabel (arg0_name: string): string {
  //Convert from parameters
  let name = arg0_name

  //Guard clauses
  if (!name)
    return ''

  //Function body
  let before_semi = name.split(';')[0].trim()
  let first_word = before_semi.split(/[\s,]+/)[0].trim()

  //Return statement
  return first_word || before_semi
}

const RAINBOW_GROWTH_STOPS: Array<[number, [number, number, number]]> = [
  [0.08, [232, 121, 249]],
  [0.06, [239, 68, 68]],
  [0.03, [251, 146, 60]],
  [0.01, [253, 224, 71]],
  [0.00, [198, 219, 85]],
  [-0.02, [69, 207, 119]],
  [-0.04, [72, 156, 240]],
  [-0.05, [93, 96, 226]],
]

function getGrowthRgb (arg0_rate: number, arg1_palette?: string): [number, number, number] {
  //Convert from parameters
  let palette = arg1_palette || 'Rainbow'
  let r = arg0_rate

  //If Rainbow default, use calibrated heat/cool continuous piecewise interpolation matching Anita's cityhistory
  if (palette === 'Rainbow' || !palette) {
    if (r >= RAINBOW_GROWTH_STOPS[0][0])
      return RAINBOW_GROWTH_STOPS[0][1]
    let last_idx = RAINBOW_GROWTH_STOPS.length - 1
    if (r <= RAINBOW_GROWTH_STOPS[last_idx][0])
      return RAINBOW_GROWTH_STOPS[last_idx][1]

    for (let i = 0; i < last_idx; i++) {
      let hi = RAINBOW_GROWTH_STOPS[i][0]
      let lo = RAINBOW_GROWTH_STOPS[i + 1][0]
      if (r <= hi && r >= lo) {
        let t = (hi === lo) ? 0 : (r - lo) / (hi - lo)
        let c_hi = RAINBOW_GROWTH_STOPS[i][1]
        let c_lo = RAINBOW_GROWTH_STOPS[i + 1][1]
        let res_r = Math.round(c_lo[0] + t * (c_hi[0] - c_lo[0]))
        let res_g = Math.round(c_lo[1] + t * (c_hi[1] - c_lo[1]))
        let res_b = Math.round(c_lo[2] + t * (c_hi[2] - c_lo[2]))
        return [res_r, res_g, res_b]
      }
    }
    return RAINBOW_GROWTH_STOPS[4][1]
  }

  //D3 continuous colour interpolation from -0.05 to +0.08
  let interpolator = (d3Chromatic as any)[`interpolate${palette}`]
  if (interpolator) {
    let t = Math.max(0, Math.min(1, (r - (-0.05))/(0.08 - (-0.05))))
    let color_str = interpolator(t)
    let match = color_str.match(/\d+/g)
    if (match && match.length >= 3)
      return [parseInt(match[0], 10), parseInt(match[1], 10), parseInt(match[2], 10)]
  }

  return [232, 121, 249]
}

function getPopRgb (arg0_pop: number): [number, number, number] {
  let p = Math.max(1, arg0_pop)
  let t = Math.max(0, Math.min(1, (Math.log10(p) - 3.7)/3.6))
  let r = Math.round(Math.min(255, 13 + t*240))
  let g = Math.round(Math.min(255, 8 + t*210))
  let b = Math.round(Math.max(0, 135 - t*100))
  return [r, g, b]
}

//Basemaps driven by MAP_CONFIG (config/map.json5)
let esri_basemap_urls_obj: Record<string, string> = {}
for (let i = 0; i < MAP_CONFIG.basemapLayers.length; i++) {
  let local_layer = MAP_CONFIG.basemapLayers[i]
  if (local_layer.url)
    esri_basemap_urls_obj[local_layer.id] = local_layer.url
}

export interface UseDeckLayersParams {
  projection: ProjectionType
  basemap: string
  landGeoJson: any
  equalEarthLandGeoJson: any
  showGraticule: boolean
  graticulePaths: { path: [number, number][] }[]
  renderedCanvas: HTMLCanvasElement | null
  rasterBounds: [number, number, number, number]
  opacity: number
  heightmapConfig: HeightmapConfig
  elevationSpikesData: { points: ElevationSpikePoint[] }
  circleOverlayConfig: CircleOverlayConfig
  circlePixelData: CirclePixelPoint[]
  raster: DecodedRaster | null
  palette: any
  invertPalette?: boolean
  minVal: number
  maxVal: number
  selectedCountries?: CountryFeature[]
  selectedCountry?: CountryFeature | null
  countriesMode?: boolean
  hoveredCountry?: CountryFeature | null
  stadesterConfig?: StadesterConfig
  stadesterCities?: CityPoint[]
  stadesterLabels?: any[]
  stadesterPoints?: any[]
  selectedCityKey?: string | null
  hoveredCity?: CityPoint | null
  onSelectCity?: (city: CityPoint) => void
  onHoverCity?: (city: CityPoint | null, x?: number, y?: number) => void
  viewport?: any
  viewState?: any
}

/**
 * Hook to assemble the deck.gl layer stack across 2D/3D projections.
 * Composes basemaps, graticules, raster surface, elevation spikes, equal-area circles, and country masks.
 *
 * @param {UseDeckLayersParams} arg0_options
 * @returns {Array}
 */
export const useDeckLayers = function (arg0_options: UseDeckLayersParams): any[] {
  //Convert from parameters
  let options = (arg0_options) ? arg0_options : ({} as UseDeckLayersParams)

  //Memoize Stadestér points to prevent GPU buffer re-uploading on mouse moves
  let b_scale = (options.stadesterConfig?.bubbleSize !== undefined) ? options.stadesterConfig.bubbleSize : 1
  let color_mode = options.stadesterConfig?.colorMode || 'growth'
  let growth_palette = options.stadesterConfig?.growthPalette || 'Rainbow'
  let is_cities_enabled = Boolean(options.stadesterConfig?.enabled)
  let projection = options.projection
  let stadester_cities = options.stadesterCities

  let stadester_points_data = useMemo(() => {
    if (!is_cities_enabled || !stadester_cities || stadester_cities.length === 0)
      return []

    return stadester_cities.map((city) => {
      let c_lat = (city.lat !== undefined) ? city.lat : city.coords[0]
      let c_lon = (city.lon !== undefined) ? city.lon : city.coords[1]
      let fill_color: [number, number, number, number] = [255, 255, 255, 220]
      let px = c_lon
      let py = c_lat

      if (projection === 'EqualEarth') {
        let projected = projectEqualEarth(c_lon, c_lat)
        px = projected[0]
        py = projected[1]
      }

      // Equal-area pixel radius scaled by sqrt(population) with guaranteed minimum bubble size for smaller settlements:
      let min_radius = 3.25 * b_scale
      let pop_radius = Math.sqrt(Math.max(0, city.population)) * 0.0115 * b_scale
      let pixel_radius = Math.max(min_radius, Math.min(65.0, min_radius + pop_radius))

      if (color_mode === 'growth') {
        let growth_rate = (city.growthRate !== undefined) ? city.growthRate : 0
        let growth_rgb = getGrowthRgb(growth_rate, growth_palette)
        fill_color = [growth_rgb[0], growth_rgb[1], growth_rgb[2], 220]
      } else if (color_mode === 'population') {
        let pop_rgb = getPopRgb(city.population)
        fill_color = [pop_rgb[0], pop_rgb[1], pop_rgb[2], 220]
      } else if (color_mode === 'region' || color_mode === 'continent') {
        let reg_hex = resolveRegionColorHex(city.region, [c_lat, c_lon])
        let reg_rgb = hexToRgb(reg_hex)
        fill_color = [reg_rgb[0], reg_rgb[1], reg_rgb[2], 220]
      }

      // Truncate name to the first word prior to semicolon
      let short_name = getShortCityLabel(city.name)

      return {
        ...city,
        color: fill_color,
        pixelRadius: pixel_radius,
        position: [px, py, 0] as [number, number, number],
        shortName: short_name,
      }
    })
  }, [
    is_cities_enabled,
    stadester_cities,
    b_scale,
    color_mode,
    growth_palette,
    projection,
  ])

  //Return statement
  return useMemo(() => {
    //Declare local instance variables
    let basemap = options.basemap
    let circle_overlay_config = options.circleOverlayConfig
    let circle_pixel_data = options.circlePixelData
    let countries_mode = options.countriesMode
    let effective_selected_array: CountryFeature[] = []
    let elevation_spikes_data = options.elevationSpikesData
    let equal_earth_land_geo_json = options.equalEarthLandGeoJson
    let graticule_paths = options.graticulePaths
    let halo_w: number
    let heightmap_config = options.heightmapConfig
    let hov_key: string
    let hovered_country = options.hoveredCountry
    let hovered_data: any
    let invert_palette = options.invertPalette
    let is_cartesian: boolean
    let is_hovered_already_selected: boolean
    let land_data: any
    let land_geo_json = options.landGeoJson
    let layers_array: any[] = []
    let max_val = options.maxVal
    let min_val = options.minVal
    let opacity = options.opacity
    let palette = options.palette
    let projection = options.projection
    let raster = options.raster
    let raster_bounds = options.rasterBounds
    let rendered_canvas = options.renderedCanvas
    let selected_countries = options.selectedCountries
    let selected_country = options.selectedCountry
    let selected_data: any
    let selected_key: string
    let show_graticule = options.showGraticule
    let spike_key: string
    let stroke_w: number

    //Function body
    is_cartesian = (projection === 'Equirectangular' || projection === 'EqualEarth')

    if (selected_countries && selected_countries.length > 0) {
      effective_selected_array = selected_countries
    } else if (selected_country) {
      effective_selected_array = [selected_country]
    }

    //1. Basemap Layer
    if (basemap === 'none' || projection === 'EqualEarth') {
      if (projection !== 'EqualEarth') {
        layers_array.push(
          new PolygonLayer({
            id: `ocean-base-${projection}`,
            data: [
              {
                polygon: [
                  [-180, -90],
                  [180, -90],
                  [180, 90],
                  [-180, 90],
                  [-180, -90],
                ],
              },
            ],
            coordinateSystem: (is_cartesian) ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
            _imageCoordinateSystem: (projection === 'Globe') ? 'lnglat' : undefined,
            filled: true,
            getPolygon: (d: any) => d.polygon,
            getFillColor: [14, 18, 26, 255],
            stroked: false,
            parameters: { depthTest: false },
          })
        )
      }

      land_data = (projection === 'EqualEarth') ? equal_earth_land_geo_json : land_geo_json
      if (land_data) {
        layers_array.push(
          new GeoJsonLayer({
            id: `ne-land-${projection}`,
            data: land_data,
            coordinateSystem: (is_cartesian) ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
            filled: true,
            getFillColor: [32, 36, 46, 255],
            stroked: true,
            getLineColor: [55, 62, 78, 255],
            getLineWidth: 1,
            lineWidthUnits: 'pixels',
            parameters: { depthTest: false },
          })
        )
      }
    } else {
      if (projection === 'Mercator') {
        layers_array.push(
          new TileLayer({
            id: `esri-basemap-mercator-${basemap}`,
            data: esri_basemap_urls_obj[basemap],
            minZoom: 0,
            maxZoom: 18,
            tileSize: 256,
            renderSubLayers: (props: any) => {
              let local_bounding_box = props.tile.boundingBox
              return new BitmapLayer(props, {
                data: undefined,
                image: props.data,
                bounds: [
                  local_bounding_box[0][0],
                  local_bounding_box[0][1],
                  local_bounding_box[1][0],
                  local_bounding_box[1][1],
                ],
              })
            },
          })
        )
      } else if (projection === 'Globe') {
        layers_array.push(
          new TileLayer({
            id: `esri-basemap-globe-${basemap}`,
            data: esri_basemap_urls_obj[basemap],
            minZoom: 0,
            maxZoom: 18,
            tileSize: 256,
            renderSubLayers: (props: any) => {
              let local_bounding_box = props.tile.boundingBox
              return new BitmapLayer(props, {
                data: undefined,
                image: props.data,
                bounds: [
                  local_bounding_box[0][0],
                  local_bounding_box[0][1],
                  local_bounding_box[1][0],
                  local_bounding_box[1][1],
                ],
                _imageCoordinateSystem: 'cartesian',
              })
            },
          })
        )
      } else if (projection === 'Equirectangular') {
        layers_array.push(
          new TileLayer({
            id: `esri-basemap-equirectangular-${basemap}`,
            data: esri_basemap_urls_obj[basemap],
            TilesetClass: EquirectangularTileset2D,
            minZoom: 0,
            maxZoom: 18,
            tileSize: 256,
            renderSubLayers: (props: any) => {
              let local_bbox = props.tile.bbox
              if (!local_bbox)
                return null
              return new WarpedTileBitmapLayer(props, {
                data: undefined,
                image: props.data,
                bounds: [local_bbox.west, local_bbox.south, local_bbox.east, local_bbox.north],
              })
            },
          })
        )
      }
    }

    //2. Graticule Lines Layer
    if (show_graticule) {
      layers_array.push(
        new PathLayer({
          id: `graticule-layer-${projection}`,
          data: graticule_paths,
          getPath: (d: any) => d.path,
          getColor: [255, 255, 255, 38],
          coordinateSystem: (is_cartesian) ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          widthUnits: 'pixels',
          widthMinPixels: 1,
          widthMaxPixels: 1,
          getWidth: 1,
          pickable: false,
        })
      )
    }

    //3. GeoPNG Raster Layer
    if (rendered_canvas) {
      layers_array.push(
        new TesselatedBitmapLayer({
          id: `geopng-raster-${projection}-${heightmap_config.enabled ? '3d' : '2d'}-${heightmap_config.elevationScale}`,
          bounds: raster_bounds,
          image: rendered_canvas,
          opacity: opacity,
          pickable: true,
          coordinateSystem: (is_cartesian) ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          _imageCoordinateSystem: (projection === 'Globe') ? 'lnglat' : undefined,
          projection,
          heightmapEnabled: heightmap_config.enabled,
          elevationScale: heightmap_config.elevationScale,
          rasterData: raster?.data,
          rasterWidth: raster?.width,
          rasterHeight: raster?.height,
          minVal: min_val,
          maxVal: max_val,
          parameters: {
            depthTest: true,
            polygonOffset: [-2, -2],
          } as any,
          textureParameters: {
            minFilter: 'nearest',
            magFilter: 'nearest',
            mipmapFilter: 'nearest',
          },
        })
      )
    }

    //4. 3D Elevation Spikes
    if (heightmap_config.enabled && elevation_spikes_data.points && elevation_spikes_data.points.length > 0) {
      spike_key = (countries_mode && effective_selected_array.length > 0)
        ? `iso-${effective_selected_array.map((c) => c.properties.iso_a3 || c.properties.name).sort().join('_') || 'empty'}`
        : 'global'

      layers_array.push(
        new SolidPolygonLayer({
          id: `elevation-spikes-${projection}-${spike_key}-${heightmap_config.resolutionArcmin ?? 60}-${heightmap_config.heightScaleMode ?? 'linear'}-${heightmap_config.blendWeight ?? 0.5}`,
          data: elevation_spikes_data.points,
          getPolygon: (d: any) => d.polygon,
          getElevation: (d: any) => d.elevation,
          getFillColor: (d: any) => d.color,
          updateTriggers: {
            getPolygon: [elevation_spikes_data.points, spike_key, countries_mode, effective_selected_array.length, heightmap_config.resolutionArcmin],
            getElevation: [elevation_spikes_data.points, spike_key, heightmap_config.elevationScale, heightmap_config.resolutionArcmin, heightmap_config.heightScaleMode, heightmap_config.blendWeight],
            getFillColor: [elevation_spikes_data.points, spike_key, palette, invert_palette, heightmap_config.opacity, heightmap_config.opacityByPercentile, heightmap_config.opacityByPercentileStrength],
          },
          extruded: true,
          flatShading: true,
          opacity: 1,
          elevationScale: 1,
          coordinateSystem: (is_cartesian) ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          pickable: true,
          material: {
            ambient: 0.35,
            diffuse: 0.7,
            shininess: 40,
            specularColor: [85, 90, 100],
          },
        })
      )
    }

    //5. High-Value Equal-Area Circle Pixels
    if (circle_pixel_data.length > 0) {
      stroke_w = circle_overlay_config.strokeWidth || 2
      halo_w = circle_overlay_config.haloWidth ?? 1

      layers_array.push(
        new ScatterplotLayer({
          id: `circle-pixels-halo-${projection}-${stroke_w}-${halo_w}`,
          data: circle_pixel_data,
          getPosition: (d: any) => d.position,
          getRadius: (d: any) => d.radius,
          filled: false,
          stroked: true,
          getLineColor: [0, 0, 0, 255],
          getLineWidth: stroke_w + halo_w*2,
          lineWidthUnits: 'pixels',
          radiusUnits: (is_cartesian) ? 'common' : 'meters',
          coordinateSystem: (is_cartesian) ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          pickable: false,
          parameters: { depthTest: false },
        })
      )

      layers_array.push(
        new ScatterplotLayer({
          id: `circle-pixels-stroke-${projection}-${stroke_w}`,
          data: circle_pixel_data,
          getPosition: (d: any) => d.position,
          getRadius: (d: any) => d.radius,
          filled: false,
          stroked: true,
          getLineColor: (d: any) => d.color,
          getLineWidth: stroke_w,
          lineWidthUnits: 'pixels',
          radiusUnits: (is_cartesian) ? 'common' : 'meters',
          coordinateSystem: (is_cartesian) ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          pickable: true,
          parameters: { depthTest: false },
        })
      )
    }

    //6. Selected Countries Highlight
    if (effective_selected_array.length > 0) {
      selected_data = (projection === 'EqualEarth')
        ? effective_selected_array.map((c) => ({
            ...c,
            geometry: transformGeometryToEqualEarth(c.geometry),
          }))
        : effective_selected_array.map((c) => ({ ...c, geometry: { ...c.geometry } }))

      selected_key = effective_selected_array
        .map((c) => (c.properties.iso_a3 && c.properties.iso_a3 !== '-99' ? c.properties.iso_a3 : c.properties.name))
        .join('_')

      layers_array.push(
        new GeoJsonLayer({
          id: `countries-selected-${projection}-${selected_key}`,
          data: selected_data,
          coordinateSystem: (is_cartesian) ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          filled: true,
          getFillColor: [240, 60, 60, 30],
          stroked: true,
          getLineColor: [240, 60, 60, 220],
          getLineWidth: 2,
          lineWidthUnits: 'pixels',
          updateTriggers: {
            getFillColor: [selected_key],
            getLineColor: [selected_key],
          },
          parameters: { depthTest: false },
        })
      )
    }

    //7. Hovered Country Highlight in Countries Mode
    is_hovered_already_selected = effective_selected_array.some(
      (c) =>
        (c.properties.iso_a3 && c.properties.iso_a3 !== '-99' && c.properties.iso_a3 === hovered_country?.properties.iso_a3) ||
        c.properties.name === hovered_country?.properties.name
    )

    if (countries_mode && hovered_country && !is_hovered_already_selected) {
      hov_key = (hovered_country.properties.iso_a3 && hovered_country.properties.iso_a3 !== '-99')
        ? hovered_country.properties.iso_a3
        : (hovered_country.properties.adm0_a3 || hovered_country.properties.name || 'hov')

      hovered_data = (projection === 'EqualEarth')
        ? [{ ...hovered_country, geometry: transformGeometryToEqualEarth(hovered_country.geometry) }]
        : [{ ...hovered_country, geometry: { ...hovered_country.geometry } }]

      layers_array.push(
        new GeoJsonLayer({
          id: `country-hovered-${projection}-${hov_key}`,
          data: hovered_data,
          coordinateSystem: (is_cartesian) ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          filled: true,
          getFillColor: [255, 255, 255, 45],
          stroked: true,
          getLineColor: [255, 255, 255, 220],
          getLineWidth: 1.5,
          lineWidthUnits: 'pixels',
          parameters: { depthTest: false },
        })
      )
    }

    //8. Stadestér Historical Cities
    let effective_points = (options.stadesterPoints && options.stadesterPoints.length > 0)
      ? options.stadesterPoints
      : stadester_points_data

    if (options.stadesterConfig?.enabled && effective_points.length > 0) {
      let is_collision_active = (options.stadesterConfig.labelCollision !== undefined) ? options.stadesterConfig.labelCollision : true
      let is_halo = options.stadesterConfig.halo !== false && !options.stadesterConfig.filled
      let is_labels_visible = (options.stadesterConfig.showLabels !== undefined) ? options.stadesterConfig.showLabels : true

      let circle_opacity = (options.stadesterConfig.opacity !== undefined) ? options.stadesterConfig.opacity : 0.7
      let fill_alpha = Math.round(255 * circle_opacity)
      let stroke_alpha = Math.min(255, Math.round(255 * Math.min(1.0, circle_opacity * 1.25)))

      // City circles layer (ScatterplotLayer rendered in screen pixels)
      layers_array.push(
        new ScatterplotLayer({
          id: `stadester-cities-${projection}`,
          data: effective_points,
          getPosition: (d: any) => d.position,
          getRadius: (d: any) => d.pixelRadius,
          getFillColor: (d: any) => {
            let is_region_highlighted = Boolean(
              options.hoveredCity?.region &&
              d.region &&
              (d.region === options.hoveredCity.region ||
               d.region.toLowerCase().includes(options.hoveredCity.region.toLowerCase()) ||
               options.hoveredCity.region.toLowerCase().includes(d.region.toLowerCase()))
            )
            if (is_region_highlighted) {
              let r = Math.round(d.color[0] * 0.7 + 255 * 0.3)
              let g = Math.round(d.color[1] * 0.7 + 255 * 0.3)
              let b = Math.round(d.color[2] * 0.7 + 255 * 0.3)
              return [r, g, b, Math.min(255, fill_alpha + 35)]
            }
            return [d.color[0], d.color[1], d.color[2], fill_alpha]
          },
          getLineColor: (d: any) => {
            let is_region_highlighted = Boolean(
              options.hoveredCity?.region &&
              d.region &&
              (d.region === options.hoveredCity.region ||
               d.region.toLowerCase().includes(options.hoveredCity.region.toLowerCase()) ||
               options.hoveredCity.region.toLowerCase().includes(d.region.toLowerCase()))
            )
            if (is_region_highlighted) {
              let r = Math.round(d.color[0] * 0.7 + 255 * 0.3)
              let g = Math.round(d.color[1] * 0.7 + 255 * 0.3)
              let b = Math.round(d.color[2] * 0.7 + 255 * 0.3)
              return [r, g, b, 255]
            }
            return [d.color[0], d.color[1], d.color[2], stroke_alpha]
          },
          getLineWidth: 1.5,
          lineWidthUnits: 'pixels',
          lineWidthMinPixels: 1.5,
          stroked: is_halo,
          filled: !is_halo,
          radiusUnits: 'pixels',
          radiusMinPixels: 3.25,
          radiusMaxPixels: 65.0,
          coordinateSystem: (is_cartesian) ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 100],
          onClick: (info: any) => {
            if (info.object && options.onSelectCity)
              options.onSelectCity(info.object)
            return true
          },
          onHover: (info: any) => {
            if (options.onHoverCity)
              options.onHoverCity(info.object || null, info.x, info.y)
          },
          parameters: {
            cullMode: 'none',
            depthTest: false,
          },
        })
      )

      // City selection highlight ring
      if (options.selectedCityKey) {
        let selected_city_item = effective_points.find((c: any) => c.key === options.selectedCityKey)
        if (selected_city_item) {
          layers_array.push(
            new ScatterplotLayer({
              id: `stadester-selected-ring-${projection}`,
              data: [selected_city_item],
              getPosition: (d: any) => d.position,
              getRadius: (d: any) => d.pixelRadius + 4,
              stroked: true,
              filled: false,
              getLineColor: [239, 68, 68, 255],
              getLineWidth: 2.5,
              lineWidthUnits: 'pixels',
              radiusUnits: 'pixels',
              coordinateSystem: (is_cartesian) ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
              parameters: {
                cullMode: 'none',
                depthTest: false,
              },
              pickable: false,
            })
          )
        }
      }

      // City text labels
      if (is_labels_visible) {
        let visible_label_cities = options.stadesterLabels

        // Fallback local placement if worker labels have not yet arrived
        if (!visible_label_cities || visible_label_cities.length === 0) {
          let sorted_cities = [...effective_points].sort((arg0_a, arg0_b) => arg0_b.population - arg0_a.population)
          let placed_label_boxes: Array<[number, number, number, number]> = []
          visible_label_cities = []
          let window_w = (typeof window !== 'undefined') ? window.innerWidth : 1920
          let window_h = (typeof window !== 'undefined') ? window.innerHeight : 1080

          for (let i = 0; i < sorted_cities.length; i++) {
            let c = sorted_cities[i]
            let label_text = c.shortName || ''
            if (!label_text)
              continue

            let text_w = label_text.length * 7.5 + 12
            let text_h = 16
            let sx: number
            let sy: number

            if (projection === 'Globe') {
              let center_lat = options.viewState?.latitude ?? 20
              let center_lng = options.viewState?.longitude ?? 0
              let c_lat_rad = (center_lat * Math.PI) / 180
              let c_lng_rad = (center_lng * Math.PI) / 180
              let p_lat_rad = (c.position[1] * Math.PI) / 180
              let p_lng_rad = (c.position[0] * Math.PI) / 180
              let d_lng = p_lng_rad - c_lng_rad

              let cos_c = Math.sin(c_lat_rad) * Math.sin(p_lat_rad) + Math.cos(c_lat_rad) * Math.cos(p_lat_rad) * Math.cos(d_lng)
              if (cos_c < 0.0)
                continue

              let lat_clamp = Math.max(-89.9, Math.min(89.9, center_lat))
              let scale_adjust = Math.PI * Math.cos((lat_clamp * Math.PI) / 180)
              let lat_adjust = Math.log2(Math.max(0.0001, scale_adjust)) - Math.log2(Math.PI)
              let effective_zoom = (options.viewState?.zoom ?? ((projection === 'Globe') ? 3 : 1.2)) + lat_adjust
              let globe_radius = (512 / (2 * Math.PI)) * Math.pow(2, effective_zoom)

              let x_ortho = Math.cos(p_lat_rad) * Math.sin(d_lng)
              let y_ortho = Math.cos(c_lat_rad) * Math.sin(p_lat_rad) - Math.sin(c_lat_rad) * Math.cos(p_lat_rad) * Math.cos(d_lng)

              let bearing_deg = options.viewState?.bearing ?? 0
              let bearing_rad = (bearing_deg * Math.PI) / 180
              let cos_b = Math.cos(bearing_rad)
              let sin_b = Math.sin(bearing_rad)
              let x_rot = x_ortho * cos_b - y_ortho * sin_b
              let y_rot = x_ortho * sin_b + y_ortho * cos_b

              sx = window_w / 2 + x_rot * globe_radius
              sy = window_h / 2 - y_rot * globe_radius
            } else if (is_cartesian) {
              let target = options.viewState?.target || [0, 0, 0]
              let scale = Math.pow(2, options.viewState?.zoom ?? 2.8)
              sx = window_w / 2 + (c.position[0] - target[0]) * scale
              sy = window_h / 2 - (c.position[1] - target[1]) * scale
            } else {
              let center_lat = options.viewState?.latitude ?? 20
              let center_lng = options.viewState?.longitude ?? 0
              let scale = Math.pow(2, options.viewState?.zoom ?? 1.2)
              let rad_factor = Math.PI / 180

              let x_norm = (c.position[0] + 180) / 360
              let c_norm = (center_lng + 180) / 360
              sx = window_w / 2 + (x_norm - c_norm) * 512 * scale

              let lat_rad = Math.max(-85, Math.min(85, c.position[1])) * rad_factor
              let c_lat_rad = Math.max(-85, Math.min(85, center_lat)) * rad_factor
              let y_proj = (1 - Math.log(Math.tan(Math.PI / 4 + lat_rad / 2)) / Math.PI) / 2
              let c_y_proj = (1 - Math.log(Math.tan(Math.PI / 4 + c_lat_rad / 2)) / Math.PI) / 2
              sy = window_h / 2 + (y_proj - c_y_proj) * 512 * scale
            }

            let r = c.pixelRadius
            let box_x1 = sx + r + 8
            let box_y1 = sy - text_h / 2
            let box_x2 = box_x1 + text_w
            let box_y2 = box_y1 + text_h

            if (is_collision_active) {
              let collides = false
              for (let b = 0; b < placed_label_boxes.length; b++) {
                let pb = placed_label_boxes[b]
                if (
                  box_x1 < pb[2] + 4 &&
                  box_x2 > pb[0] - 4 &&
                  box_y1 < pb[3] + 2 &&
                  box_y2 > pb[1] - 2
                ) {
                  collides = true
                  break
                }
              }
              if (collides)
                continue
            }

            placed_label_boxes.push([box_x1, box_y1, box_x2, box_y2])
            visible_label_cities.push(c)

            if (visible_label_cities.length >= 300)
              break
          }
        }

        if (visible_label_cities.length > 0) {
          layers_array.push(
            new TextLayer({
              id: `stadester-labels-${projection}`,
              data: visible_label_cities,
              getPosition: (d: any) => d.position,
              getText: (d: any) => d.shortName,
              getSize: (d: any) => Math.max(10, Math.min(15, 9 + Math.log10(Math.max(1000, d.population))*0.9)),
              sizeUnits: 'pixels',
              getColor: [255, 255, 255, 255],
              getTextAnchor: 'start',
              getAlignmentBaseline: 'center',
              getPixelOffset: (d: any) => [d.pixelRadius + 8, 0],
              background: true,
              getBackgroundColor: [10, 15, 25, 220],
              backgroundPadding: [4, 2],
              borderRadius: 2,
              fontFamily: 'Karla, sans-serif',
              fontWeight: 600,
              coordinateSystem: (is_cartesian) ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
              characterSet: 'auto',
              pickable: false,
              parameters: {
                cullMode: 'none',
                depthTest: false,
              },
            })
          )
        }
      }
    }

    //Return statement
    return layers_array
  }, [
    options.projection,
    options.basemap,
    options.landGeoJson,
    options.equalEarthLandGeoJson,
    options.showGraticule,
    options.graticulePaths,
    options.renderedCanvas,
    options.rasterBounds,
    options.opacity,
    options.heightmapConfig,
    options.elevationSpikesData,
    options.circleOverlayConfig,
    options.circlePixelData,
    options.raster,
    options.palette,
    options.invertPalette,
    options.minVal,
    options.maxVal,
    options.selectedCountry,
    options.selectedCountries,
    options.countriesMode,
    options.hoveredCountry,
    stadester_points_data,
    options.stadesterPoints,
    options.stadesterLabels,
    options.stadesterConfig,
    options.selectedCityKey,
    options.onSelectCity,
    options.onHoverCity,
    options.viewState,
  ])
}
