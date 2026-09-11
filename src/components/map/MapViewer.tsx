import React, { useState, useEffect, useMemo, useCallback } from 'react'
import DeckGL from '@deck.gl/react'
import { MapView, _GlobeView as GlobeView, OrthographicView, COORDINATE_SYSTEM } from '@deck.gl/core'
import { BitmapLayer, PathLayer, PolygonLayer, GeoJsonLayer } from '@deck.gl/layers'
import { TileLayer, _Tileset2D as Tileset2D } from '@deck.gl/geo-layers'
import { lngLatToWorld } from '@math.gl/web-mercator'
import { DecodedRaster, InspectionData, ProjectionType } from '@/lib/geopng/types'
import { CountryFeature, CountryStats, loadCountriesGeoJson, findCountryAtLngLat } from '@/lib/geopng/polygonBinning'
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
  minVal: number
  maxVal: number
  legendTitle: string
  scaleType: string
  logSigma: number
  breaks?: number[]
  selectedCountry?: CountryFeature | null
  onSelectCountry?: (country: CountryFeature | null) => void
  countriesMode?: boolean
  hoveredCountry?: CountryFeature | null
  onHoverCountry?: (country: CountryFeature | null) => void
  countryStats?: CountryStats | null
  onInspect?: (data: InspectionData | null) => void
}

// ESRI ArcGIS Online Basemaps (Public, No API key required)
const ESRI_BASEMAP_URLS: Record<string, string> = {
  dark: 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  light: 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  satellite: 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  topo: 'https://services.arcgisonline.com/arcgis/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
}

const BASEMAP_ORDER: ('dark' | 'light' | 'satellite' | 'topo' | 'none')[] = [
  'dark',
  'satellite',
  'light',
  'topo',
  'none',
]

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
  minVal,
  maxVal,
  legendTitle,
  scaleType,
  logSigma,
  breaks,
  selectedCountry,
  onSelectCountry,
  countriesMode,
  hoveredCountry,
  onHoverCountry,
  countryStats,
  onInspect,
}) => {
  const [projViewStates, setProjViewStates] = useState<Record<ProjectionType, any>>({
    Mercator: {
      longitude: 0,
      latitude: 20,
      zoom: 1.2,
      pitch: 0,
      bearing: 0,
      maxZoom: 18,
      minZoom: 0,
    },
    Globe: {
      longitude: 0,
      latitude: 20,
      zoom: 0,
      pitch: 0,
      bearing: 0,
      maxZoom: 18,
      minZoom: 0,
    },
    Equirectangular: {
      target: [0, 0, 0],
      zoom: 2.0,
      minZoom: 0.2,
      maxZoom: 10,
    },
  })

  const [basemap, setBasemap] = useState<'dark' | 'light' | 'satellite' | 'topo' | 'none'>('dark')
  const [showGraticule, setShowGraticule] = useState(true)
  const [flyoutOpen, setFlyoutOpen] = useState(false)

  const [inspectData, setInspectData] = useState<InspectionData | null>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  // Unique counters for selected and hovered layers to guarantee fresh GPU buffers on country changes
  const [selectionId, setSelectionId] = useState(0)
  const [hoverId, setHoverId] = useState(0)

  useEffect(() => {
    setSelectionId((prev) => prev + 1)
  }, [selectedCountry])

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

  // Graticule lines (latitude every 10 deg, longitude every 20 deg)
  const graticulePaths = useMemo(() => {
    const paths: { path: [number, number][] }[] = []
    // Parallels (latitude lines)
    for (let lat = -80; lat <= 80; lat += 10) {
      const line: [number, number][] = []
      for (let lon = -180; lon <= 180; lon += 5) {
        line.push([lon, lat])
      }
      paths.push({ path: line })
    }
    // Meridians (longitude lines)
    for (let lon = -180; lon <= 180; lon += 20) {
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
      // Account for 1-pixel south shift in Equirectangular projection
      const effLat = projection === 'Equirectangular' ? lat + pixelHeight : lat
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

  // Map click handler (inspects pixel value and selects country for polygon binning)
  const handleClick = useCallback(
    (info: any) => {
      if (!info.coordinate) return
      const [lng, lat] = info.coordinate

      const insp = sampleRasterAt(lng, lat)
      setInspectData(insp)
      setCursorPos({ x: info.x, y: info.y })
      if (onInspect) onInspect(insp)

      // Identify clicked country
      if (countryFeatures.length > 0 && onSelectCountry) {
        const country = findCountryAtLngLat(lng, lat, countryFeatures)
        if (country) {
          onSelectCountry(country)
        }
      }
    },
    [sampleRasterAt, onInspect, countryFeatures, onSelectCountry]
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

    // 4. Selected Country Highlight (Secondary Red Accent)
    // Dynamic layer ID and cloned data ensure 100% clean GPU buffers without stale cross-country degenerate polygons
    if (selectedCountry) {
      const selKey =
        (selectedCountry.properties.iso_a3 && selectedCountry.properties.iso_a3 !== '-99')
          ? selectedCountry.properties.iso_a3
          : (selectedCountry.properties.adm0_a3 || selectedCountry.properties.name || 'sel')

      list.push(
        new GeoJsonLayer({
          id: `country-selected-${selKey}-${selectionId}-${projection}`,
          data: [{ ...selectedCountry, geometry: { ...selectedCountry.geometry } }],
          coordinateSystem:
            projection === 'Equirectangular' ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          filled: true,
          getFillColor: [240, 60, 60, 25],
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
    if (countriesMode && hoveredCountry && hoveredCountry !== selectedCountry) {
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

      {/* Map Control Tools Toolbar (Top Right) */}
      <TooltipProvider delayDuration={150}>
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-card/95 backdrop-blur-md p-1 rounded-[3px] border border-border shadow-md">
          {/* Toggle Graticule */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showGraticule ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setShowGraticule(!showGraticule)}
                className="h-7 w-7 text-white"
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
                className="h-7 w-7 text-white"
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
                className="h-7 w-7 text-white"
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
          <div className="absolute top-4 right-14 z-30 w-64 bg-card/98 backdrop-blur-md border border-border rounded-[4px] p-3 shadow-2xl text-xs text-card-foreground animate-in fade-in-0 zoom-in-95 duration-100 font-sans space-y-3">
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
                    className={`px-1.5 py-1 text-[11px] rounded-[3px] border transition-colors cursor-pointer text-center truncate ${
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

              <div className="space-y-1 bg-background/60 p-1.5 rounded-[3px] border border-border">
                {[
                  { id: 'dark', label: 'Dark Canvas (ESRI)' },
                  { id: 'light', label: 'Light Canvas (ESRI)' },
                  { id: 'satellite', label: 'Satellite Imagery (ESRI)' },
                  { id: 'topo', label: 'Topographic (ESRI)' },
                  { id: 'none', label: 'No Basemap (Land / Sea)' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setBasemap(item.id as any)}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded-[2px] text-[11px] transition-colors cursor-pointer text-left ${
                      basemap === item.id
                        ? 'bg-muted text-foreground font-semibold'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    }`}
                  >
                    <span>{item.label}</span>
                    {basemap === item.id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
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
