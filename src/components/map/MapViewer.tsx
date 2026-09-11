import React, { useState, useEffect, useMemo, useCallback } from 'react'
import DeckGL from '@deck.gl/react'
import { MapView, _GlobeView as GlobeView, OrthographicView, COORDINATE_SYSTEM } from '@deck.gl/core'
import { BitmapLayer, PathLayer, PolygonLayer, GeoJsonLayer, ScatterplotLayer, ColumnLayer, SolidPolygonLayer } from '@deck.gl/layers'
import { TileLayer, _Tileset2D as Tileset2D } from '@deck.gl/geo-layers'
import { lngLatToWorld } from '@math.gl/web-mercator'
import {
  CountryFeature,
  CountryStats,
  loadCountriesGeoJson,
  findCountryAtLngLat,
  isPointInGeometry,
} from '@/lib/geopng/polygonBinning'
import {
  projectEqualEarth,
  invertEqualEarth,
  transformGeometryToEqualEarth,
  generateEqualEarthGraticule,
} from '@/lib/geopng/equalEarth'
import { computeQuantiles, transformValue } from '@/lib/geopng/scales'
import { getPaletteLUT } from '@/lib/geopng/palettes'
import {
  DecodedRaster,
  InspectionData,
  ProjectionType,
  HeightmapConfig,
  CircleOverlayConfig,
  MapModeItem,
  MapModeId,
} from '@/lib/geopng/types'
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
import { MapmodesTray } from './MapmodesTray'

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
  mapModes: MapModeItem[]
  onToggleMapMode: (id: MapModeId) => void
  onReorderMapModes: (newModes: MapModeItem[]) => void
  heightmapConfig: HeightmapConfig
  setHeightmapConfig?: React.Dispatch<React.SetStateAction<HeightmapConfig>>
  circleOverlayConfig: CircleOverlayConfig
  setCircleOverlayConfig?: React.Dispatch<React.SetStateAction<CircleOverlayConfig>>
  analyticsOpen: boolean
  onToggleAnalytics: () => void
  selectedCountry?: CountryFeature | null
  selectedCountries?: CountryFeature[]
  onSelectCountry?: (country: CountryFeature | null) => void
  onToggleCountry?: (country: CountryFeature) => void
  onClearCountries?: () => void
  countriesMode?: boolean
  onToggleCountriesMode?: (enabled: boolean) => void
  hoveredCountry?: CountryFeature | null
  onHoverCountry?: (country: CountryFeature | null) => void
  countryStats?: CountryStats | null
  onInspect?: (data: InspectionData | null) => void
  settingsDrawerOpen?: boolean
  onToggleSettingsDrawer?: (open: boolean) => void
}

// Basemaps driven by MAP_CONFIG (config/map.json5)
const ESRI_BASEMAP_URLS: Record<string, string> = {}
for (const layer of MAP_CONFIG.basemapLayers) {
  if (layer.url) {
    ESRI_BASEMAP_URLS[layer.id] = layer.url
  }
}

