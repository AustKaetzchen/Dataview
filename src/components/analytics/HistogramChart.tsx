import React, { useMemo, useState } from 'react'
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

    // Mark lines with margin & vertical staggering heuristics to prevent label overlap
    const markLines: any[] = []
    if (activeQuantiles) {
      const q25 = activeQuantiles[25]
      const q50 = activeQuantiles[50]
      const q75 = activeQuantiles[75]

      const idx25 = q25 !== undefined ? findClosestBinIndex(q25) : null
      const idx50 = q50 !== undefined ? findClosestBinIndex(q50) : null
      const idx75 = q75 !== undefined ? findClosestBinIndex(q75) : null

      const close25_50 = idx25 !== null && idx50 !== null && Math.abs(idx50 - idx25) <= 3
      const close50_75 = idx50 !== null && idx75 !== null && Math.abs(idx75 - idx50) <= 3

      if (idx25 !== null && q25 !== undefined) {
        markLines.push({
          xAxis: binLabels[idx25],
          name: 'P25',
          label: {
            show: true,
            formatter: 'P25',
            position: 'insideStartTop',
            distance: [0, 2],
            color: '#a1a1aa',
            fontSize: 9,
            fontFamily: 'Karla, sans-serif',
          },
          lineStyle: { color: '#71717a', type: 'dashed' },
        })
      }

      if (idx50 !== null && q50 !== undefined) {
        // If close to P25 or P75, stagger down vertically by 16px so labels never collide
        const yOffset = close25_50 || close50_75 ? 16 : 2
        markLines.push({
          xAxis: binLabels[idx50],
          name: 'Med',
          label: {
            show: true,
            formatter: 'Med',
            position: 'insideMiddleTop',
            distance: [0, yOffset],
            color: '#60a5fa',
            fontWeight: 'bold',
            fontSize: 9,
            fontFamily: 'Karla, sans-serif',
          },
          lineStyle: { color: '#3b82f6', type: 'solid', width: 2 },
        })
      }

      if (idx75 !== null && q75 !== undefined) {
        markLines.push({
          xAxis: binLabels[idx75],
          name: 'P75',
          label: {
            show: true,
            formatter: 'P75',
            position: 'insideEndTop',
            distance: [0, 2],
            color: '#a1a1aa',
            fontSize: 9,
            fontFamily: 'Karla, sans-serif',
          },
          lineStyle: { color: '#71717a', type: 'dashed' },
        })
      }
    }

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
        top: 15,
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
      <div className="flex-1 w-full min-h-0">
        <ReactECharts
          option={option}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>
    </div>
  )
}

export default HistogramChart
