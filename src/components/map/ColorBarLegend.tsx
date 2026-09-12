import React, { useMemo, useState } from 'react'
import { ColorPalette, ScaleType } from '@/lib/geopng/types'
import { getPaletteCssGradient } from '@/lib/geopng/palettes'
import { transformValue } from '@/lib/geopng/scales'

interface ColorBarLegendProps {
  palette: ColorPalette
  invertPalette?: boolean
  minVal: number
  maxVal: number
  legendTitle: string
  scaleType: string
  logSigma: number
  currentVal?: number | null
  breaks?: number[]
  countryName?: string | null
  onUpdateBreaks?: (breaks: number[]) => void
}

// Inverse transform for pseudo-log: y = asinh(x / (2 * sigma)) / ln(10)
function inversePseudoLog(y: number, sigma: number): number {
  return 2 * sigma * Math.sinh(y * Math.LN10)
}

function inverseTransform(val: number, scaleType: ScaleType, logSigma: number): number {
  if (scaleType === 'pseudo-log') {
    return inversePseudoLog(val, logSigma)
  }
  return val
}

// Helper to cleanly format numbers using abbreviated notation (k, M, B, T)
export function formatLegendValue(val: number): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return ''
  const absVal = Math.abs(val)
  if (absVal === 0) return '0'

  const units = [
    { suffix: 'T', factor: 1e12 },
    { suffix: 'B', factor: 1e9 },
    { suffix: 'M', factor: 1e6 },
    { suffix: 'k', factor: 1e3 },
  ]

  for (const { suffix, factor } of units) {
    if (absVal >= factor) {
      const scaled = val / factor
      const absScaled = Math.abs(scaled)
      const maxDecimals = absScaled >= 100 ? 1 : 2
      const formatted = Number(scaled.toFixed(maxDecimals)).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxDecimals,
      })
      return `${formatted}${suffix}`
    }
  }

  if (absVal >= 100) {
    return Number(val.toFixed(1)).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })
  } else if (absVal >= 1) {
    return Number(val.toFixed(2)).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  } else if (absVal >= 0.01) {
    return Number(val.toFixed(3)).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    })
  } else {
    return parseFloat(val.toFixed(5)).toString()
  }
}

