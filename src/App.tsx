import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  AppMode,
  DataFormat,
  ScaleType,
  ColorPalette,
  BoundsMode,
  ProjectionType,
  DecodedRaster,
} from './lib/geopng/types'
import {
  decodeRawGeoPngBuffer,
  computeRasterDifference,
} from './lib/geopng/decoder'
import { renderRasterToCanvas } from './lib/geopng/palettes'
import { computeQuantiles } from './lib/geopng/scales'
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
  const [legendTitle, setLegendTitle] = useState<string>('Value')
  const [opacity, setOpacity] = useState<number>(0.85)

  // Keep raw Uint8Arrays for fast format re-decoding
  const [rawBytesA, setRawBytesA] = useState<Uint8Array | null>(null)
  const [rawBytesB, setRawBytesB] = useState<Uint8Array | null>(null)

  // Loaded Raster States (null by default until user uploads a GeoPNG)
  const [rasterA, setRasterA] = useState<DecodedRaster | null>(null)
  const [rasterB, setRasterB] = useState<DecodedRaster | null>(null)
  const [activeFileName, setActiveFileName] = useState<string>('')
  const [diffNameA, setDiffNameA] = useState<string>('')
  const [diffNameB, setDiffNameB] = useState<string>('')

  // Multi-Country Selection and Countries Mode for Polygon Binning
  const [selectedCountries, setSelectedCountries] = useState<CountryFeature[]>([])
  const [hoveredCountry, setHoveredCountry] = useState<CountryFeature | null>(null)
  const [countriesMode, setCountriesMode] = useState<boolean>(false)

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

  // Handle User File Uploads with pure fast-png (zero canvas corruption)
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

  // Determine the active raster to display
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

  // Calculate visual bounds (Manual or Percentile)
  const { minVal, maxVal, breaks } = useMemo(() => {
    if (!activeRaster) {
      return { minVal: 0, maxVal: 1, breaks: [] }
    }

    if (boundsMode === 'Percentile') {
      const parts = percentileList
        .split(',')
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !Number.isNaN(n))
        .map((p) => p / 100)

      if (parts.length > 0) {
        const qBreaks = computeQuantiles(activeRaster.data, parts)
        const pMin = Math.min(...qBreaks)
        const pMax = Math.max(...qBreaks)
        return { minVal: pMin, maxVal: pMax, breaks: qBreaks }
      }
    }

    const parsedMin = minValOverride !== '' ? parseFloat(minValOverride) : activeRaster.min
    const parsedMax = maxValOverride !== '' ? parseFloat(maxValOverride) : activeRaster.max

    const safeMin = Number.isFinite(parsedMin) ? parsedMin : activeRaster.min
    const safeMax = Number.isFinite(parsedMax) ? parsedMax : activeRaster.max

    return { minVal: safeMin, maxVal: safeMax, breaks: [] }
  }, [activeRaster, boundsMode, percentileList, minValOverride, maxValOverride])

  // Multi-country toggle handler
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
      if (!c) {
        setSelectedCountries([])
      } else {
        handleToggleCountry(c)
      }
    },
    [handleToggleCountry]
  )

  // Active countries for statistics (selected countries if any, or hovered country in Countries Mode)
  const activeCountries = useMemo<CountryFeature[]>(() => {
    if (selectedCountries.length > 0) return selectedCountries
    if (countriesMode && hoveredCountry) return [hoveredCountry]
    return []
  }, [countriesMode, selectedCountries, hoveredCountry])

  // Compute Country Polygon Binning statistics when active raster or active countries change
  const countryStats = useMemo<CountryStats | null>(() => {
    if (!activeRaster || activeCountries.length === 0) return null
    try {
      return binRasterByMultipleCountries(activeRaster, activeCountries)
    } catch (err) {
      console.error('Failed to bin raster by countries:', err)
      return null
    }
  }, [activeRaster, activeCountries])

  // Render raster canvas synchronously with parameters to guarantee 100% projection sync
  const { renderedCanvas, rasterBounds } = useMemo(() => {
    if (!activeRaster) {
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
    // and restrict visual color ramp to the country's data range
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

    // Render directly into canvas without downsampling
    const { canvas, bounds } = renderRasterToCanvas(
      activeRaster.data,
      activeRaster.width,
      activeRaster.height,
      {
        palette: colorPalette,
        invertPalette,
        scaleType,
        logSigma,
        minVal: effectiveMin,
        maxVal: effectiveMax,
        projection,
        activeCountries: countriesMode && activeCountries.length > 0 ? activeCountries : null,
      }
    )

    // Calculate bounds with pixel offset corrections from MAP_CONFIG (config/map.json5)
    const pixelHeight = 180 / activeRaster.height
    let finalBounds: [number, number, number, number] = bounds

    if (projection === 'Equirectangular') {
      const offset = (MAP_CONFIG.equirectangularPixelOffset ?? -1) * pixelHeight
      finalBounds = [-180, -90 + offset, 180, 90 + offset]
    } else if (projection === 'Mercator') {
      const offset = (MAP_CONFIG.mercatorPixelOffset ?? -1) * pixelHeight
      finalBounds = [-180, -90 + offset, 180, 90 + offset]
    }

    return { renderedCanvas: canvas, rasterBounds: finalBounds }
  }, [
    activeRaster,
    colorPalette,
    invertPalette,
    scaleType,
    logSigma,
    minVal,
    maxVal,
    projection,
    countriesMode,
    activeCountries,
    countryStats,
  ])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar Controls Dock */}
      <SidebarControls
        appMode={appMode}
        setAppMode={setAppMode}
        dataFormat={dataFormat}
        setDataFormat={setDataFormat}
        projection={projection}
        setProjection={setProjection}
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
        legendTitle={legendTitle}
        setLegendTitle={setLegendTitle}
        opacity={opacity}
        setOpacity={setOpacity}
        onFileUpload={handleFileUpload}
        activeFileName={activeFileName}
        diffNameA={diffNameA}
        diffNameB={diffNameB}
        countriesMode={countriesMode}
        onToggleCountriesMode={setCountriesMode}
        selectedCountries={selectedCountries}
        onToggleCountry={handleToggleCountry}
        onClearCountries={handleClearCountries}
        hoveredCountry={hoveredCountry}
        countryStats={countryStats}
      />

      {/* Main Map Viewer & Analytics Drawer */}
      <div className="relative flex-1 h-full overflow-hidden">
        <MapViewer
          raster={activeRaster}
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
          selectedCountry={selectedCountries[0] || null}
          selectedCountries={selectedCountries}
          onSelectCountry={handleSelectCountry}
          onToggleCountry={handleToggleCountry}
          countriesMode={countriesMode}
          onToggleCountriesMode={setCountriesMode}
          hoveredCountry={hoveredCountry}
          onHoverCountry={setHoveredCountry}
          countryStats={countryStats}
        />

        {/* ECharts Analytical Drawer */}
        <AnalyticsDrawer
          raster={activeRaster}
          scaleType={scaleType}
          logSigma={logSigma}
          minOverride={minValOverride !== '' ? parseFloat(minValOverride) : undefined}
          maxOverride={maxValOverride !== '' ? parseFloat(maxValOverride) : undefined}
          selectedCountry={selectedCountries[0] || null}
          selectedCountries={selectedCountries}
          onSelectCountry={handleSelectCountry}
          onClearCountries={handleClearCountries}
          countriesMode={countriesMode}
          onToggleCountriesMode={setCountriesMode}
          hoveredCountry={hoveredCountry}
          countryStats={countryStats}
        />
      </div>
    </div>
  )
}

export default App
