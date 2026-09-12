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
} from './lib/geopng/polygonBinning'
import { useCountryStatsAsync } from './lib/geopng/useCountryStatsAsync'
import { MAP_CONFIG, MAPMODES_CONFIG, getPixelOffset } from '@config'
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
    elevationScale: 800000,
    opacity: 0.9,
    opacityByPercentile: false,
    opacityByPercentileStrength: 1.0,
  })
  const [sidebarWidth, setSidebarWidth] = useState<number>(336)
  const [colourbarWidth, setColourbarWidth] = useState<number>(336)
  const [infoPanelOpen, setInfoPanelOpen] = useState<boolean>(false)
  const [circleOverlayConfig, setCircleOverlayConfig] = useState<CircleOverlayConfig>({
    enabled: false,
    percentileCutoff: 99,
    baseRadius: 1.0,
    strokeWidth: 2,
    haloWidth: 1,
  })

  // Composable & Reorderable Mapmodes stack initialized from MAPMODES_CONFIG (mapmodes.json5)
  const [mapModes, setMapModes] = useState<MapModeItem[]>(() =>
    MAPMODES_CONFIG.modes.map((m) => ({
      id: m.id,
      label: m.label,
      active: m.active ?? false,
    }))
  )

  // Top right view panel for analytics & settings drawer
  const [analyticsOpen, setAnalyticsOpen] = useState<boolean>(false)
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState<boolean>(false)

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

  // Synchronize countriesMode, heightmapConfig, circleOverlayConfig with mapModes stack
  const handleToggleCountriesMode = useCallback((enabled: boolean) => {
    setCountriesMode(enabled)
    setMapModes((prev) =>
      prev.map((m) => (m.id === 'country_analysis' ? { ...m, active: enabled } : m))
    )
  }, [])

  const handleToggleMapMode = useCallback((id: MapModeId) => {
    setMapModes((prev) => {
      const updated = prev.map((m) => (m.id === id ? { ...m, active: !m.active } : m))
      const countryActive = updated.find((m) => m.id === 'country_analysis')?.active ?? false
      const spikeActive = updated.find((m) => m.id === 'spike_map')?.active ?? false
      const circleActive = updated.find((m) => m.id === 'circle_sizing')?.active ?? false
      setCountriesMode(countryActive)
      setHeightmapConfig((h) => ({ ...h, enabled: spikeActive }))
      setCircleOverlayConfig((c) => ({ ...c, enabled: circleActive }))
      return updated
    })
  }, [])

  const handleReorderMapModes = useCallback((newModes: MapModeItem[]) => {
    setMapModes(newModes)
  }, [])

  const handleUpdateBreaks = useCallback((newBreaks: number[]) => {
    setBoundsMode('Absolute')
    setAbsoluteBreaks(newBreaks.map((n) => (Math.round(n * 1000) / 1000).toString()).join(', '))
  }, [])

  // Active countries: prioritize selected countries, fallback to hovered country in countriesMode
  const activeCountries = useMemo<CountryFeature[]>(() => {
    if (selectedCountries.length > 0) return selectedCountries
    if (countriesMode && hoveredCountry) return [hoveredCountry]
    return []
  }, [countriesMode, selectedCountries, hoveredCountry])

  const isHoverOnly = selectedCountries.length === 0 && Boolean(hoveredCountry)

  // Asynchronous background Web Worker for heavy polygon binning & country stats
  const { countryStats, isCalculatingStats } = useCountryStatsAsync({
    activeRaster,
    activeCountries,
    isHoverOnly,
  })

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
    // Raster isolation applies once countryStats calculation is ready
    const isCountryIsolated = Boolean(
      countriesMode &&
        activeCountries.length > 0 &&
        countryStats &&
        countryStats.validCount > 0 &&
        Number.isFinite(countryStats.min) &&
        Number.isFinite(countryStats.max)
    )

    const effectiveMin = isCountryIsolated ? countryStats!.min : minVal
    const effectiveMax = isCountryIsolated ? countryStats!.max : maxVal

    const { canvas } = renderRasterToCanvas(
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
        activeCountries: isCountryIsolated ? activeCountries : null,
      }
    )

    // Bounds with pixel offset corrections
    const pixelHeight = 180 / r.height
    const pixelOffset = getPixelOffset(projection)
    const offset = pixelOffset * pixelHeight
    const finalBounds: [number, number, number, number] = [-180, -90 + offset, 180, 90 + offset]

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
    activeCountries,
    countryStats,
  ])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Main Map Viewer (Full viewport scene extending behind floating sidebar) */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
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
          onUpdateBreaks={handleUpdateBreaks}
          mapModes={mapModes}
          onToggleMapMode={handleToggleMapMode}
          onReorderMapModes={handleReorderMapModes}
          heightmapConfig={heightmapConfig}
          setHeightmapConfig={setHeightmapConfig}
          circleOverlayConfig={circleOverlayConfig}
          setCircleOverlayConfig={setCircleOverlayConfig}
          analyticsOpen={analyticsOpen}
          onToggleAnalytics={() => setAnalyticsOpen((prev) => !prev)}
          selectedCountry={selectedCountries[0] || null}
          selectedCountries={selectedCountries}
          deferredSelectedCountries={deferredSelectedCountries}
          isCalculatingStats={isCalculatingStats}
          onSelectCountry={handleSelectCountry}
          onToggleCountry={handleToggleCountry}
          onClearCountries={handleClearCountries}
          countriesMode={countriesMode}
          onToggleCountriesMode={handleToggleCountriesMode}
          hoveredCountry={hoveredCountry}
          onHoverCountry={setHoveredCountry}
          countryStats={countryStats}
          settingsDrawerOpen={settingsDrawerOpen}
          onToggleSettingsDrawer={setSettingsDrawerOpen}
          sidebarWidth={sidebarWidth}
          colourbarWidth={colourbarWidth}
          onResizeColourbarWidth={setColourbarWidth}
          infoPanelOpen={infoPanelOpen}
          onToggleInfoPanel={() => setInfoPanelOpen((prev) => !prev)}
          onCloseInfoPanel={() => setInfoPanelOpen(false)}
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
          selectedCountry={selectedCountries[0] || null}
          selectedCountries={selectedCountries}
          onSelectCountry={handleSelectCountry}
          onClearCountries={handleClearCountries}
          countryStats={countryStats}
          isCalculatingStats={isCalculatingStats}
          isSettingsDrawerOpen={settingsDrawerOpen}
        />
      </div>

      {/* Floating Sidebar Controls Dock */}
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
        mapModes={mapModes}
        heightmapConfig={heightmapConfig}
        circleOverlayConfig={circleOverlayConfig}
        selectedCountries={deferredSelectedCountries}
        onToggleMapMode={handleToggleMapMode}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
        infoPanelOpen={infoPanelOpen}
        onToggleInfoPanel={() => setInfoPanelOpen((prev) => !prev)}
      />
    </div>
  )
}

export default App
