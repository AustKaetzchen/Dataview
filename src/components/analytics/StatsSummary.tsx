import React from 'react'
import { DecodedRaster } from '@/lib/geopng/types'
import { CountryStats } from '@/lib/geopng/polygonBinning'

interface StatsSummaryProps {
  raster: DecodedRaster | null
  countryStats?: CountryStats | null
}

export const StatsSummary: React.FC<StatsSummaryProps> = ({ raster, countryStats }) => {
  if (!raster && !countryStats) return null

  if (countryStats) {
    const validPct =
      countryStats.totalCells > 0
        ? ((countryStats.validCount / countryStats.totalCells) * 100).toFixed(1)
        : '0.0'
    const median = Number.isFinite(countryStats.median) ? countryStats.median.toFixed(3) : 'N/A'
    const total =
      countryStats.total !== undefined && Number.isFinite(countryStats.total)
        ? countryStats.total
        : countryStats.mean * countryStats.validCount

    const statItems = [
      { label: 'Scope', value: `${countryStats.name} (${countryStats.isoA3 || 'N/A'})` },
      { label: 'Total (Sum)', value: total.toLocaleString(undefined, { maximumFractionDigits: 2 }) },
      { label: 'Valid Cells', value: `${countryStats.validCount.toLocaleString()} (${validPct}%)` },
      { label: 'Polygon Cells', value: countryStats.totalCells.toLocaleString() },
      { label: 'Min Value', value: countryStats.min.toFixed(4) },
      { label: 'Max Value', value: countryStats.max.toFixed(4) },
      { label: 'Mean', value: countryStats.mean.toFixed(4) },
      { label: 'Std Dev', value: countryStats.stdDev.toFixed(4) },
      { label: 'Median (P50)', value: median },
    ]

    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
        {statItems.map((stat, i) => (
          <div
            key={i}
            className="rounded-md bg-card border border-border p-2 flex flex-col justify-between"
          >
            <span className="text-muted-foreground text-[10px] uppercase font-medium">{stat.label}</span>
            <span className="text-foreground font-medium text-xs mt-1 truncate font-mono">
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    )
  }

  if (!raster) return null

  const validPct = ((raster.validCount / raster.totalCells) * 100).toFixed(1)
  const median = raster.quantiles?.[50] !== undefined ? raster.quantiles[50].toFixed(3) : 'N/A'
  const total =
    raster.total !== undefined && Number.isFinite(raster.total)
      ? raster.total
      : raster.mean * raster.validCount

  const statItems = [
    { label: 'Total (Sum)', value: total.toLocaleString(undefined, { maximumFractionDigits: 2 }) },
    { label: 'Valid Cells', value: `${raster.validCount.toLocaleString()} (${validPct}%)` },
    { label: 'Resolution', value: `${raster.width} × ${raster.height}` },
    { label: 'Total Cells', value: raster.totalCells.toLocaleString() },
    { label: 'Min Value', value: raster.min.toFixed(4) },
    { label: 'Max Value', value: raster.max.toFixed(4) },
    { label: 'Mean', value: raster.mean.toFixed(4) },
    { label: 'Std Dev', value: raster.stdDev.toFixed(4) },
    { label: 'Median (P50)', value: median },
  ]

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
      {statItems.map((stat, i) => (
        <div
          key={i}
          className="rounded-md bg-card border border-border p-2 flex flex-col justify-between"
        >
          <span className="text-muted-foreground text-[10px] uppercase font-medium">{stat.label}</span>
          <span className="text-foreground font-medium text-xs mt-1 truncate font-mono">
            {stat.value}
          </span>
        </div>
      ))}
    </div>
  )
}
