import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react'
import {
  AppMode,
  DataFormat,
  ScaleType,
  ColorPalette,
  BoundsMode,
  ProjectionType,
  DecodedRaster,
  BinningConfig,
  HeightmapConfig,
  CircleOverlayConfig,
  MapModeItem,
  MapModeId,
} from './lib/geopng/types'
import {
  decodeRawGeoPngBuffer,
  computeRasterDifference,
} from './lib/geopng/decoder'
import { renderRasterToCanvas } from './lib/geopng/palettes'
import { computeQuantiles } from './lib/geopng/scales'
import { createBinnedRaster } from './lib/geopng/downsampling'
import {
  CountryFeature,
  CountryStats,
  binRasterByMultipleCountries,
} from './lib/geopng/polygonBinning'
import { MAP_CONFIG } from '@config'
import { SidebarControls } from './components/controls/SidebarControls'
import { MapViewer } from './components/map/MapViewer'
import { AnalyticsDrawer } from './components/analytics/AnalyticsDrawer'

export const App: React.FC = () => {
  // Application State
  const [appMode, setAppMode] = useState<AppMode>('Single Image')
  const [dataFormat, setDataFormat] = useState<DataFormat>('float32')
  const [projection, setProjection] = useState<ProjectionType>('Mercator')
  const [scaleType, setScaleType] = useState<ScaleType>('pseudo-log')
  const [logSigma, setLogSigma] = useState<number>(1.0)
  const [colorPalette, setColorPalette] = useState<ColorPalette>('Plasma')
  const [invertPalette, setInvertPalette] = useState<boolean>(false)
  const [boundsMode, setBoundsMode] = useState<BoundsMode>('Manual')
  const [minValOverride, setMinValOverride] = useState<string>('')
  const [maxValOverride, setMaxValOverride] = useState<string>('')
  const [percentileList, setPercentileList] = useState<string>(
    MAP_CONFIG.defaultPercentileBreaks || '0, 1, 5, 25, 50, 75, 95, 99, 100'
  )
  const [absoluteBreaks, setAbsoluteBreaks] = useState<string>('0, 10, 50, 100, 500, 1000')
  const [legendTitle, setLegendTitle] = useState<string>('Value')
  const [opacity, setOpacity] = useState<number>(0.85)

  // 3D Heightmap, Proportional Circles & Binning
  const [binningConfig, setBinningConfig] = useState<BinningConfig>({
    enabled: false,
    width: 720,
    height: 360,
    method: 'average',
  })
  const [heightmapConfig, setHeightmapConfig] = useState<HeightmapConfig>({
    enabled: false,
    elevationScale: 250000,
  })
  const [circleOverlayConfig, setCircleOverlayConfig] = useState<CircleOverlayConfig>({
    enabled: false,
    percentileCutoff: 99,
    baseRadius: 1.0,
    strokeWidth: 2,
    haloWidth: 2,
  })

  // Composable & Reorderable Mapmodes stack
  const [mapModes, setMapModes] = useState<MapModeItem[]>([
    { id: 'default', label: 'Default Raster', active: true },
    { id: 'country_analysis', label: 'Country Analysis', active: false },
  ])

  // Top right view panel for analytics
  const [analyticsOpen, setAnalyticsOpen] = useState<boolean>(false)

  // Raw Uint8Arrays for fast format re-decoding
  const [rawBytesA, setRawBytesA] = useState<Uint8Array | null>(null)
  const [rawBytesB, setRawBytesB] = useState<Uint8Array | null>(null)

  // Loaded Raster States
  const [rasterA, setRasterA] = useState<DecodedRaster | null>(null)
  const [rasterB, setRasterB] = useState<DecodedRaster | null>(null)
  const [activeFileName, setActiveFileName] = useState<string>('')
  const [diffNameA, setDiffNameA] = useState<string>('')
  const [diffNameB, setDiffNameB] = useState<string>('')

  // Multi-Country Selection and Countries Mode
  const [selectedCountries, setSelectedCountries] = useState<CountryFeature[]>([])
  const [hoveredCountry, setHoveredCountry] = useState<CountryFeature | null>(null)
  const [countriesMode, setCountriesMode] = useState<boolean>(false)

  // Asynchronous / deferred values for non-blocking UI reflows
  const deferredSelectedCountries = useDeferredValue(selectedCountries)
  const deferredHoveredCountry = useDeferredValue(hoveredCountry)

  // Re-decode when user changes format (float32 <-> int32)
  useEffect(() => {
    if (rawBytesA) {
      const decodedA = decodeRawGeoPngBuffer(rawBytesA, dataFormat)
      setRasterA(decodedA)
    }
    if (rawBytesB) {
      const decodedB = decodeRawGeoPngBuffer(rawBytesB, dataFormat)
      setRasterB(decodedB)
    }
  }, [dataFormat])

  // File Uploads
  const handleFileUpload = useCallback(
    async (file: File, target: 'single' | 'diff_a' | 'diff_b') => {
      try {
        const buffer = await file.arrayBuffer()
        const uint8 = new Uint8Array(buffer)
        const decoded = decodeRawGeoPngBuffer(uint8, dataFormat)

        if (target === 'single') {
          setRawBytesA(uint8)
          setRasterA(decoded)
          setActiveFileName(file.name)
        } else if (target === 'diff_a') {
          setRawBytesA(uint8)
          setRasterA(decoded)
          setDiffNameA(file.name)
        } else if (target === 'diff_b') {
          setRawBytesB(uint8)
          setRasterB(decoded)
          setDiffNameB(file.name)
        }
      } catch (err) {
        console.error('Failed to load GeoPNG file:', err)
        alert(`Could not decode GeoPNG file: ${(err as Error).message}`)
      }
    },
    [dataFormat]
  )

  // Determine active raw raster
  const activeRaster = useMemo<DecodedRaster | null>(() => {
    if (appMode === 'Single Image') {
      return rasterA
    } else {
      if (rasterA && rasterB) {
        return computeRasterDifference(rasterA, rasterB)
      }
      return rasterA
    }
  }, [appMode, rasterA, rasterB])

  // Downsampled / Binned raster if binning enabled
  const displayRaster = useMemo<DecodedRaster | null>(() => {
    if (!activeRaster) return null
    if (!binningConfig.enabled) return activeRaster
    try {
      return createBinnedRaster(
        activeRaster,
        binningConfig.width,
        binningConfig.height,
        binningConfig.method
      )
    } catch (e) {
      console.error('Failed to bin raster:', e)
      return activeRaster
    }
  }, [activeRaster, binningConfig])

  // Visual Bounds Calculation (Manual, Percentile, or Absolute)
  const { minVal, maxVal, breaks } = useMemo(() => {
    const r = displayRaster || activeRaster
    if (!r) {
      return { minVal: 0, maxVal: 1, breaks: [] }
    }

    if (boundsMode === 'Percentile') {
      const parts = percentileList
        .split(',')
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !Number.isNaN(n))
        .map((p) => p / 100)

      if (parts.length > 0) {
        const qBreaks = computeQuantiles(r.data, parts)
        const pMin = Math.min(...qBreaks)
        const pMax = Math.max(...qBreaks)
        return { minVal: pMin, maxVal: pMax, breaks: qBreaks }
      }
    } else if (boundsMode === 'Absolute') {
      const parts = absoluteBreaks
        .split(',')
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !Number.isNaN(n))
        .sort((a, b) => a - b)

      if (parts.length >= 2) {
        return {
          minVal: parts[0],
          maxVal: parts[parts.length - 1],
          breaks: parts,
        }
      }
    }

    const parsedMin = minValOverride !== '' ? parseFloat(minValOverride) : r.min
    const parsedMax = maxValOverride !== '' ? parseFloat(maxValOverride) : r.max

    const safeMin = Number.isFinite(parsedMin) ? parsedMin : r.min
    const safeMax = Number.isFinite(parsedMax) ? parsedMax : r.max

    return { minVal: safeMin, maxVal: safeMax, breaks: [] }
  }, [displayRaster, activeRaster, boundsMode, percentileList, absoluteBreaks, minValOverride, maxValOverride])

  // Multi-country toggle handler (immediate UI response)
  const handleToggleCountry = useCallback((c: CountryFeature) => {
    setSelectedCountries((prev) => {
      const exists = prev.some(
        (x) =>
          (x.properties.iso_a3 && x.properties.iso_a3 !== '-99' && x.properties.iso_a3 === c.properties.iso_a3) ||
          x.properties.name === c.properties.name
      )
      if (exists) {
        return prev.filter(
          (x) =>
            !(
              (x.properties.iso_a3 && x.properties.iso_a3 !== '-99' && x.properties.iso_a3 === c.properties.iso_a3) ||
              x.properties.name === c.properties.name
            )
        )
      } else {
        return [...prev, c]
      }
    })
  }, [])

  const handleClearCountries = useCallback(() => {
    setSelectedCountries([])
  }, [])

  const handleSelectCountry = useCallback(
    (c: CountryFeature | null) => {
      if (!c) setSelectedCountries([])
      else handleToggleCountry(c)
    },
    [handleToggleCountry]
  )

  // Synchronize countriesMode with mapModes stack
  const handleToggleCountriesMode = useCallback((enabled: boolean) => {
    setCountriesMode(enabled)
    setMapModes((prev) =>
      prev.map((m) => (m.id === 'country_analysis' ? { ...m, active: enabled } : m))
    )
  }, [])

  const handleToggleMapMode = useCallback((id: MapModeId) => {
    setMapModes((prev) => {
      const updated = prev.map((m) => (m.id === id ? { ...m, active: !m.active } : m))
      const countryModeActive = updated.find((m) => m.id === 'country_analysis')?.active ?? false
      setCountriesMode(countryModeActive)
      return updated
    })
  }, [])

  const handleReorderMapModes = useCallback((newModes: MapModeItem[]) => {
    setMapModes(newModes)
  }, [])

  // Active countries for deferred background calculations
  const deferredActiveCountries = useMemo<CountryFeature[]>(() => {
    if (deferredSelectedCountries.length > 0) return deferredSelectedCountries
    if (countriesMode && deferredHoveredCountry) return [deferredHoveredCountry]
    return []
  }, [countriesMode, deferredSelectedCountries, deferredHoveredCountry])

  // Deferred Country Polygon Binning statistics
  const countryStats = useMemo<CountryStats | null>(() => {
    if (!activeRaster || deferredActiveCountries.length === 0) return null
    try {
      return binRasterByMultipleCountries(activeRaster, deferredActiveCountries)
    } catch (err) {
      console.error('Failed to bin raster by countries:', err)
      return null
    }
  }, [activeRaster, deferredActiveCountries])

  // Render raster canvas (uses downsampled raster if binning enabled)
  const { renderedCanvas, rasterBounds } = useMemo(() => {
    const r = displayRaster || activeRaster
    if (!r) {
      return {
        renderedCanvas: null,
        rasterBounds: (projection === 'Mercator'
          ? [-180, -85.051129, 180, 85.051129]
          : projection === 'Globe'
          ? [-180, -89.9, 180, 89.9]
          : [-180, -90, 180, 90]) as [number, number, number, number],
      }
    }

    // In Countries Mode with active countries, isolate the raster pixels to the country outline
    const isCountryIsolated = Boolean(
      countriesMode &&
        deferredActiveCountries.length > 0 &&
        countryStats &&
        countryStats.validCount > 0 &&
        Number.isFinite(countryStats.min) &&
        Number.isFinite(countryStats.max)
    )

    const effectiveMin = isCountryIsolated ? countryStats!.min : minVal
    const effectiveMax = isCountryIsolated ? countryStats!.max : maxVal

    const { canvas, bounds } = renderRasterToCanvas(
      r.data,
      r.width,
      r.height,
      {
        palette: colorPalette,
        invertPalette,
        scaleType,
        logSigma,
        minVal: effectiveMin,
        maxVal: effectiveMax,
        breaks,
        projection,
        activeCountries: countriesMode && deferredActiveCountries.length > 0 ? deferredActiveCountries : null,
      }
    )

    // Bounds with pixel offset corrections
    const pixelHeight = 180 / r.height
    let finalBounds: [number, number, number, number] = bounds

    if (projection === 'Equirectangular') {
      const offset = (MAP_CONFIG.equirectangularPixelOffset ?? -1) * pixelHeight
      finalBounds = [-180, -90 + offset, 180, 90 + offset]
    } else if (projection === 'Mercator') {
      const offset = (MAP_CONFIG.mercatorPixelOffset ?? -1) * pixelHeight
      finalBounds = [-180, -90 + offset, 180, 90 + offset]
    } else if (projection === 'EqualEarth') {
      finalBounds = [-180, -90, 180, 90]
    }

    return { renderedCanvas: canvas, rasterBounds: finalBounds }
  }, [
    displayRaster,
    activeRaster,
    colorPalette,
    invertPalette,
    scaleType,
    logSigma,
    minVal,
    maxVal,
    breaks,
    projection,
    countriesMode,
    deferredActiveCountries,
    countryStats,
  ])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar Controls Dock */}
      <SidebarControls
        appMode={appMode}
        dataFormat={dataFormat}
        setDataFormat={setDataFormat}
        scaleType={scaleType}
        setScaleType={setScaleType}
        logSigma={logSigma}
        setLogSigma={setLogSigma}
        colorPalette={colorPalette}
        setColorPalette={setColorPalette}
        invertPalette={invertPalette}
        setInvertPalette={setInvertPalette}
        boundsMode={boundsMode}
        setBoundsMode={setBoundsMode}
        minValOverride={minValOverride}
        setMinValOverride={setMinValOverride}
        maxValOverride={maxValOverride}
        setMaxValOverride={setMaxValOverride}
        percentileList={percentileList}
        setPercentileList={setPercentileList}
        absoluteBreaks={absoluteBreaks}
        setAbsoluteBreaks={setAbsoluteBreaks}
        legendTitle={legendTitle}
        setLegendTitle={setLegendTitle}
        opacity={opacity}
        setOpacity={setOpacity}
        onFileUpload={handleFileUpload}
        activeFileName={activeFileName}
        diffNameA={diffNameA}
        diffNameB={diffNameB}
        setAppMode={setAppMode}
        binningConfig={binningConfig}
        setBinningConfig={setBinningConfig}
        heightmapConfig={heightmapConfig}
        setHeightmapConfig={setHeightmapConfig}
        circleOverlayConfig={circleOverlayConfig}
        setCircleOverlayConfig={setCircleOverlayConfig}
        countriesMode={countriesMode}
        onToggleCountriesMode={handleToggleCountriesMode}
        selectedCountries={selectedCountries}
        onToggleCountry={handleToggleCountry}
        onClearCountries={handleClearCountries}
        hoveredCountry={hoveredCountry}
        countryStats={countryStats}
      />

      {/* Main Map Viewer */}
      <div className="relative flex-1 h-full overflow-hidden">
        <MapViewer
          raster={displayRaster || activeRaster}
          renderedCanvas={renderedCanvas}
          rasterBounds={rasterBounds}
          projection={projection}
          setProjection={setProjection}
          opacity={opacity}
          palette={colorPalette}
          invertPalette={invertPalette}
          minVal={minVal}
          maxVal={maxVal}
          legendTitle={legendTitle}
          scaleType={scaleType}
          logSigma={logSigma}
          breaks={breaks}
          mapModes={mapModes}
          onToggleMapMode={handleToggleMapMode}
          onReorderMapModes={handleReorderMapModes}
          heightmapConfig={heightmapConfig}
          circleOverlayConfig={circleOverlayConfig}
          analyticsOpen={analyticsOpen}
          onToggleAnalytics={() => setAnalyticsOpen((prev) => !prev)}
          selectedCountry={deferredSelectedCountries[0] || null}
          selectedCountries={deferredSelectedCountries}
          onSelectCountry={handleSelectCountry}
          onToggleCountry={handleToggleCountry}
          countriesMode={countriesMode}
          onToggleCountriesMode={handleToggleCountriesMode}
          hoveredCountry={hoveredCountry}
          onHoverCountry={setHoveredCountry}
          countryStats={countryStats}
        />

        {/* ECharts Analytical View Panel (Top Right) */}
        <AnalyticsDrawer
          isOpen={analyticsOpen}
          onToggleOpen={() => setAnalyticsOpen(false)}
          raster={displayRaster || activeRaster}
          scaleType={scaleType}
          logSigma={logSigma}
          minOverride={minValOverride !== '' ? parseFloat(minValOverride) : undefined}
          maxOverride={maxValOverride !== '' ? parseFloat(maxValOverride) : undefined}
          selectedCountry={deferredSelectedCountries[0] || null}
          selectedCountries={deferredSelectedCountries}
          onSelectCountry={handleSelectCountry}
          onClearCountries={handleClearCountries}
          countryStats={countryStats}
        />
      </div>
    </div>
  )
}

export default App
