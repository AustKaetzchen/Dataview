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
  binRasterByCountryMemoized,
} from './lib/geopng/polygonBinning'
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
  const [boundsMode, setBoundsMode] = useState<BoundsMode>('Manual')
  const [minValOverride, setMinValOverride] = useState<string>('')
  const [maxValOverride, setMaxValOverride] = useState<string>('')
  const [percentileList, setPercentileList] = useState<string>('0, 25, 50, 75, 100')
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

  // Country Selection and Countries Mode (hover inspection) for Polygon Binning
  const [selectedCountry, setSelectedCountry] = useState<CountryFeature | null>(null)
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

  // Active country for statistics (hovered country in Countries Mode, or selected country)
  const activeCountry = countriesMode ? (hoveredCountry || selectedCountry) : selectedCountry

  // Compute Country Polygon Binning statistics when active raster or active country changes
  const countryStats = useMemo<CountryStats | null>(() => {
    if (!activeRaster || !activeCountry) return null
    try {
      return binRasterByCountryMemoized(activeRaster, activeCountry)
    } catch (err) {
      console.error('Failed to bin raster by country:', err)
      return null
    }
  }, [activeRaster, activeCountry])

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

    // Render directly into canvas without downsampling
    const { canvas, bounds } = renderRasterToCanvas(
      activeRaster.data,
      activeRaster.width,
      activeRaster.height,
      {
        palette: colorPalette,
        scaleType,
        logSigma,
        minVal,
        maxVal,
        projection,
      }
    )

    // Calculate bounds with 1-pixel south correction for Equirectangular projection
    const pixelHeight = 180 / activeRaster.height
    const finalBounds: [number, number, number, number] =
      projection === 'Equirectangular'
        ? [-180, -90 - pixelHeight, 180, 90 - pixelHeight]
        : bounds

    return { renderedCanvas: canvas, rasterBounds: finalBounds }
  }, [activeRaster, colorPalette, scaleType, logSigma, minVal, maxVal, projection])

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
          minVal={minVal}
          maxVal={maxVal}
          legendTitle={legendTitle}
          scaleType={scaleType}
          logSigma={logSigma}
          breaks={breaks}
          selectedCountry={selectedCountry}
          onSelectCountry={setSelectedCountry}
          countriesMode={countriesMode}
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
          selectedCountry={selectedCountry}
          onSelectCountry={setSelectedCountry}
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
