import React from 'react'
import { DecodedRaster } from '@/lib/geopng/types'
import { CountryStats } from '@/lib/geopng/polygonBinning'

interface StatsSummaryProps {
  raster: DecodedRaster | null
  countryStats?: CountryStats | null
}

const formatLocalizedNumber = (val: number | undefined | null, fractionDigits: number = 4): string => {
  if (val === undefined || val === null || !Number.isFinite(val)) return 'N/A'
  return val.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

export const StatsSummary: React.FC<StatsSummaryProps> = ({ raster, countryStats }) => {
  if (!raster && !countryStats) return null

  if (countryStats) {
    const validPctNum =
      countryStats.totalCells > 0 ? (countryStats.validCount / countryStats.totalCells) * 100 : 0
    const validPct = validPctNum.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
    const median = formatLocalizedNumber(countryStats.median, 3)
    const total =
      countryStats.total !== undefined && Number.isFinite(countryStats.total)
        ? countryStats.total
        : countryStats.mean * countryStats.validCount

    const statItems = [
      { label: 'Scope', value: `${countryStats.name} (${countryStats.isoA3 || 'N/A'})` },
      {
        label: 'Total (Sum)',
        value: total.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      },
      { label: 'Valid Cells', value: `${countryStats.validCount.toLocaleString()} (${validPct}%)` },
      { label: 'Polygon Cells', value: countryStats.totalCells.toLocaleString() },
      { label: 'Min Value', value: formatLocalizedNumber(countryStats.min, 4) },
      { label: 'Max Value', value: formatLocalizedNumber(countryStats.max, 4) },
      { label: 'Mean', value: formatLocalizedNumber(countryStats.mean, 4) },
      { label: 'Std Dev', value: formatLocalizedNumber(countryStats.stdDev, 4) },
      { label: 'Median (P50)', value: median },
    ]

    return (
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-[var(--cell-padding)] list-disc list-outside pl-5 text-[var(--body-font-size)] select-text">
        {statItems.map((stat, i) => (
          <li key={i} className="leading-snug">
            <span className="text-muted-foreground uppercase text-[var(--body-font-size)] font-bold tracking-wider mr-2 whitespace-nowrap">
              {stat.label}:
            </span>
            <span className="text-foreground font-mono break-all font-light">
              {stat.value}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  if (!raster) return null

  const validPctNum = raster.totalCells > 0 ? (raster.validCount / raster.totalCells) * 100 : 0
  const validPct = validPctNum.toLocaleString(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const median = formatLocalizedNumber(raster.quantiles?.[50], 3)
  const total =
    raster.total !== undefined && Number.isFinite(raster.total)
      ? raster.total
      : raster.mean * raster.validCount

  const statItems = [
    {
      label: 'Total (Sum)',
      value: total.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    },
    { label: 'Valid Cells', value: `${raster.validCount.toLocaleString()} (${validPct}%)` },
    { label: 'Resolution', value: `${raster.width.toLocaleString()} × ${raster.height.toLocaleString()}` },
    { label: 'Total Cells', value: raster.totalCells.toLocaleString() },
    { label: 'Min Value', value: formatLocalizedNumber(raster.min, 4) },
    { label: 'Max Value', value: formatLocalizedNumber(raster.max, 4) },
    { label: 'Mean', value: formatLocalizedNumber(raster.mean, 4) },
    { label: 'Std Dev', value: formatLocalizedNumber(raster.stdDev, 4) },
    { label: 'Median (P50)', value: median },
  ]

  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-[var(--cell-padding)] list-disc list-outside pl-5 text-[var(--body-font-size)] select-text">
      {statItems.map((stat, i) => (
        <li key={i} className="leading-snug">
          <span className="text-muted-foreground uppercase text-[var(--body-font-size)] font-bold tracking-wider mr-2 whitespace-nowrap">
            {stat.label}:
          </span>
          <span className="text-foreground font-mono break-all font-light">
            {stat.value}
          </span>
        </li>
      ))}
    </ul>
  )
}
