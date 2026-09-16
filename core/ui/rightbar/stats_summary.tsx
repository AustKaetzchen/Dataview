import React from 'react'
import { DecodedRaster } from '@framework/geopng/types.ts'
import { CountryStats } from '@framework/geopng/polygon_binning.ts'
import { formatLocalizedNumber, formatNumber } from '@framework/utils/utils.ts'

export interface StatsSummaryProps {
  raster: DecodedRaster | null
  countryStats?: CountryStats | null
}

/**
 * StatsSummary displays numerical aggregates and quantiles for rasters or country masks.
 *
 * @param {StatsSummaryProps} arg0_props
 *
 * @returns {React.ReactElement | null}
 */
export let StatsSummary: React.FC<StatsSummaryProps> = function (arg0_props) {
  //Convert from parameters
  let props = arg0_props
  let {
    countryStats: country_stats,
    raster,
  } = props

  //Guard clauses
  if (!raster && !country_stats)
    return null

  //Function body
  if (country_stats) {
    let median = formatLocalizedNumber(country_stats.median, 3)
    let total =
      country_stats.total !== undefined && Number.isFinite(country_stats.total)
        ? country_stats.total
        : country_stats.mean*country_stats.validCount
    let valid_pct_num =
      country_stats.totalCells > 0 ? (country_stats.validCount/country_stats.totalCells)*100 : 0
    let valid_pct = valid_pct_num.toLocaleString(undefined, {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    })

    let stat_items = [
      { label: 'Scope', value: `${country_stats.name} (${country_stats.isoA3 || 'N/A'})` },
      {
        label: 'Total (Sum)',
        value: total.toLocaleString(undefined, {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        }),
      },
      { label: 'Valid Cells', value: `${country_stats.validCount.toLocaleString()} (${valid_pct}%)` },
      { label: 'Polygon Cells', value: country_stats.totalCells.toLocaleString() },
      { label: 'Min Value', value: formatLocalizedNumber(country_stats.min, 4) },
      { label: 'Max Value', value: formatLocalizedNumber(country_stats.max, 4) },
      { label: 'Mean', value: formatLocalizedNumber(country_stats.mean, 4) },
      { label: 'Std Dev', value: formatLocalizedNumber(country_stats.stdDev, 4) },
      { label: 'Median (P50)', value: median },
    ]

    //Return statement
    return (
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-[var(--cell-padding)] list-disc list-outside pl-5 text-[var(--body-font-size)] select-text">
        {stat_items.map((arg0_stat, arg0_i) => (
          <li key={arg0_i} className="leading-snug">
            <span className="text-muted-foreground uppercase text-[var(--body-font-size)] font-bold tracking-wider mr-2 whitespace-nowrap">
              {arg0_stat.label}:
            </span>
            <span className="text-foreground break-all font-light">
              {arg0_stat.value}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  if (!raster)
    return null

  let median = formatLocalizedNumber(raster.quantiles?.[50], 3)
  let total =
    raster.total !== undefined && Number.isFinite(raster.total)
      ? raster.total
      : raster.mean*raster.validCount
  let valid_pct_num = raster.totalCells > 0 ? (raster.validCount/raster.totalCells)*100 : 0
  let valid_pct = valid_pct_num.toLocaleString(undefined, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })

  let stat_items = [
    {
      label: 'Total (Sum)',
      value: total.toLocaleString(undefined, {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      }),
    },
    { label: 'Valid Cells', value: `${raster.validCount.toLocaleString()} (${valid_pct}%)` },
    { label: 'Resolution', value: `${raster.width.toLocaleString()} × ${raster.height.toLocaleString()}` },
    { label: 'Total Cells', value: raster.totalCells.toLocaleString() },
    { label: 'Min Value', value: formatLocalizedNumber(raster.min, 4) },
    { label: 'Max Value', value: formatLocalizedNumber(raster.max, 4) },
    { label: 'Mean', value: formatLocalizedNumber(raster.mean, 4) },
    { label: 'Std Dev', value: formatLocalizedNumber(raster.stdDev, 4) },
    { label: 'Median (P50)', value: median },
  ]

  //Return statement
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-[var(--cell-padding)] list-disc list-outside pl-5 text-[var(--body-font-size)] select-text">
      {stat_items.map((arg0_stat, arg0_i) => (
        <li key={arg0_i} className="leading-snug">
          <span className="text-muted-foreground uppercase text-[var(--body-font-size)] font-bold tracking-wider mr-2 whitespace-nowrap">
            {arg0_stat.label}:
          </span>
          <span className="text-foreground break-all font-light">
            {arg0_stat.value}
          </span>
        </li>
      ))}
    </ul>
  )
}

export default StatsSummary