// Custom Tileset2D for Equirectangular
class EquirectangularTileset2D extends Tileset2D {
  getTileIndices({ viewport, maxZoom = 18, minZoom = 0 }: any) {
    if (!viewport || !viewport.unproject) return []

    const topLeft = viewport.unproject([0, 0])
    const bottomRight = viewport.unproject([viewport.width, viewport.height])

    const minLng = Math.max(-180, Math.min(topLeft[0], bottomRight[0]))
    const maxLng = Math.min(180, Math.max(topLeft[0], bottomRight[0]))
    const minLat = Math.max(-85.051128, Math.min(topLeft[1], bottomRight[1]))
    const maxLat = Math.min(85.051128, Math.max(topLeft[1], bottomRight[1]))

    if (minLng >= maxLng || minLat >= maxLat) return []

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

    return { bbox: { west, south, east, north } }
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

interface TesselatedBitmapLayerProps {
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

// Dynamic Tesselated mesh supporting 3D elevation displacement & Equal Earth projection
class TesselatedBitmapLayer extends BitmapLayer<TesselatedBitmapLayerProps> {
  static layerName = 'TesselatedBitmapLayer'

  _createMesh() {
    const { bounds, projection, heightmapEnabled } = this.props as any

    let minX = -180, minY = -90, maxX = 180, maxY = 90
    if (bounds && Number.isFinite(bounds[0])) {
      minX = bounds[0]
      minY = bounds[1]
      maxX = bounds[2]
      maxY = bounds[3]
    }

    // Step size for mesh grid (finer step for 3D relief)
    const stepDeg = heightmapEnabled ? 1.5 : 2.0
    const xSpan = maxX - minX
    const ySpan = maxY - minY
    const uCount = Math.max(16, Math.ceil(xSpan / stepDeg) + 1)
    const vCount = Math.max(16, Math.ceil(ySpan / stepDeg) + 1)

    const vertexCount = (uCount - 1) * (vCount - 1) * 6
    const indices = new Uint32Array(vertexCount)
    const texCoords = new Float32Array(uCount * vCount * 2)
    const positions = new Float64Array(uCount * vCount * 3)

    let vertex = 0
    let index = 0
    for (let u = 0; u < uCount; u++) {
      const ut = u / (uCount - 1)
      const lng = minX + ut * xSpan

      for (let v = 0; v < vCount; v++) {
        const vt = v / (vCount - 1)
        const lat = minY + vt * ySpan

        let px = lng
        let py = lat

        if (projection === 'EqualEarth') {
          const [eqX, eqY] = projectEqualEarth(lng, lat)
          px = eqX
          py = eqY
        }

        positions[vertex * 3 + 0] = px
        positions[vertex * 3 + 1] = py
        positions[vertex * 3 + 2] = 0

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
  mapModes,
  onToggleMapMode,
  onReorderMapModes,
  heightmapConfig,
  setHeightmapConfig,
  circleOverlayConfig,
  setCircleOverlayConfig,
  analyticsOpen,
  onToggleAnalytics,
  selectedCountry,
  selectedCountries,
  onSelectCountry,
  onToggleCountry,
  onClearCountries,
  countriesMode,
  onToggleCountriesMode,
  hoveredCountry,
  onHoverCountry,
  countryStats,
  onInspect,
  settingsDrawerOpen,
  onToggleSettingsDrawer,
}) => {
  const [internalFlyoutOpen, setInternalFlyoutOpen] = useState(false)
  const flyoutOpen = settingsDrawerOpen !== undefined ? settingsDrawerOpen : internalFlyoutOpen
  const setFlyoutOpen = onToggleSettingsDrawer || setInternalFlyoutOpen

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
    EqualEarth: {
      target: [0, 0, 0],
      zoom: 2.0,
      minZoom: 0.2,
      maxZoom: 10,
    },
  })

  // When heightmap is toggled on, tilt camera to 45 degrees so relief is immediately visible
  useEffect(() => {
    if (heightmapConfig.enabled) {
      setProjViewStates((prev) => ({
        ...prev,
        Mercator: { ...prev.Mercator, pitch: Math.max(35, prev.Mercator.pitch || 45) },
      }))
    }
  }, [heightmapConfig.enabled])

  const [basemap, setBasemap] = useState<string>(MAP_CONFIG.basemapLayers[0]?.id || 'dark')
  const [showGraticule, setShowGraticule] = useState(true)

  const [inspectData, setInspectData] = useState<InspectionData | null>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

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

  // Projected Land GeoJSON for Equal Earth
  const equalEarthLandGeoJson = useMemo(() => {
    if (!landGeoJson) return null
    try {
      return {
        type: 'FeatureCollection',
        features: landGeoJson.features.map((f: any) => ({
          ...f,
          geometry: transformGeometryToEqualEarth(f.geometry),
        })),
      }
    } catch {
      return landGeoJson
    }
  }, [landGeoJson])

  // Graticule lines
  const graticulePaths = useMemo(() => {
    if (projection === 'EqualEarth') {
      return generateEqualEarthGraticule(10, 20)
    }

    const latInterval = MAP_CONFIG.mapDefines?.graticule?.latInterval || 10
    const lngInterval = MAP_CONFIG.mapDefines?.graticule?.lngInterval || 20
    const paths: { path: [number, number][] }[] = []

    for (let lat = -80; lat <= 80; lat += latInterval) {
      const line: [number, number][] = []
      for (let lon = -180; lon <= 180; lon += 5) {
        line.push([lon, lat])
      }
      paths.push({ path: line })
    }

    for (let lon = -180; lon <= 180; lon += lngInterval) {
      const line: [number, number][] = []
      for (let lat = -85; lat <= 85; lat += 5) {
        line.push([lon, lat])
      }
      paths.push({ path: line })
    }

    return paths
  }, [projection])

  // Sample raster value at coordinate
  const sampleRasterAt = useCallback(
    (coordX: number, coordY: number): InspectionData | null => {
      if (!raster) return null

      let lng = coordX
      let lat = coordY

      if (projection === 'EqualEarth') {
        const [invLng, invLat] = invertEqualEarth(coordX, coordY)
        lng = invLng
        lat = invLat
      }

      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null

      const pixelHeight = 180 / raster.height
      const pixelX = Math.floor(((lng + 180) / 360) * raster.width)
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

  const handleClick = useCallback(
    (info: any) => {
      if (!info.coordinate) return
      const [x, y] = info.coordinate

      const insp = sampleRasterAt(x, y)
      setInspectData(insp)
      setCursorPos({ x: info.x, y: info.y })
      if (onInspect) onInspect(insp)

      if (insp && countryFeatures.length > 0) {
        const country = findCountryAtLngLat(insp.lng, insp.lat, countryFeatures)
        if (country) {
          if (onToggleCountry) onToggleCountry(country)
          else if (onSelectCountry) onSelectCountry(country)
        }
      }
    },
    [sampleRasterAt, onInspect, countryFeatures, onToggleCountry, onSelectCountry]
  )

  const handleHover = useCallback(
    (info: any) => {
      if (!info.coordinate) {
        setInspectData(null)
        setCursorPos(null)
        if (countriesMode && onHoverCountry) onHoverCountry(null)
        return
      }
      const [x, y] = info.coordinate
      const insp = sampleRasterAt(x, y)
      setInspectData(insp)
      setCursorPos({ x: info.x, y: info.y })
      if (onInspect) onInspect(insp)

      if (countriesMode && insp && countryFeatures.length > 0 && onHoverCountry) {
        const country = findCountryAtLngLat(insp.lng, insp.lat, countryFeatures)
        onHoverCountry(country)
      }
    },
    [sampleRasterAt, onInspect, countriesMode, countryFeatures, onHoverCountry]
  )

  const handleDoubleClick = useCallback(() => {
    setProjViewStates((prev) => ({
      ...prev,
      [projection]:
        projection === 'Equirectangular' || projection === 'EqualEarth'
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

  // Configure deck.gl view
  const views = useMemo(() => {
    if (projection === 'Globe') {
      return new GlobeView({ id: 'globe-view', controller: true })
    }
    if (projection === 'Equirectangular') {
      return new OrthographicView({ id: 'ortho-view', flipY: false, controller: true })
    }
    if (projection === 'EqualEarth') {
      return new OrthographicView({ id: 'equal-earth-view', flipY: false, controller: true })
    }
    return new MapView({
      id: 'map-view',
      repeat: false,
      controller: { doubleClickZoom: false, dragRotate: true },
    })
  }, [projection])

  // 3D Elevation Spike Map Data Generator (deck.gl SolidPolygonLayer with Flat-Facing Uniform Rectangular Geometry)
  const elevationSpikesData = useMemo(() => {
    if (!heightmapConfig.enabled || !raster || !raster.data) {
      return { points: [] as any[] }
    }

    const W = raster.width
    const H = raster.height
    const tMin = transformValue(minVal, scaleType as any, logSigma)
    const tMax = transformValue(maxVal, scaleType as any, logSigma)
    const tRange = tMax - tMin || 1
    const lut = getPaletteLUT(palette, Boolean(invertPalette))
    const isCartesian = projection === 'Equirectangular' || projection === 'EqualEarth'

    // Target grid resolution to cover all grid cells smoothly (~50k to 65k cells max for 60fps)
    const maxDim = 360
    const step = Math.max(1, Math.ceil(Math.max(W, H) / maxDim))
    const gridW = Math.ceil(W / step)
    const gridH = Math.ceil(H / step)

    const cellLngWidth = 360 / gridW
    const cellLatHeight = 180 / gridH

    // Uniform parent pixel sizing with 0.93 coverage for a subtle clean margin
    const cov = 0.93
    const halfW = (cellLngWidth / 2) * cov
    const halfH = (cellLatHeight / 2) * cov

    const points: any[] = []

    const effectiveSelected =
      selectedCountries && selectedCountries.length > 0
        ? selectedCountries
        : selectedCountry
        ? [selectedCountry]
        : []

    const maxScale = heightmapConfig.elevationScale || 800000
    // Continuous base pedestal so all valid grid cells form a cohesive terrain carpet without empty holes
    const baseElevation = isCartesian ? (maxScale / 111000) * 0.35 : maxScale * 0.035
    const opacityVal = heightmapConfig.opacity ?? 0.9
    const alpha = Math.round(255 * opacityVal)

    for (let gr = 0; gr < gridH; gr++) {
      const startR = gr * step
      const endR = Math.min(H, startR + step)
      const centerLat = 90 - ((gr + 0.5) / gridH) * 180
      const minLat = centerLat - halfH
      const maxLat = centerLat + halfH

      for (let gc = 0; gc < gridW; gc++) {
        const startC = gc * step
        const endC = Math.min(W, startC + step)

        // Area-aggregate block pixels: preserve fine spikes via blended mean + peak
        let sumVal = 0
        let countVal = 0
        let maxBlockVal = -Infinity

        for (let r = startR; r < endR; r++) {
          const rowOffset = r * W
          for (let c = startC; c < endC; c++) {
            const v = raster.data[rowOffset + c]
            if (Number.isFinite(v)) {
              sumVal += v
              countVal++
              if (v > maxBlockVal) maxBlockVal = v
            }
          }
        }

        // Only skip if cell has no finite data (ocean / NaN)
        if (countVal === 0) continue

        // Blend mean & max so needle spikes are prominently rendered while maintaining smooth coverage
        const v = countVal > 1 ? (sumVal / countVal) * 0.4 + maxBlockVal * 0.6 : maxBlockVal

        // Uniform rectangular parent pixel center and bounds
        const centerLng = -180 + ((gc + 0.5) / gridW) * 360
        const minLng = centerLng - halfW
        const maxLng = centerLng + halfW

        // Respect bitmap isolation mode in Country Analysis
        if (countriesMode && effectiveSelected.length > 0) {
          let isInside = false
          for (const country of effectiveSelected) {
            if (country.bbox) {
              const [bMinX, bMinY, bMaxX, bMaxY] = country.bbox
              if (centerLng < bMinX || centerLng > bMaxX || centerLat < bMinY || centerLat > bMaxY) continue
            }
            if (isPointInGeometry(centerLng, centerLat, country.geometry)) {
              isInside = true
              break
            }
          }
          if (!isInside) continue
        }

        // 4 corners strictly flat-facing North: SW -> SE -> NE -> NW
        let polygon: [number, number][]
        if (projection === 'EqualEarth') {
          polygon = [
            projectEqualEarth(minLng, minLat),
            projectEqualEarth(maxLng, minLat),
            projectEqualEarth(maxLng, maxLat),
            projectEqualEarth(minLng, maxLat),
          ]
        } else {
          polygon = [
            [minLng, minLat],
            [maxLng, minLat],
            [maxLng, maxLat],
            [minLng, maxLat],
          ]
        }

        const tVal = transformValue(v, scaleType as any, logSigma)
        const norm = Math.max(0, Math.min(1, (tVal - tMin) / tRange))

        // Needle spike elevation: baseline pedestal + dynamic exponential scale
        const spikeHeight = isCartesian
          ? Math.pow(norm, 1.25) * ((maxScale / 111000) * 12)
          : Math.pow(norm, 1.25) * maxScale

        const elev = baseElevation + spikeHeight

        // Palette color from LUT with transparency alpha
        const lutIdx = Math.floor(norm * 255) * 3
        const color: [number, number, number, number] = [
          lut[lutIdx],
          lut[lutIdx + 1],
          lut[lutIdx + 2],
          alpha,
        ]

        points.push({
          polygon,
          elevation: elev,
          color,
          value: v,
          lng: centerLng,
          lat: centerLat,
        })
      }
    }

    return { points }
  }, [
    heightmapConfig.enabled,
    heightmapConfig.elevationScale,
    heightmapConfig.opacity,
    raster,
    minVal,
    maxVal,
    scaleType,
    logSigma,
    palette,
    invertPalette,
    projection,
    countriesMode,
    selectedCountries,
    selectedCountry,
  ])

  // Extract high-value proportional circles (equal area: A ∝ Value => r ∝ sqrt(Value))
  const circlePixelData = useMemo(() => {
    if (!circleOverlayConfig.enabled || !raster) return []

    // Calculate cutoff value
    const pCutoff = circleOverlayConfig.percentileCutoff / 100
    const [cutoffVal] = computeQuantiles(raster.data, [pCutoff])
    if (!Number.isFinite(cutoffVal)) return []

    const W = raster.width
    const H = raster.height
    const valRange = raster.max - raster.min || 1
    const cutoffRange = raster.max - cutoffVal || 1
    const lut = getPaletteLUT(palette, Boolean(invertPalette))

    const points: any[] = []
    const isCartesian = projection === 'Equirectangular' || projection === 'EqualEarth'
    const baseR = isCartesian
      ? circleOverlayConfig.baseRadius * 0.8
      : circleOverlayConfig.baseRadius * 85000

    // Downsample search stride if grid is very large
    const stride = Math.max(1, Math.floor(Math.sqrt((W * H) / 100000)))

    for (let r = 0; r < H; r += stride) {
      const rowOffset = r * W
      const lat = 90 - ((r + 0.5) / H) * 180

      for (let c = 0; c < W; c += stride) {
        const v = raster.data[rowOffset + c]
        if (Number.isFinite(v) && v >= cutoffVal) {
          const lng = -180 + ((c + 0.5) / W) * 360

          // Item 1: Subject to bitmap isolation mode in Country Analysis
          const effectiveSelected =
            selectedCountries && selectedCountries.length > 0
              ? selectedCountries
              : selectedCountry
              ? [selectedCountry]
              : []

          if (countriesMode && effectiveSelected.length > 0) {
            let isInside = false
            for (const country of effectiveSelected) {
              if (country.bbox) {
                const [bMinX, bMinY, bMaxX, bMaxY] = country.bbox
                if (lng < bMinX || lng > bMaxX || lat < bMinY || lat > bMaxY) continue
              }
              if (isPointInGeometry(lng, lat, country.geometry)) {
                isInside = true
                break
              }
            }
            if (!isInside) continue
          }

          let px = lng
          let py = lat
          if (projection === 'EqualEarth') {
            const [eqX, eqY] = projectEqualEarth(lng, lat)
            px = eqX
            py = eqY
          }

          // Heightmap altitude
          let alt = 0
          if (heightmapConfig.enabled) {
            const norm = Math.max(0, (v - minVal) / valRange)
            if (isCartesian) {
              alt = norm * ((heightmapConfig.elevationScale || 250000) / 111000) * 12
            } else {
              alt = norm * (heightmapConfig.elevationScale || 250000)
            }
          }

          // Equal-area scaling: Radius ∝ sqrt(relative value above cutoff)
          const relAbove = Math.max(0, (v - cutoffVal) / cutoffRange)
          const radius = baseR * (0.6 + Math.sqrt(relAbove) * 1.8)

          // Color from palette
          const normAll = Math.max(0, Math.min(1, (v - minVal) / valRange))
          const lutIdx = Math.floor(normAll * 255) * 3
          const color: [number, number, number, number] = [
            lut[lutIdx],
            lut[lutIdx + 1],
            lut[lutIdx + 2],
            230,
          ]

          points.push({
            position: [px, py, alt],
            value: v,
            radius,
            color,
          })
        }
      }
    }

    return points
  }, [
    circleOverlayConfig,
    raster,
    palette,
    invertPalette,
    minVal,
    maxVal,
    projection,
    heightmapConfig,
    countriesMode,
    selectedCountries,
    selectedCountry,
  ])

  // Build deck.gl layer stack
  const layers = useMemo(() => {
    const list: any[] = []
    const isCartesian = projection === 'Equirectangular' || projection === 'EqualEarth'

    // 1. Basemap Layer (ESRI or Land/Sea when "None" or Equal Earth)
    if (basemap === 'none' || projection === 'EqualEarth') {
      // Ocean background
      if (projection !== 'EqualEarth') {
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
            coordinateSystem: isCartesian ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
            _imageCoordinateSystem: projection === 'Globe' ? 'lnglat' : undefined,
            filled: true,
            getPolygon: (d: any) => d.polygon,
            getFillColor: [14, 18, 26, 255],
            stroked: false,
            parameters: { depthTest: false },
          })
        )
      }

      // Land fill
      const landData = projection === 'EqualEarth' ? equalEarthLandGeoJson : landGeoJson
      if (landData) {
        list.push(
          new GeoJsonLayer({
            id: `ne-land-${projection}`,
            data: landData,
            coordinateSystem: isCartesian ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
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

    // 2. Graticule Lines Layer
    if (showGraticule) {
      list.push(
        new PathLayer({
          id: `graticule-layer-${projection}`,
          data: graticulePaths,
          getPath: (d: any) => d.path,
          getColor: [255, 255, 255, 38],
          coordinateSystem: isCartesian ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          widthUnits: 'pixels',
          widthMinPixels: 1,
          widthMaxPixels: 1,
          getWidth: 1,
          pickable: false,
        })
      )
    }

    // 3. GeoPNG Raster Layer (Tesselated 3D mesh draped with renderedCanvas)
    if (renderedCanvas) {
      list.push(
        new TesselatedBitmapLayer({
          id: `geopng-raster-${projection}-${heightmapConfig.enabled ? '3d' : '2d'}-${heightmapConfig.elevationScale}`,
          bounds: rasterBounds,
          image: renderedCanvas,
          opacity: opacity,
          pickable: true,
          coordinateSystem: isCartesian ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          _imageCoordinateSystem: projection === 'Globe' ? 'lnglat' : undefined,
          projection,
          heightmapEnabled: heightmapConfig.enabled,
          elevationScale: heightmapConfig.elevationScale,
          rasterData: raster?.data,
          rasterWidth: raster?.width,
          rasterHeight: raster?.height,
          minVal,
          maxVal,
          textureParameters: {
            minFilter: 'nearest',
            magFilter: 'nearest',
            mipmapFilter: 'nearest',
          },
        })
      )
    }

    // 3.5. 3D Elevation Spike Map Layer (Uniform Rectangular Parent-Pixel SolidPolygonLayer)
    if (heightmapConfig.enabled && elevationSpikesData.points && elevationSpikesData.points.length > 0) {
      list.push(
        new SolidPolygonLayer({
          id: `elevation-spikes-${projection}`,
          data: elevationSpikesData.points,
          getPolygon: (d: any) => d.polygon,
          getElevation: (d: any) => d.elevation,
          getFillColor: (d: any) => d.color,
          extruded: true,
          flatShading: true,
          opacity: heightmapConfig.opacity ?? 0.9,
          elevationScale: 1,
          coordinateSystem: isCartesian ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
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

    // 4. High-Value Equal-Area Circle Pixels (Hollow interior, coloured outline, adjustable black halo)
    if (circlePixelData.length > 0) {
      const strokeW = circleOverlayConfig.strokeWidth || 2
      const haloW = circleOverlayConfig.haloWidth ?? 1

      // Outer black halo outline
      list.push(
        new ScatterplotLayer({
          id: `circle-pixels-halo-${projection}-${strokeW}-${haloW}`,
          data: circlePixelData,
          getPosition: (d: any) => d.position,
          getRadius: (d: any) => d.radius,
          filled: false,
          stroked: true,
          getLineColor: [0, 0, 0, 255],
          getLineWidth: strokeW + haloW * 2,
          lineWidthUnits: 'pixels',
          radiusUnits: isCartesian ? 'common' : 'meters',
          coordinateSystem: isCartesian ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          pickable: false,
          parameters: { depthTest: false },
        })
      )

      // Inner coloured stroke outline (transparent/hollow center)
      list.push(
        new ScatterplotLayer({
          id: `circle-pixels-stroke-${projection}-${strokeW}`,
          data: circlePixelData,
          getPosition: (d: any) => d.position,
          getRadius: (d: any) => d.radius,
          filled: false,
          stroked: true,
          getLineColor: (d: any) => d.color,
          getLineWidth: strokeW,
          lineWidthUnits: 'pixels',
          radiusUnits: isCartesian ? 'common' : 'meters',
          coordinateSystem: isCartesian ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          pickable: true,
          parameters: { depthTest: false },
        })
      )
    }

    // 5. Selected Countries Highlight
    const effectiveSelected =
      selectedCountries && selectedCountries.length > 0
        ? selectedCountries
        : selectedCountry
        ? [selectedCountry]
        : []

    if (effectiveSelected.length > 0) {
      const selectedData =
        projection === 'EqualEarth'
          ? effectiveSelected.map((c) => ({
              ...c,
              geometry: transformGeometryToEqualEarth(c.geometry),
            }))
          : effectiveSelected.map((c) => ({ ...c, geometry: { ...c.geometry } }))

      list.push(
        new GeoJsonLayer({
          id: `countries-selected-${selectionId}-${projection}`,
          data: selectedData,
          coordinateSystem: isCartesian ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
          filled: true,
          getFillColor: [240, 60, 60, 30],
          stroked: true,
          getLineColor: [240, 60, 60, 220],
          getLineWidth: 2,
          lineWidthUnits: 'pixels',
          parameters: { depthTest: false },
        })
      )
    }

    // 6. Hovered Country Highlight in Countries Mode
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

      const hoveredData =
        projection === 'EqualEarth'
          ? [{ ...hoveredCountry, geometry: transformGeometryToEqualEarth(hoveredCountry.geometry) }]
          : [{ ...hoveredCountry, geometry: { ...hoveredCountry.geometry } }]

      list.push(
        new GeoJsonLayer({
          id: `country-hovered-${hovKey}-${hoverId}-${projection}`,
          data: hoveredData,
          coordinateSystem: isCartesian ? COORDINATE_SYSTEM.CARTESIAN : COORDINATE_SYSTEM.LNGLAT,
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

    return list
  }, [
    projection,
    basemap,
    landGeoJson,
    equalEarthLandGeoJson,
    showGraticule,
    graticulePaths,
    renderedCanvas,
    rasterBounds,
    opacity,
    heightmapConfig,
    elevationSpikesData,
    circleOverlayConfig,
    circlePixelData,
    raster,
    minVal,
    maxVal,
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
        controller={{ doubleClickZoom: false, dragRotate: true }}
        layers={layers}
        onClick={handleClick}
        onHover={handleHover}
        getCursor={({ isHovering }) => (isHovering ? 'crosshair' : 'grab')}
      />

      {/* Floating HUD Inspector */}
      <ClickInfoPanel info={inspectData} pos={cursorPos} />

      {/* Color Ramp Legend (Top Left by Sidebar) */}
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
          {/* Map Display Settings Toggle (Basemaps & Projections) - ALWAYS AT TOP with GEAR ICON */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={flyoutOpen ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setFlyoutOpen(!flyoutOpen)}
                className="h-7 w-7 rounded-none text-white"
                aria-label="Map Display Settings"
              >
                <Icon name="settings" className="text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <span>Map Display Settings (Basemap & Projection)</span>
            </TooltipContent>
          </Tooltip>

          {/* Toggle Raster Analytics View Panel */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={analyticsOpen ? 'secondary' : 'ghost'}
                size="icon"
                onClick={onToggleAnalytics}
                className="h-7 w-7 rounded-none text-white"
                aria-label="Toggle Raster Analytics"
              >
                <Icon name="analytics" className="text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <span>Toggle Raster Analytics (Top Right View Panel)</span>
            </TooltipContent>
          </Tooltip>

          {/* Toggle Graticule Grid Lines */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showGraticule ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setShowGraticule(!showGraticule)}
                className="h-7 w-7 rounded-none text-white"
                aria-label="Toggle Graticule Grid"
              >
                <Icon name="grid_on" className="text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <span>Toggle Graticule Grid (Parallels & Meridians)</span>
            </TooltipContent>
          </Tooltip>

          {/* Reset Map View (Center & Zoom) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDoubleClick}
                className="h-7 w-7 rounded-none text-white"
                aria-label="Reset View"
              >
                <Icon name="restart_alt" className="text-white" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <span>Reset Map View (Center & Zoom)</span>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Map Display Settings Flyout Panel */}
        {flyoutOpen && (
          <div className="absolute top-4 right-14 z-30 w-72 bg-card/98 backdrop-blur-md border border-border rounded-none p-3 shadow-2xl text-xs text-card-foreground animate-in fade-in-0 zoom-in-95 duration-100 font-sans space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
                <Icon name="layers" size="0.9rem" className="text-white" />
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

            {/* Spatial Projection Section with Equal Earth */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-foreground block">Spatial Projection</span>
              <div className="grid grid-cols-2 gap-1">
                {(['Mercator', 'Equirectangular', 'Globe', 'EqualEarth'] as ProjectionType[]).map((p) => (
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
                    {p === 'Equirectangular' ? 'Equirect.' : p === 'EqualEarth' ? 'Equal Earth' : p}
                  </button>
                ))}
              </div>
            </div>

            {/* Basemap Selection Section (Cycle Next button removed) */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-foreground">Basemap Layer</span>

              <div className="space-y-1 bg-background/60 p-1.5 rounded-none border border-border">
                {MAP_CONFIG.basemapLayers.map((item: { id: string; label: string }) => (
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

      {/* Bottom Right Tray: Unified Mapmodes with Inline Settings */}
      <MapmodesTray
        mapModes={mapModes}
        onToggleMapMode={onToggleMapMode}
        onReorderMapModes={onReorderMapModes}
        countriesMode={Boolean(countriesMode)}
        onToggleCountriesMode={onToggleCountriesMode}
        selectedCountries={selectedCountries || []}
        onToggleCountry={onToggleCountry || (() => {})}
        onClearCountries={onClearCountries || (() => {})}
        countryStats={countryStats}
        heightmapConfig={heightmapConfig}
        setHeightmapConfig={setHeightmapConfig || (() => {})}
        circleOverlayConfig={circleOverlayConfig}
        setCircleOverlayConfig={setCircleOverlayConfig || (() => {})}
        allCountries={countryFeatures}
      />
    </div>
  )
}

export default MapViewer
