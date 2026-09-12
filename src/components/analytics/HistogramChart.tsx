import React, { useMemo, useState, useRef, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { DecodedRaster, ScaleType } from '@/lib/geopng/types'

interface HistogramChartProps {
  raster: DecodedRaster | null
  scaleType: ScaleType
  logSigma: number
  minOverride?: number
  maxOverride?: number
  countryStats?: {
    name: string
    histogram: { bins: number[]; counts: number[]; min: number; max: number }
    quantiles: Record<number, number>
  } | null
}

export const HistogramChart: React.FC<HistogramChartProps> = ({
  raster,
  scaleType,
  logSigma: _logSigma,
  minOverride,
  maxOverride,
  countryStats,
}) => {
  // Toggle between logarithmic (default) and linear distributions
  const [scaleMode, setScaleMode] = useState<'log' | 'linear'>('log')
  // Steepness adjustment factor for logarithmic mode - unbounded custom input
  const [steepnessInput, setSteepnessInput] = useState<string>('1.0')
  const steepness = useMemo(() => {
    const val = parseFloat(steepnessInput)
    return Number.isFinite(val) && val !== 0 ? val : 1.0
  }, [steepnessInput])

  const containerRef = useRef<HTMLDivElement>(null)
  const echartRef = useRef<any>(null)

  // Robust resize listener using ResizeObserver and animation frame dispatching
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const triggerResize = () => {
      if (echartRef.current) {
        const instance = echartRef.current.getEchartsInstance?.()
        if (instance && !instance.isDisposed?.()) {
          instance.resize()
        }
      }
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          requestAnimationFrame(triggerResize)
        }
      }
    })

    observer.observe(container)

    // Fire immediately and at staggered intervals to catch CSS transition settling
    triggerResize()
    const t1 = setTimeout(triggerResize, 60)
    const t2 = setTimeout(triggerResize, 220)
    const t3 = setTimeout(triggerResize, 350)

    window.addEventListener('resize', triggerResize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', triggerResize)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])

  const option = useMemo(() => {
    const activeHistogram = countryStats ? countryStats.histogram : raster?.histogram
    const activeQuantiles = countryStats ? countryStats.quantiles : raster?.quantiles

    if (!activeHistogram) {
      return {
        title: {
          text: 'No raster data available',
          textStyle: { color: '#71717a', fontSize: 12 },
          left: 'center',
          top: 'center',
        },
      }
    }

    const { bins, counts } = activeHistogram

    const binLabels: string[] = []
    for (let i = 0; i < counts.length; i++) {
      const mid = (bins[i] + bins[i + 1]) / 2
      binLabels.push(mid.toFixed(2))
    }

    const findClosestBinIndex = (val: number) => {
      let closestIdx = 0
      let minDiff = Infinity
      for (let i = 0; i < counts.length; i++) {
        const mid = (bins[i] + bins[i + 1]) / 2
        const diff = Math.abs(mid - val)
        if (diff < minDiff) {
          minDiff = diff
          closestIdx = i
        }
      }
      return closestIdx
    }

    // Mark lines for percentiles (P25, P75), median (M), and average (A)
    // Format horizontally with abbreviations or numbers if clustered together
    const markLines: any[] = []
    const activeMean = countryStats ? (countryStats as any).mean : raster?.mean

    const rawCandidates: {
      key: string
      abbr: string
      name: string
      val: number
      color: string
      lineType: 'solid' | 'dashed' | 'dotted'
      lineWidth: number
    }[] = []

    if (activeQuantiles) {
      if (activeQuantiles[25] !== undefined) {
        rawCandidates.push({
          key: 'p25',
          abbr: 'P25',
          name: '25th Percentile',
          val: activeQuantiles[25],
          color: '#a1a1aa',
          lineType: 'dashed',
          lineWidth: 1,
        })
      }
      if (activeQuantiles[50] !== undefined) {
        rawCandidates.push({
          key: 'med',
          abbr: 'M',
          name: 'Median',
          val: activeQuantiles[50],
          color: '#60a5fa',
          lineType: 'solid',
          lineWidth: 2,
        })
      }
      if (activeQuantiles[75] !== undefined) {
        rawCandidates.push({
          key: 'p75',
          abbr: 'P75',
          name: '75th Percentile',
          val: activeQuantiles[75],
          color: '#a1a1aa',
          lineType: 'dashed',
          lineWidth: 1,
        })
      }
    }

    if (activeMean !== undefined && Number.isFinite(activeMean)) {
      rawCandidates.push({
        key: 'avg',
        abbr: 'A',
        name: 'Average',
        val: activeMean,
        color: '#34d399',
        lineType: 'dashed',
        lineWidth: 1.5,
      })
    }

    // Map each candidate to closest bin index and sort by bin index
    const sortedCandidates = rawCandidates
      .map((c) => ({
        ...c,
        binIdx: findClosestBinIndex(c.val),
      }))
      .sort((a, b) => a.binIdx - b.binIdx || a.val - b.val)

    // Check for clustering (distance <= 2 bins between neighbors)
    const isClusteredWithNeighbor = sortedCandidates.map((c, i) => {
      const prev = sortedCandidates[i - 1]
      const next = sortedCandidates[i + 1]
      const closePrev = prev && Math.abs(c.binIdx - prev.binIdx) <= 2
      const closeNext = next && Math.abs(c.binIdx - next.binIdx) <= 2
      return Boolean(closePrev || closeNext)
    })

    sortedCandidates.forEach((c, i) => {
      const isClustered = isClusteredWithNeighbor[i]
      // If clustered, use numbers (1, 2, 3...) or if spaced use abbreviations (P25, M, A, P75)
      const labelText = isClustered ? `${i + 1}` : c.abbr
      const vOffset = (i % 2) * 12

      markLines.push({
        xAxis: binLabels[c.binIdx],
        name: c.name,
        label: {
          show: true,
          formatter: labelText,
          position: 'end',
          rotate: 0,
          distance: [0, -2 - vOffset],
          color: c.color,
          fontSize: 9,
          fontWeight: c.key === 'med' ? 'bold' : 'normal',
          fontFamily: 'Karla, sans-serif',
          padding: [2, 4],
          borderRadius: 0,
          backgroundColor: 'rgba(24, 24, 27, 0.95)',
          borderColor: c.color,
          borderWidth: 1,
        },
        lineStyle: {
          color: c.color,
          type: c.lineType,
          width: c.lineWidth,
        },
      })
    })

    // Apply steepness scaling in log mode (power transform in log space)
    // Completely unbounded: whatever value the user inputs
    const effectiveSteepness = Number.isFinite(steepness) && steepness !== 0 ? steepness : 1.0
    const transformedData =
      scaleMode === 'log'
        ? counts.map((c) => (c > 0 ? Math.pow(c, effectiveSteepness) : null))
        : counts

    return {
      backgroundColor: 'transparent',
      textStyle: {
        fontFamily: 'Karla, sans-serif',
      },
      tooltip: {
        trigger: 'axis',
        confine: true,
        axisPointer: { type: 'shadow' },
        backgroundColor: '#18181b',
        borderColor: '#27272a',
        borderRadius: 0,
        textStyle: { color: '#f4f4f5', fontSize: 12, fontFamily: 'Karla, sans-serif' },
        formatter: (params: any) => {
          const item = params[0]
          const idx = item.dataIndex
          const actualCount = counts[idx] ?? 0
          const b1 = bins[idx]?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          const b2 = bins[idx + 1]?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          const range = `[${b1} to ${b2}]`
          return `<strong>Range:</strong> ${range}<br/><strong>Count:</strong> ${actualCount.toLocaleString()}`
        },
      },
      grid: {
        top: 22,
        right: 20,
        bottom: 25,
        left: 48,
      },
      xAxis: {
        type: 'category',
        data: binLabels,
        axisLine: { lineStyle: { color: '#3f3f46' } },
        axisLabel: {
          color: '#a1a1aa',
          fontSize: 11,
          fontFamily: 'Karla, sans-serif',
          interval: Math.floor(binLabels.length / 6),
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: scaleMode === 'log' ? 'log' : 'value',
        logBase: 10,
        min: scaleMode === 'log' ? 1 : 0,
        name: scaleMode === 'log' ? 'Cells (log)' : 'Cells',
        nameTextStyle: { color: '#71717a', fontSize: 11, fontFamily: 'Karla, sans-serif' },
        axisLine: { lineStyle: { color: '#3f3f46' } },
        axisLabel: {
          color: '#a1a1aa',
          fontSize: 11,
          fontFamily: 'Karla, sans-serif',
          formatter: (v: number) => {
            const actual =
              scaleMode === 'log'
                ? effectiveSteepness !== 0
                  ? Math.pow(v, 1 / effectiveSteepness)
                  : v
                : v
            const absActual = Math.abs(actual)
            if (absActual >= 1e12) return `${(actual / 1e12).toFixed(1).replace(/\.0$/, '')}T`
            if (absActual >= 1e9) return `${(actual / 1e9).toFixed(1).replace(/\.0$/, '')}B`
            if (absActual >= 1e6) return `${(actual / 1e6).toFixed(1).replace(/\.0$/, '')}M`
            if (absActual >= 1e3) return `${(actual / 1e3).toFixed(1).replace(/\.0$/, '')}k`
            return Math.round(actual).toLocaleString()
          },
        },
        splitLine: { lineStyle: { color: '#27272a', type: 'dashed' } },
      },
      series: [
        {
          name: 'Cell Count',
          type: 'bar',
          barWidth: '95%',
          data: transformedData,
          itemStyle: {
            color: '#3b82f6',
            borderRadius: 0,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            data: markLines,
          },
        },
      ],
    }
  }, [raster, countryStats, scaleType, minOverride, maxOverride, scaleMode, steepness])

  return (
    <div className="relative w-full h-full flex flex-col justify-between font-sans">
      {/* Top Controls: Scope Title, Log Steepness Adjuster & Scale Mode Switch */}
      <div className="flex items-center justify-between px-[var(--cell-padding)] pt-0.5 pb-[var(--cell-padding)] select-none gap-[var(--padding)]">
        <span className="text-[var(--body-font-size)] font-light text-muted-foreground truncate">
          {countryStats ? `Distribution: ${countryStats.name}` : 'Global Distribution'}
        </span>

        <div className="flex items-center gap-[var(--cell-padding)] shrink-0">
          {/* Steepness Option for Logarithmic Scale with Custom Textbox */}
          {scaleMode === 'log' && (
            <div className="flex items-center gap-1.5 bg-muted px-[var(--padding)] py-0.5 rounded-none text-[var(--body-font-size)] border border-border">
              <span className="text-muted-foreground font-normal">Steepness:</span>
              <button
                type="button"
                onClick={() => {
                  const curr = parseFloat(steepnessInput)
                  const base = Number.isFinite(curr) ? curr : 1.0
                  const next = Math.round((base - 0.1) * 100) / 100
                  setSteepnessInput(next.toString())
                }}
                className="w-5 h-5 rounded-none bg-background hover:bg-muted text-foreground flex items-center justify-center font-bold cursor-pointer border border-border/60"
                title="Decrease steepness"
              >
                −
              </button>
              <input
                type="text"
                inputMode="decimal"
                value={steepnessInput}
                onChange={(e) => setSteepnessInput(e.target.value)}
                className="w-14 h-5 px-1 font-mono font-bold text-center bg-background border border-border rounded-none text-foreground focus:outline-none focus:border-primary text-[var(--body-font-size)]"
                placeholder="1.0"
                title="Custom steepness factor (unbounded)"
              />
              <button
                type="button"
                onClick={() => {
                  const curr = parseFloat(steepnessInput)
                  const base = Number.isFinite(curr) ? curr : 1.0
                  const next = Math.round((base + 0.1) * 100) / 100
                  setSteepnessInput(next.toString())
                }}
                className="w-5 h-5 rounded-none bg-background hover:bg-muted text-foreground flex items-center justify-center font-bold cursor-pointer border border-border/60"
                title="Increase steepness"
              >
                +
              </button>

              <div className="flex items-center gap-1 ml-1 border-l border-border pl-1.5">
                {[0.2, 0.5, 1.0, 2.0].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSteepnessInput(preset.toString())}
                    className={`px-1.5 py-0.5 rounded-none text-[var(--body-font-size)] cursor-pointer transition-colors ${
                      Math.abs(steepness - preset) < 0.01
                        ? 'bg-primary text-primary-foreground font-bold'
                        : 'text-muted-foreground hover:text-foreground font-light'
                    }`}
                  >
                    {preset}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Logarithmic vs Linear Switch */}
          <div className="flex items-center gap-1 bg-muted p-[var(--cell-padding)] rounded-none text-[var(--body-font-size)] border border-border">
            <button
              type="button"
              onClick={() => setScaleMode('log')}
              className={`px-2 py-0.5 rounded-none transition-colors cursor-pointer ${
                scaleMode === 'log'
                  ? 'bg-background text-foreground shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground font-light'
              }`}
            >
              Logarithmic
            </button>
            <button
              type="button"
              onClick={() => setScaleMode('linear')}
              className={`px-2 py-0.5 rounded-none transition-colors cursor-pointer ${
                scaleMode === 'linear'
                  ? 'bg-background text-foreground shadow-sm font-bold'
                  : 'text-muted-foreground hover:text-foreground font-light'
              }`}
            >
              Linear
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div ref={containerRef} className="flex-1 w-full min-h-0 relative">
        <ReactECharts
          ref={echartRef}
          option={option}
          notMerge={true}
          lazyUpdate={true}
          style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          opts={{ renderer: 'canvas' }}
        />
      </div>
    </div>
  )
}

export default HistogramChart
