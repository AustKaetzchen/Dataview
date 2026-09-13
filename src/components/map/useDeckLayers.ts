import { useMemo } from 'react'
import { COORDINATE_SYSTEM } from '@deck.gl/core'
import {
  BitmapLayer,
  PathLayer,
  PolygonLayer,
  GeoJsonLayer,
  ScatterplotLayer,
  SolidPolygonLayer,
} from '@deck.gl/layers'
import { TileLayer } from '@deck.gl/geo-layers'
import { CountryFeature } from '@/lib/geopng/polygonBinning'
import { transformGeometryToEqualEarth } from '@/lib/geopng/equalEarth'
import {
  DecodedRaster,
  ProjectionType,
  HeightmapConfig,
  CircleOverlayConfig,
} from '@/lib/geopng/types'
import { MAP_CONFIG } from '@config'
import {
  EquirectangularTileset2D,
  WarpedTileBitmapLayer,
  TesselatedBitmapLayer,
} from './deckLayers'
import { ElevationSpikePoint } from './useElevationSpikes'
import { CirclePixelPoint } from './useCircleOverlay'

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
  ])
}
