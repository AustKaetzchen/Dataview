import React, { useState, useEffect, useMemo, useCallback } from 'react'
import DeckGL from '@deck.gl/react'
import { MapView, _GlobeView as GlobeView, OrthographicView, COORDINATE_SYSTEM } from '@deck.gl/core'
import { BitmapLayer, PathLayer, PolygonLayer, GeoJsonLayer } from '@deck.gl/layers'
import { TileLayer, _Tileset2D as Tileset2D } from '@deck.gl/geo-layers'
import { lngLatToWorld } from '@math.gl/web-mercator'
import { DecodedRaster, InspectionData, ProjectionType } from '@/lib/geopng/types'
import { CountryFeature, CountryStats, loadCountriesGeoJson, findCountryAtLngLat } from '@/lib/geopng/polygonBinning'
import { MAP_CONFIG } from '@config'
import { ClickInfoPanel } from './ClickInfoPanel'
import { ColorBarLegend } from './ColorBarLegend'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'

interface MapViewerProps {
  raster: DecodedRaster | null
  renderedCanvas: HTMLCanvasElement | null
  rasterBounds: [number, number, number, number]
  projection: ProjectionType
  setProjection: (p: ProjectionType) => void
  opacity: number
  palette: any
  invertPalette?: boolean
  minVal: number
  maxVal: number
  legendTitle: string
  scaleType: string
  logSigma: number
  breaks?: number[]
  selectedCountry?: CountryFeature | null
  selectedCountries?: CountryFeature[]
  onSelectCountry?: (country: CountryFeature | null) => void
  onToggleCountry?: (country: CountryFeature) => void
  countriesMode?: boolean
  onToggleCountriesMode?: (enabled: boolean) => void
  hoveredCountry?: CountryFeature | null
  onHoverCountry?: (country: CountryFeature | null) => void
  countryStats?: CountryStats | null
  onInspect?: (data: InspectionData | null) => void
}

// Basemaps driven by MAP_CONFIG (config/map.json5)
const ESRI_BASEMAP_URLS: Record<string, string> = {}
for (const layer of MAP_CONFIG.basemapLayers) {
  if (layer.url) {
    ESRI_BASEMAP_URLS[layer.id] = layer.url
  }
}

const BASEMAP_ORDER = MAP_CONFIG.basemapLayers.map((b) => b.id)

// Custom Tileset2D for Equirectangular (Plate Carrée / OrthographicView)
class EquirectangularTileset2D extends Tileset2D {
  getTileIndices({ viewport, maxZoom = 18, minZoom = 0 }: any) {
    if (!viewport || !viewport.unproject) return []

    const topLeft = viewport.unproject([0, 0])
    const bottomRight = viewport.unproject([viewport.width, viewport.height])

    const minLng = Math.max(-180, Math.min(topLeft[0], bottomRight[0]))
    const maxLng = Math.min(180, Math.max(topLeft[0], bottomRight[0]))
    const minLat = Math.max(-85.051128, Math.min(topLeft[1], bottomRight[1]))
    const maxLat = Math.min(85.051128, Math.max(topLeft[1], bottomRight[1]))

    if (minLng >= maxLng || minLat >= maxLat) {
      return []
    }

    const pixelsPerDegree = Math.pow(2, viewport.zoom)
    const worldWidthPixels = 360 * pixelsPerDegree
    const calculatedZ = Math.round(Math.log2(worldWidthPixels / 256))
    const z = Math.max(minZoom, Math.min(maxZoom, Math.max(0, calculatedZ)))

    const n = Math.pow(2, z)
    const xMin = Math.max(0, Math.min(n - 1, Math.floor(((minLng + 180) / 360) * n)))
    const xMax = Math.max(0, Math.min(n - 1, Math.floor(((maxLng + 180) / 360) * n)))

    const latToY = (lat: number) => {
      const clampedLat = Math.max(-85.051128, Math.min(85.051128, lat))
      const rad = (clampedLat * Math.PI) / 180
      return Math.floor(((1 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / Math.PI) / 2) * n)
    }

    const yMin = Math.max(0, Math.min(n - 1, latToY(maxLat)))
    const yMax = Math.max(0, Math.min(n - 1, latToY(minLat)))

    const indices: { x: number; y: number; z: number }[] = []
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        indices.push({ x, y, z })
      }
    }
    return indices
  }

  getTileMetadata(index: any) {
    const { x, y, z } = index
    const n = Math.pow(2, z)
    const west = (x / n) * 360 - 180
    const east = ((x + 1) / n) * 360 - 180

    const yToLat = (yIdx: number) => {
      const rad = 2 * Math.atan(Math.exp(Math.PI * (1 - (2 * yIdx) / n))) - Math.PI / 2
      return (rad * 180) / Math.PI
    }

    const north = yToLat(y)
    const south = yToLat(y + 1)

    return {
      bbox: { west, south, east, north },
    }
  }

  getParentIndex(index: any) {
    return {
      x: Math.floor(index.x / 2),
      y: Math.floor(index.y / 2),
      z: index.z - 1,
    }
  }
}

