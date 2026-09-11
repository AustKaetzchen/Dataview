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
  // Steepness adjustment factor for logarithmic mode (default 1.0x)
  const [steepness, setSteepness] = useState<number>(1.0)

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
          padding: [1, 3],
          borderRadius: 2,
          backgroundColor: 'rgba(24, 24, 27, 0.9)',
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
    const effectiveSteepness = Math.max(0.1, steepness)
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
        textStyle: { color: '#f4f4f5', fontSize: 11, fontFamily: 'Karla, sans-serif' },
        formatter: (params: any) => {
          const item = params[0]
          const idx = item.dataIndex
          const actualCount = counts[idx] ?? 0
          const range = `[${bins[idx]?.toFixed(2)} to ${bins[idx + 1]?.toFixed(2)}]`
          return `<strong>Range:</strong> ${range}<br/><strong>Count:</strong> ${actualCount.toLocaleString()}`
        },
      },
      grid: {
        top: 22,
        right: 20,
        bottom: 25,
        left: 45,
      },
      xAxis: {
        type: 'category',
        data: binLabels,
        axisLine: { lineStyle: { color: '#3f3f46' } },
        axisLabel: {
          color: '#a1a1aa',
          fontSize: 9,
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
        nameTextStyle: { color: '#71717a', fontSize: 9, fontFamily: 'Karla, sans-serif' },
        axisLine: { lineStyle: { color: '#3f3f46' } },
        axisLabel: {
          color: '#a1a1aa',
          fontSize: 9,
          fontFamily: 'Karla, sans-serif',
          formatter: (v: number) => {
            if (scaleMode === 'log') {
              const actual = Math.pow(v, 1 / effectiveSteepness)
              if (actual >= 1000000) return `${(actual / 1000000).toFixed(0)}M`
              if (actual >= 1000) return `${(actual / 1000).toFixed(0)}k`
              return Math.round(actual).toString()
            }
            if (v >= 1000000) return `${(v / 1000000).toFixed(0)}M`
            if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
            return v.toString()
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
            borderRadius: [2, 2, 0, 0],
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
      <div className="flex items-center justify-between px-2 pt-0.5 pb-1 select-none gap-2">
        <span className="text-[11px] font-medium text-muted-foreground truncate">
          {countryStats ? `Distribution: ${countryStats.name}` : 'Global Distribution'}
        </span>

        <div className="flex items-center gap-2 shrink-0">
          {/* Steepness Option for Logarithmic Scale */}
          {scaleMode === 'log' && (
            <div className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded-[3px] text-[10px] border border-border/50">
              <span className="text-muted-foreground font-medium">Steepness:</span>
              <button
                type="button"
                onClick={() => setSteepness((prev) => Math.max(0.2, Math.round((prev - 0.2) * 10) / 10))}
                className="w-4 h-4 rounded bg-background hover:bg-muted text-foreground flex items-center justify-center font-bold text-[11px] cursor-pointer"
                title="Decrease logarithmic steepness"
              >
                −
              </button>
              <span className="font-mono text-foreground font-semibold min-w-[28px] text-center">
                {steepness.toFixed(1)}x
              </span>
              <button
                type="button"
                onClick={() => setSteepness((prev) => Math.min(3.0, Math.round((prev + 0.2) * 10) / 10))}
                className="w-4 h-4 rounded bg-background hover:bg-muted text-foreground flex items-center justify-center font-bold text-[11px] cursor-pointer"
                title="Increase logarithmic steepness"
              >
                +
              </button>

              <div className="flex items-center gap-0.5 ml-0.5 border-l border-border pl-1">
                {[0.5, 1.0, 2.0].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSteepness(preset)}
                    className={`px-1 py-0.2 rounded text-[9px] cursor-pointer transition-colors ${
                      Math.abs(steepness - preset) < 0.05
                        ? 'bg-primary text-primary-foreground font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {preset}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Logarithmic vs Linear Switch */}
          <div className="flex items-center gap-1 bg-muted p-0.5 rounded-[3px] text-[10px] border border-border/50">
            <button
              type="button"
              onClick={() => setScaleMode('log')}
              className={`px-2 py-0.5 rounded-[2px] transition-colors cursor-pointer font-medium ${
                scaleMode === 'log'
                  ? 'bg-background text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Logarithmic
            </button>
            <button
              type="button"
              onClick={() => setScaleMode('linear')}
              className={`px-2 py-0.5 rounded-[2px] transition-colors cursor-pointer font-medium ${
                scaleMode === 'linear'
                  ? 'bg-background text-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
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