export const ColorBarLegend: React.FC<ColorBarLegendProps> = ({
  palette,
  invertPalette = false,
  minVal,
  maxVal,
  legendTitle,
  scaleType,
  logSigma,
  currentVal,
  breaks,
  countryName,
  onUpdateBreaks,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')

  const gradient = getPaletteCssGradient(palette, invertPalette)

  const tMin = useMemo(() => transformValue(minVal, scaleType as ScaleType, logSigma), [minVal, scaleType, logSigma])
  const tMax = useMemo(() => transformValue(maxVal, scaleType as ScaleType, logSigma), [maxVal, scaleType, logSigma])
  const range = tMax - tMin

  // Compute position of active hover value along the color scale
  const indicatorPct = useMemo(() => {
    if (currentVal === null || currentVal === undefined || !Number.isFinite(currentVal)) {
      return null
    }

    if (breaks && breaks.length >= 2) {
      const sorted = [...breaks].sort((a, b) => a - b)
      const n = sorted.length - 1
      if (currentVal <= sorted[0]) return 0
      if (currentVal >= sorted[n]) return 100
      let seg = 0
      while (seg < n - 1 && currentVal >= sorted[seg + 1]) {
        seg++
      }
      const segRange = sorted[seg + 1] - sorted[seg]
      const segT = segRange > 0 ? (currentVal - sorted[seg]) / segRange : 0
      return Math.max(0, Math.min(100, ((seg + segT) / n) * 100))
    }

    const tVal = transformValue(currentVal, scaleType as ScaleType, logSigma)
    if (range <= 0) return 50
    const normalized = (tVal - tMin) / range
    return Math.max(0, Math.min(100, normalized * 100))
  }, [currentVal, breaks, tMin, range, scaleType, logSigma])

  // Compute break points and their percentage positions along the colourbar
  const breakPoints = useMemo(() => {
    if (range <= 0) {
      return [
        { val: minVal, pct: 0, label: formatLegendValue(minVal) },
        { val: maxVal, pct: 100, label: formatLegendValue(maxVal) },
      ]
    }

    if (breaks && breaks.length >= 2) {
      const sorted = [...breaks].sort((a, b) => a - b)
      return sorted.map((b, idx) => {
        const pct = (idx / (sorted.length - 1)) * 100
        return {
          val: b,
          pct,
          label: formatLegendValue(b),
        }
      })
    }

    const steps = [0, 0.25, 0.5, 0.75, 1]
    return steps.map((s) => {
      const tVal = tMin + s * range
      const realVal = inverseTransform(tVal, scaleType as ScaleType, logSigma)
      return {
        val: realVal,
        pct: s * 100,
        label: formatLegendValue(realVal),
      }
    })
  }, [breaks, minVal, maxVal, tMin, range, scaleType, logSigma])

  return (
    <div className="rounded-none border border-border bg-card/95 backdrop-blur-md p-[var(--padding)] shadow-lg text-[var(--body-font-size)] text-card-foreground w-96 select-none font-sans">
      {/* Legend Title & Hover Value Readout */}
      <div className="flex items-center justify-between mb-2 gap-[var(--padding)]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-foreground text-[var(--header-font-size)]">{legendTitle}</span>
          <span className="text-[var(--body-font-size)] text-muted-foreground capitalize bg-muted px-2 py-0.5 rounded-none">
            {scaleType}
          </span>
          {countryName && (
            <span className="text-[var(--body-font-size)] font-bold text-white bg-primary/20 border border-primary/40 px-2 py-0.5 rounded-none flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-none bg-primary animate-pulse" />
              {countryName}
            </span>
          )}
        </div>

        {currentVal !== null && currentVal !== undefined && Number.isFinite(currentVal) ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-none bg-primary text-primary-foreground font-bold text-[var(--body-font-size)] shadow-sm animate-in fade-in-0 duration-100 font-mono">
            <span>{formatLegendValue(currentVal)}</span>
          </div>
        ) : (
          <span className="text-[var(--body-font-size)] text-muted-foreground font-mono font-light">
            {formatLegendValue(minVal)} → {formatLegendValue(maxVal)}
          </span>
        )}
      </div>

      {/* Gradient Bar with Breaks & Active Value Needle */}
      <div className="relative w-full my-1.5">
        <div
          className="relative h-4.5 w-full rounded-none border border-border/80 shadow-inner overflow-hidden"
          style={{ background: gradient }}
        >
          {breakPoints.map((bp, i) => {
            if (bp.pct <= 1 || bp.pct >= 99) return null
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-[1.5px] bg-black/60 shadow-[0_0_1px_rgba(255,255,255,0.7)] pointer-events-none z-10"
                style={{ left: `${bp.pct}%` }}
                title={`Break: ${bp.label}`}
              />
            )
          })}
        </div>

        {indicatorPct !== null && (
          <div
            className="absolute top-[-4px] bottom-[-4px] pointer-events-none transition-all duration-75 ease-out z-20 flex flex-col items-center justify-between"
            style={{ left: `${indicatorPct}%` }}
          >
            <div className="w-0 h-0 border-l-[4.5px] border-l-transparent border-r-[4.5px] border-r-transparent border-t-[6px] border-t-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
            <div className="w-[2.5px] flex-1 bg-white rounded-none shadow-[0_0_6px_rgba(0,0,0,0.9)] border border-black/30" />
            <div className="w-0 h-0 border-l-[4.5px] border-l-transparent border-r-[4.5px] border-r-transparent border-b-[6px] border-b-white drop-shadow-[0_-1px_2px_rgba(0,0,0,0.9)]" />
          </div>
        )}
      </div>

      {/* Ticks and aligned break values with click-to-edit */}
      <div className="relative w-full h-6 mt-1">
        {breakPoints.map((bp, i) => {
          const isFirst = i === 0
          const isLast = i === breakPoints.length - 1
          const alignment = isFirst
            ? 'items-start -translate-x-0'
            : isLast
            ? 'items-end -translate-x-full'
            : 'items-center -translate-x-1/2'

          const isEditing = editingIndex === i

          return (
            <div
              key={i}
              className={`absolute top-0 flex flex-col text-[var(--body-font-size)] text-muted-foreground font-mono font-light ${alignment}`}
              style={{ left: `${bp.pct}%` }}
            >
              <div className="w-[1px] h-1 bg-border/80 mb-0.5" />
              {isEditing ? (
                <input
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const parsed = parseFloat(editingValue)
                      if (Number.isFinite(parsed) && onUpdateBreaks) {
                        const currentBreaks = breakPoints.map((b) => b.val)
                        const newBreaks = currentBreaks.map((b, idx) => (idx === i ? parsed : b))
                        newBreaks.sort((a, b) => a - b)
                        onUpdateBreaks(newBreaks)
                      }
                      setEditingIndex(null)
                    } else if (e.key === 'Escape') {
                      setEditingIndex(null)
                    }
                  }}
                  onBlur={() => {
                    const parsed = parseFloat(editingValue)
                    if (Number.isFinite(parsed) && onUpdateBreaks) {
                      const currentBreaks = breakPoints.map((b) => b.val)
                      const newBreaks = currentBreaks.map((b, idx) => (idx === i ? parsed : b))
                      newBreaks.sort((a, b) => a - b)
                      onUpdateBreaks(newBreaks)
                    }
                    setEditingIndex(null)
                  }}
                  className="w-16 h-6 px-1 text-[var(--body-font-size)] font-mono font-bold bg-background border border-primary text-foreground text-center rounded-none z-30 shadow-lg focus:outline-none"
                  title="Enter absolute break number"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingIndex(i)
                    setEditingValue(bp.val.toString())
                  }}
                  className="whitespace-nowrap px-1 py-0.2 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted rounded-none transition-colors underline decoration-dotted decoration-muted-foreground/60 underline-offset-2"
                  title="Click to set break value by typing number"
                >
                  {bp.label}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