class WarpedTileBitmapLayer extends BitmapLayer {
  static layerName = 'WarpedTileBitmapLayer'

  _getCoordinateUniforms() {
    const { bounds } = this.props as any
    const west = bounds[0]
    const south = Math.max(-85.051128, bounds[1])
    const east = bounds[2]
    const north = Math.min(85.051128, bounds[3])
    const bottomLeft = lngLatToWorld([west, south])
    const topRight = lngLatToWorld([east, north])
    return {
      coordinateConversion: 1,
      bounds: [bottomLeft[0], bottomLeft[1], topRight[0], topRight[1]],
    }
  }
}

// Custom TesselatedBitmapLayer: generates a fine 2-degree ground mesh at Z=0
// so that when camera pitch or tilt is applied, the raster does not shear or disalign from vector layers
class TesselatedBitmapLayer extends BitmapLayer {
  static layerName = 'TesselatedBitmapLayer'

  _createMesh() {
    const { bounds } = this.props as any
    let minX = -180, minY = -90, maxX = 180, maxY = 90
    if (Number.isFinite(bounds[0])) {
      minX = bounds[0]
      minY = bounds[1]
      maxX = bounds[2]
      maxY = bounds[3]
    }

    const stepDeg = 2.0
    const xSpan = maxX - minX
    const ySpan = maxY - minY
    const uCount = Math.max(12, Math.ceil(xSpan / stepDeg) + 1)
    const vCount = Math.max(12, Math.ceil(ySpan / stepDeg) + 1)

    const vertexCount = (uCount - 1) * (vCount - 1) * 6
    const indices = new Uint32Array(vertexCount)
    const texCoords = new Float32Array(uCount * vCount * 2)
    const positions = new Float64Array(uCount * vCount * 3)

    let vertex = 0
    let index = 0
    for (let u = 0; u < uCount; u++) {
      const ut = u / (uCount - 1)
      const x = minX + ut * xSpan
      for (let v = 0; v < vCount; v++) {
        const vt = v / (vCount - 1)
        const y = minY + vt * ySpan

        positions[vertex * 3 + 0] = x
        positions[vertex * 3 + 1] = y
        positions[vertex * 3 + 2] = 0 // Anchored to ground Z=0

        texCoords[vertex * 2 + 0] = ut
        texCoords[vertex * 2 + 1] = 1 - vt

        if (u > 0 && v > 0) {
          indices[index++] = vertex - vCount
          indices[index++] = vertex - vCount - 1
          indices[index++] = vertex - 1
          indices[index++] = vertex - vCount
          indices[index++] = vertex - 1
          indices[index++] = vertex
        }
        vertex++
      }
    }

    return { vertexCount, positions, indices, texCoords }
  }
}

export const MapViewer: React.FC<MapViewerProps> = ({
  raster,
  renderedCanvas,
  rasterBounds,
  projection,
  setProjection,
  opacity,
  palette,
  invertPalette,
  minVal,
  maxVal,
  legendTitle,
  scaleType,
  logSigma,
  breaks,
  selectedCountry,
  selectedCountries,
  onSelectCountry,
  onToggleCountry,
  countriesMode,
  onToggleCountriesMode,
  hoveredCountry,
  onHoverCountry,
  countryStats,
  onInspect,
}) => {
  const [projViewStates, setProjViewStates] = useState<Record<ProjectionType, any>>({
    Mercator: MAP_CONFIG.mapDefines?.initialMercator || {
      longitude: 0,
      latitude: 20,
      zoom: 1.2,
      pitch: 0,
      bearing: 0,
      maxZoom: 18,
      minZoom: 0,
    },
    Globe: MAP_CONFIG.mapDefines?.initialGlobe || {
      longitude: 0,
      latitude: 20,
      zoom: 0,
      pitch: 0,
      bearing: 0,
      maxZoom: 18,
      minZoom: 0,
    },
    Equirectangular: MAP_CONFIG.mapDefines?.initialEquirectangular || {
      target: [0, 0, 0],
      zoom: 2.0,
      minZoom: 0.2,
      maxZoom: 10,
    },
  })

  const [basemap, setBasemap] = useState<string>(MAP_CONFIG.basemapLayers[0]?.id || 'dark')
  const [showGraticule, setShowGraticule] = useState(true)
  const [flyoutOpen, setFlyoutOpen] = useState(false)

  const [inspectData, setInspectData] = useState<InspectionData | null>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  // Unique counters for selected and hovered layers to guarantee fresh GPU buffers on country changes
  const [selectionId, setSelectionId] = useState(0)
  const [hoverId, setHoverId] = useState(0)

  useEffect(() => {
    setSelectionId((prev) => prev + 1)
  }, [selectedCountry, selectedCountries])

  useEffect(() => {
    setHoverId((prev) => prev + 1)
  }, [hoveredCountry])

  // NaturalEarth Land & Countries data
  const [landGeoJson, setLandGeoJson] = useState<any>(null)
  const [countryFeatures, setCountryFeatures] = useState<CountryFeature[]>([])

  useEffect(() => {
    fetch('/data/ne_50m_land.geojson')
      .then((r) => r.json())
      .then((data) => setLandGeoJson(data))
      .catch((err) => console.error('Failed to load land geojson:', err))

    loadCountriesGeoJson().then((feats) => setCountryFeatures(feats))
  }, [])

  // Graticule lines (driven by MAP_CONFIG)
  const graticulePaths = useMemo(() => {
    const latInterval = MAP_CONFIG.mapDefines?.graticule?.latInterval || 10
    const lngInterval = MAP_CONFIG.mapDefines?.graticule?.lngInterval || 20
    const paths: { path: [number, number][] }[] = []
    // Parallels (latitude lines)
    for (let lat = -80; lat <= 80; lat += latInterval) {
      const line: [number, number][] = []
      for (let lon = -180; lon <= 180; lon += 5) {
        line.push([lon, lat])
      }
      paths.push({ path: line })
    }
    // Meridians (longitude lines)
    for (let lon = -180; lon <= 180; lon += lngInterval) {
      const line: [number, number][] = []
      for (let lat = -85; lat <= 85; lat += 5) {
        line.push([lon, lat])
      }
      paths.push({ path: line })
    }
    return paths
  }, [])

  // Sample raster value at [lng, lat] on Equirectangular WGS84 grid
  const sampleRasterAt = useCallback(
    (lng: number, lat: number): InspectionData | null => {
      if (!raster) return null
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null

      const pixelHeight = 180 / raster.height
      const pixelX = Math.floor(((lng + 180) / 360) * raster.width)
      // Account for pixel offsets from MAP_CONFIG
      let effLat = lat
      if (projection === 'Equirectangular') {
        const offset = (MAP_CONFIG.equirectangularPixelOffset ?? -1) * pixelHeight
        effLat = lat - offset
      } else if (projection === 'Mercator') {
        const offset = (MAP_CONFIG.mercatorPixelOffset ?? -1) * pixelHeight
        effLat = lat - offset
      }
      const pixelY = Math.floor(((90 - effLat) / 180) * raster.height)

      const clampedX = Math.max(0, Math.min(raster.width - 1, pixelX))
      const clampedY = Math.max(0, Math.min(raster.height - 1, pixelY))

      const idx = clampedY * raster.width + clampedX
      const val = raster.data[idx]

      let countryName: string | null = null
      if (countryFeatures.length > 0) {
        const c = findCountryAtLngLat(lng, lat, countryFeatures)
        if (c) countryName = c.properties.name || c.properties.name_long || null
      }

      return {
        pixelX: clampedX,
        pixelY: clampedY,
        lng,
        lat,
        value: Number.isNaN(val) ? null : val,
        countryName,
      }
    },
    [raster, countryFeatures, projection]
  )

  // Map click handler (inspects pixel value and toggles/selects country for polygon binning)
  const handleClick = useCallback(
    (info: any) => {
      if (!info.coordinate) return
      const [lng, lat] = info.coordinate

      const insp = sampleRasterAt(lng, lat)
      setInspectData(insp)
      setCursorPos({ x: info.x, y: info.y })
      if (onInspect) onInspect(insp)

      // Identify clicked country
      if (countryFeatures.length > 0) {
        const country = findCountryAtLngLat(lng, lat, countryFeatures)
        if (country) {
          if (onToggleCountry) {
            onToggleCountry(country)
          } else if (onSelectCountry) {
            onSelectCountry(country)
          }
        }
      }
    },
    [sampleRasterAt, onInspect, countryFeatures, onToggleCountry, onSelectCountry]
  )

  // Map hover handler (triggers pixel inspection & country hover in Countries Mode)
  const handleHover = useCallback(
    (info: any) => {
      if (!info.coordinate) {
        setInspectData(null)
        setCursorPos(null)
        if (countriesMode && onHoverCountry) {
          onHoverCountry(null)
        }
        return
      }
      const [lng, lat] = info.coordinate
      const insp = sampleRasterAt(lng, lat)
      setInspectData(insp)
      setCursorPos({ x: info.x, y: info.y })
      if (onInspect) onInspect(insp)

      if (countriesMode && countryFeatures.length > 0 && onHoverCountry) {
        const country = findCountryAtLngLat(lng, lat, countryFeatures)
        onHoverCountry(country)
      }
    },
    [sampleRasterAt, onInspect, countriesMode, countryFeatures, onHoverCountry]
  )

  const handleDoubleClick = useCallback(() => {
    setProjViewStates((prev) => ({
      ...prev,
      [projection]:
        projection === 'Equirectangular'
          ? { target: [0, 0, 0], zoom: 2.0, minZoom: 0.2, maxZoom: 10 }
          : projection === 'Globe'
          ? { longitude: 0, latitude: 20, zoom: 0, pitch: 0, bearing: 0, maxZoom: 18, minZoom: 0 }
          : { longitude: 0, latitude: 20, zoom: 1.2, pitch: 0, bearing: 0, maxZoom: 18, minZoom: 0 },
    }))
  }, [projection])

  const handleViewStateChange = useCallback(
    (e: any) => {
      setProjViewStates((prev) => ({
        ...prev,
        [projection]: e.viewState,
      }))
    },
    [projection]
  )

  const cycleBasemap = useCallback(() => {
    setBasemap((prev) => {
      const idx = BASEMAP_ORDER.indexOf(prev)
      const nextIdx = (idx + 1) % BASEMAP_ORDER.length
      return BASEMAP_ORDER[nextIdx]
    })
  }, [])

  // Configure deck.gl view
  const views = useMemo(() => {
    if (projection === 'Globe') {
      return new GlobeView({ id: 'globe-view', controller: true })
    }
    if (projection === 'Equirectangular') {
      return new OrthographicView({ id: 'ortho-view', flipY: false, controller: true })
    }
    return new MapView({ id: 'map-view', repeat: false, controller: true })
  }, [projection])

  // Build deck.gl layer stack
  const layers = useMemo(() => {
    const list: any[] = []

    // 1. Basemap Layer (ESRI or NaturalEarth Land/Sea when "None")
    if (basemap === 'none') {
      // Ocean background
      list.push(
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
          coordinateSystem:
            projection === 'Equirectangular' ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          _imageCoordinateSystem: projection === 'Globe' ? 'lnglat' : undefined,
          getPolygon: (d: any) => d.polygon,
          filled: true,
          getFillColor: [14, 18, 26, 255],
          stroked: false,
          parameters: { depthTest: false },
        })
      )

      // Land fill from NaturalEarth (50m High Precision)
      if (landGeoJson) {
        list.push(
          new GeoJsonLayer({
            id: `ne-land-${projection}`,
            data: landGeoJson,
            coordinateSystem:
              projection === 'Equirectangular' ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
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
        list.push(
          new TileLayer({
            id: `esri-basemap-mercator-${basemap}`,
            data: ESRI_BASEMAP_URLS[basemap],
            minZoom: 0,
            maxZoom: 18,
            tileSize: 256,
            renderSubLayers: (props: any) => {
              const { boundingBox } = props.tile
              return new BitmapLayer(props, {
                data: undefined,
                image: props.data,
                bounds: [
                  boundingBox[0][0],
                  boundingBox[0][1],
                  boundingBox[1][0],
                  boundingBox[1][1],
                ],
              })
            },
          })
        )
      } else if (projection === 'Globe') {
        list.push(
          new TileLayer({
            id: `esri-basemap-globe-${basemap}`,
            data: ESRI_BASEMAP_URLS[basemap],
            minZoom: 0,
            maxZoom: 18,
            tileSize: 256,
            renderSubLayers: (props: any) => {
              const { boundingBox } = props.tile
              return new BitmapLayer(props, {
                data: undefined,
                image: props.data,
                bounds: [
                  boundingBox[0][0],
                  boundingBox[0][1],
                  boundingBox[1][0],
                  boundingBox[1][1],
                ],
                _imageCoordinateSystem: 'cartesian',
              })
            },
          })
        )
      } else if (projection === 'Equirectangular') {
        list.push(
          new TileLayer({
            id: `esri-basemap-equirectangular-${basemap}`,
            data: ESRI_BASEMAP_URLS[basemap],
            TilesetClass: EquirectangularTileset2D,
            minZoom: 0,
            maxZoom: 18,
            tileSize: 256,
            renderSubLayers: (props: any) => {
              const bbox = props.tile.bbox
              if (!bbox) return null
              return new WarpedTileBitmapLayer(props, {
                data: undefined,
                image: props.data,
                bounds: [bbox.west, bbox.south, bbox.east, bbox.north],
              })
            },
          })
        )
      }
    }

    // 2. Graticule Lines Layer (Exact 1-pixel hairline width across all projections)
    if (showGraticule) {
      const extraPaths =
        projection === 'Equirectangular'
          ? [
              {
                path: [
                  [-180, -90],
                  [-180, 90],
                  [180, 90],
                  [180, -90],
                  [-180, -90],
                ] as [number, number][],
              },
            ]
          : []

      list.push(
        new PathLayer({
          id: `graticule-layer-${projection}`,
          data: [...graticulePaths, ...extraPaths],
          getPath: (d: any) => d.path,
          getColor: [255, 255, 255, 38],
          coordinateSystem:
            projection === 'Equirectangular' ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          widthUnits: 'pixels',
          widthMinPixels: 1,
          widthMaxPixels: 1,
          getWidth: 1,
          pickable: false,
        })
      )
    }

    // 3. GeoPNG Raster Layer (Tesselated for pitch/tilt perspective precision, pure nearest-neighbor)
    if (renderedCanvas) {
      list.push(
        new TesselatedBitmapLayer({
          id: `geopng-raster-${projection}`,
          bounds: rasterBounds,
          image: renderedCanvas,
          opacity: opacity,
          pickable: true,
          coordinateSystem:
            projection === 'Equirectangular' ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          _imageCoordinateSystem: projection === 'Globe' ? 'lnglat' : undefined,
          textureParameters: {
            minFilter: 'nearest',
            magFilter: 'nearest',
            mipmapFilter: 'nearest',
          },
        })
      )
    }

    // 4. Selected Countries Highlight (Secondary Red Accent)
    // Dynamic layer ID and cloned data ensure 100% clean GPU buffers without stale cross-country degenerate polygons
    const effectiveSelected =
      selectedCountries && selectedCountries.length > 0
        ? selectedCountries
        : selectedCountry
        ? [selectedCountry]
        : []

    if (effectiveSelected.length > 0) {
      list.push(
        new GeoJsonLayer({
          id: `countries-selected-${selectionId}-${projection}`,
          data: effectiveSelected.map((c) => ({ ...c, geometry: { ...c.geometry } })),
          coordinateSystem:
            projection === 'Equirectangular' ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          filled: true,
          getFillColor: [240, 60, 60, 30],
          stroked: true,
          getLineColor: [240, 60, 60, 220], // secondary red accent outline
          getLineWidth: 2,
          lineWidthUnits: 'pixels',
          parameters: { depthTest: false },
        })
      )
    }

    // 5. Hovered Country Highlight in Countries Mode (Light Translucent White)
    // Dynamic layer ID and cloned data ensure 100% clean GPU buffers without stale cross-country degenerate polygons
    const isHoveredAlreadySelected = effectiveSelected.some(
      (c) =>
        (c.properties.iso_a3 && c.properties.iso_a3 !== '-99' && c.properties.iso_a3 === hoveredCountry?.properties.iso_a3) ||
        c.properties.name === hoveredCountry?.properties.name
    )

    if (countriesMode && hoveredCountry && !isHoveredAlreadySelected) {
      const hovKey =
        (hoveredCountry.properties.iso_a3 && hoveredCountry.properties.iso_a3 !== '-99')
          ? hoveredCountry.properties.iso_a3
          : (hoveredCountry.properties.adm0_a3 || hoveredCountry.properties.name || 'hov')

      list.push(
        new GeoJsonLayer({
          id: `country-hovered-${hovKey}-${hoverId}-${projection}`,
          data: [{ ...hoveredCountry, geometry: { ...hoveredCountry.geometry } }],
          coordinateSystem:
            projection === 'Equirectangular' ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          filled: true,
          getFillColor: [255, 255, 255, 45], // light translucent white as requested
          stroked: true,
          getLineColor: [255, 255, 255, 220], // crisp white hairline outline
          getLineWidth: 1.5,
          lineWidthUnits: 'pixels',
          parameters: { depthTest: false },
        })
      )
    }

    return list
  }, [
    projection,
    basemap,
    landGeoJson,
    showGraticule,
    graticulePaths,
    renderedCanvas,
    rasterBounds,
    opacity,
    selectedCountry,
    selectedCountries,
    selectionId,
    countriesMode,
    hoveredCountry,
    hoverId,
  ])

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none bg-background font-sans"
      style={{ imageRendering: 'pixelated' }}
      onDoubleClick={handleDoubleClick}
    >
      <DeckGL
        views={views}
        viewState={projViewStates[projection]}
        onViewStateChange={handleViewStateChange}
        controller={{ doubleClickZoom: false }}
        layers={layers}
        onClick={handleClick}
        onHover={handleHover}
        getCursor={({ isHovering }) => (isHovering ? 'crosshair' : 'grab')}
      />

      {/* Floating HUD Inspector */}
      <ClickInfoPanel info={inspectData} pos={cursorPos} />

      {/* Color Ramp Legend (Top Left by Sidebar) */}
      {/* Automatically adjusts to individual country when in Countries Mode */}
      {renderedCanvas && (() => {
        const isCountryRelative = Boolean(
          countriesMode &&
            countryStats &&
            countryStats.validCount > 0 &&
            Number.isFinite(countryStats.min) &&
            Number.isFinite(countryStats.max)
        )
        const legendMin = isCountryRelative ? countryStats!.min : minVal
        const legendMax = isCountryRelative ? countryStats!.max : maxVal
        const legendBreaks = isCountryRelative ? undefined : breaks
        const legendCountryName = isCountryRelative ? countryStats!.name : null

        return (
          <div className="absolute top-4 left-4 z-20">
            <ColorBarLegend
              palette={palette}
              invertPalette={invertPalette}
              minVal={legendMin}
              maxVal={legendMax}
              legendTitle={legendTitle}
              scaleType={scaleType}
              logSigma={logSigma}
              currentVal={inspectData?.value ?? null}
              breaks={legendBreaks}
              countryName={legendCountryName}
            />
          </div>
        )
      })()}

      {/* Floating Status Pill when Countries Mode is Active */}
      {countriesMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-card/95 backdrop-blur-md px-3.5 py-1.5 rounded-none border border-border shadow-xl text-xs font-sans animate-in fade-in-0 zoom-in-95 duration-150">
          <span className="w-2 h-2 rounded-none bg-primary animate-pulse" />
          <span className="font-semibold text-foreground">Countries Mode Active</span>
          <span className="text-muted-foreground">•</span>
          {hoveredCountry ? (
            <span className="text-primary font-medium truncate max-w-[220px]">
              Inspecting: {hoveredCountry.properties.name}
            </span>
          ) : (
            <span className="text-muted-foreground italic">Hover over any country on map</span>
          )}
          {onToggleCountriesMode && (
            <button
              type="button"
              onClick={() => onToggleCountriesMode(false)}
              className="ml-1 text-muted-foreground hover:text-foreground text-[11px] cursor-pointer"
              title="Exit Countries Mode"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Map Control Tools Toolbar (Top Right) */}
      <TooltipProvider delayDuration={150}>
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-card/95 backdrop-blur-md p-1 rounded-none border border-border shadow-md">
          {/* Toggle Countries Mode */}
          {onToggleCountriesMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={countriesMode ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={() => onToggleCountriesMode(!countriesMode)}
                  className={`h-7 w-7 rounded-none ${countriesMode ? 'text-primary' : 'text-white'}`}
                  aria-label="Toggle Countries Mode"
                >
                  <Icon name="public" className={countriesMode ? 'text-primary' : 'text-white'} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <span>Toggle Countries Mode (Inspect on hover)</span>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Toggle Graticule */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showGraticule ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setShowGraticule(!showGraticule)}
                className="h-7 w-7 rounded-none text-white"
                aria-label="Toggle Graticule Grid"
              >
                <Icon name="grid_4x4" className="text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <span>Toggle Graticule Grid (Parallels & Meridians)</span>
            </TooltipContent>
          </Tooltip>

          {/* Unified Map Layers & Projections Flyout Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={flyoutOpen ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setFlyoutOpen(!flyoutOpen)}
                className="h-7 w-7 rounded-none text-white"
                aria-label="Map Display Settings"
              >
                <Icon name="layers" className="text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <span>Basemap & Spatial Projection Settings</span>
            </TooltipContent>
          </Tooltip>

          {/* Reset Map View */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDoubleClick}
                className="h-7 w-7 rounded-none text-white"
                aria-label="Reset View"
              >
                <Icon name="fullscreen" className="text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <span>Reset Map View (Center & Zoom)</span>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Unified Basemap & Projection Flyout Panel */}
        {flyoutOpen && (
          <div className="absolute top-4 right-14 z-30 w-64 bg-card/98 backdrop-blur-md border border-border rounded-none p-3 shadow-2xl text-xs text-card-foreground animate-in fade-in-0 zoom-in-95 duration-100 font-sans space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
                <Icon name="tune" size="0.9rem" className="text-white" />
                Map Display Settings
              </span>
              <button
                type="button"
                onClick={() => setFlyoutOpen(false)}
                className="text-muted-foreground hover:text-white cursor-pointer text-[11px]"
              >
                ✕
              </button>
            </div>

            {/* Spatial Projection Section */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-foreground block">Spatial Projection</span>
              <div className="grid grid-cols-3 gap-1">
                {(['Mercator', 'Equirectangular', 'Globe'] as ProjectionType[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProjection(p)}
                    className={`px-1.5 py-1 text-[11px] rounded-none border transition-colors cursor-pointer text-center truncate ${
                      projection === p
                        ? 'bg-primary text-primary-foreground border-primary font-bold shadow-sm'
                        : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border'
                    }`}
                  >
                    {p === 'Equirectangular' ? 'Equirect.' : p}
                  </button>
                ))}
              </div>
            </div>

            {/* Basemap Selection Section */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-foreground">Basemap Layer</span>
                <button
                  type="button"
                  onClick={cycleBasemap}
                  className="text-[10px] text-muted-foreground hover:text-white flex items-center gap-0.5 cursor-pointer"
                  title="Cycle to next basemap"
                >
                  <Icon name="sync" size="0.75rem" className="text-white" />
                  Cycle Next
                </button>
              </div>

              <div className="space-y-1 bg-background/60 p-1.5 rounded-none border border-border">
                {MAP_CONFIG.basemapLayers.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setBasemap(item.id)}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded-none text-[11px] transition-colors cursor-pointer text-left ${
                      basemap === item.id
                        ? 'bg-muted text-foreground font-semibold'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    }`}
                  >
                    <span>{item.label}</span>
                    {basemap === item.id && (
                      <span className="w-1.5 h-1.5 rounded-none bg-primary" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </TooltipProvider>
    </div>
  )
}

export default MapViewer
