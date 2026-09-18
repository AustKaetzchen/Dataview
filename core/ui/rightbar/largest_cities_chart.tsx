import React, { useMemo, useState, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { CityPoint } from '@framework/geopng/types.ts'
import { Icon } from '@ui/components/icon'
import { UfDate } from '@framework/utils/uf_date'
import { getPrimaryCityName } from '@framework/stadester/city_name_framework'
import { useLocalisation } from '@localisation'

export interface LargestCitiesChartProps {
  currentYear: number
  dataset?: 'stadester_1.1' | 'stadester_1.0'
  onSelectCity?: (arg0_key: string) => void
}

let REGION_COLOR_MAP: Record<string, string> = {
  africa: '#f97316',
  central_asia: '#a855f7',
  eastasia: '#ef4444',
  eastern_europe_and_russia: '#3b82f6',
  europe: '#6366f1',
  indian_subcontinent: '#ec4899',
  latin_america: '#10b981',
  maghreb_egypt: '#eab308',
  middle_east: '#d97706',
  northern_america: '#0ea5e9',
  oceania: '#14b8a6',
  south_asia: '#ec4899',
  southeast_asia: '#8b5cf6',
  sub_saharan_africa: '#f97316',
}

/**
 * Special analytical chart displaying the ranked largest cities at the current timeline year.
 *
 * @param {LargestCitiesChartProps} arg0_props
 *
 * @returns {React.ReactElement}
 */
export let LargestCitiesChart: React.FC<LargestCitiesChartProps> = function (arg0_props) {
  //Convert from parameters
  let props = arg0_props
  let current_year = props.currentYear
  let dataset = props.dataset || 'stadester_1.1'
  let on_select_city = props.onSelectCity

  //Declare local instance variables
  let chart_height: number
  let cities_list: CityPoint[]
  let dominant_region: string
  let echart_option: any
  let format: ReturnType<typeof useLocalisation>['format']
  let is_loading: boolean
  let largest_city: CityPoint | null
  let limit: number
  let localisation: ReturnType<typeof useLocalisation>
  let set_cities_list: React.Dispatch<React.SetStateAction<CityPoint[]>>
  let set_is_loading: React.Dispatch<React.SetStateAction<boolean>>
  let set_limit: React.Dispatch<React.SetStateAction<number>>
  let t: ReturnType<typeof useLocalisation>['t']
  let total_top_population: number

  //Function body
  localisation = useLocalisation()
  format = localisation.format
  t = localisation.t

  ;[cities_list, set_cities_list] = useState<CityPoint[]>([])
  ;[is_loading, set_is_loading] = useState<boolean>(false)
  ;[limit, set_limit] = useState<number>(15)

  chart_height = Math.max(150, Math.min(360, (limit * 14) + 25))

  //Fetch largest cities whenever year, dataset or limit changes
  useEffect(() => {
    let controller = new AbortController()
    let rounded_year = Math.round(current_year)

    set_is_loading(true)
    fetch(`/api/stadester/largest?dataset=${dataset}&year=${rounded_year}&limit=${limit}`, {
      signal: controller.signal,
    })
      .then((arg0_res) => {
        if (!arg0_res.ok)
          throw new Error(`HTTP error: ${arg0_res.status}`)
        return arg0_res.json()
      })
      .then((arg0_data) => {
        set_cities_list(arg0_data.cities || [])
        set_is_loading(false)
      })
      .catch((arg0_err) => {
        if (arg0_err.name !== 'AbortError') {
          console.error('[LargestCitiesChart] Error fetching largest cities:', arg0_err)
          set_is_loading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [current_year, dataset, limit])

  //Compute summary metrics: #1 city, aggregate top population, and leading region
  largest_city = cities_list.length > 0 ? cities_list[0] : null
  total_top_population = useMemo(() => {
    let sum = 0
    for (let i = 0; i < cities_list.length; i++)
      sum += (cities_list[i].population || 0)
    return Math.round(sum)
  }, [cities_list])

  dominant_region = useMemo(() => {
    if (cities_list.length === 0)
      return '–'
    let counts: Record<string, number> = {}
    for (let i = 0; i < cities_list.length; i++) {
      let reg = (cities_list[i].region || 'Other').toLowerCase()
      counts[reg] = (counts[reg] || 0) + 1
    }
    let max_reg = '–'
    let max_val = -1
    let keys = Object.keys(counts)
    for (let i = 0; i < keys.length; i++) {
      if (counts[keys[i]] > max_val) {
        max_val = counts[keys[i]]
        max_reg = keys[i]
      }
    }
    return max_reg.replace(/_/g, ' ')
  }, [cities_list])

  //Build horizontal bar chart option for ECharts
  echart_option = useMemo(() => {
    let sorted_cities = [...cities_list].reverse()
    let series_data: any[] = []
    let y_names: string[] = []

    for (let i = 0; i < sorted_cities.length; i++) {
      let c = sorted_cities[i]
      let clean_name = getPrimaryCityName(c.name)
      let region_key = (c.region || '').toLowerCase().trim().replace(/[\s-]+/g, '_')
      let item_color = REGION_COLOR_MAP[region_key] || '#3b82f6'

      y_names.push(clean_name)
      series_data.push({
        cityData: c,
        itemStyle: {
          borderRadius: [0, 2, 2, 0],
          color: item_color,
        },
        value: c.population,
      })
    }

    return {
      animationDuration: 300,
      grid: {
        bottom: 20,
        containLabel: true,
        left: 8,
        right: 24,
        top: 6,
      },
      series: [
        {
          data: series_data,
          emphasis: {
            itemStyle: {
              shadowBlur: 6,
              shadowColor: 'rgba(255, 255, 255, 0.4)',
            },
          },
          label: {
            color: '#cbd5e1',
            fontFamily: 'monospace',
            fontSize: 9,
            formatter: (arg0_p: any) => {
              let val = arg0_p.value
              if (val >= 1000000)
                return `${(val / 1000000).toFixed(1)}M`
              if (val >= 1000)
                return `${Math.round(val / 1000)}k`
              return String(val)
            },
            position: 'right',
            show: true,
          },
          type: 'bar',
        },
      ],
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        formatter: function (arg0_params: any) {
          let c: CityPoint = arg0_params.data?.cityData
          if (!c)
            return ''
          let clean_name = getPrimaryCityName(c.name)
          let rank = cities_list.findIndex((arg0_item) => arg0_item.key === c.key) + 1
          let pop_formatted = Math.round(c.population).toLocaleString('de-DE')
          let other_parts = c.name && c.name.includes(';') ? c.name.split(';').slice(1, 4).map((s) => s.trim()).join(', ') : ''
          return `<div style="font-size: 11px; max-width: 280px;">
            <div style="font-weight: bold; color: #ffffff;">#${rank} ${clean_name}</div>
            <div style="color: #94a3b8; font-size: 10px; margin-bottom: 3px;">
              ${[c.country, c.region].filter(Boolean).join(' • ')}
            </div>
            <div>${t.analytics.population}: <b style="color: #38bdf8;">${pop_formatted}</b></div>
            ${c.area ? `<div style="color: #cbd5e1;">${t.analytics.area}: ${Math.round(c.area).toLocaleString('de-DE')} km²</div>` : ''}
            ${c.density ? `<div style="color: #cbd5e1;">${t.analytics.density}: ${Math.round(c.density).toLocaleString('de-DE')} /km²</div>` : ''}
            ${other_parts ? `<div style="color: #64748b; font-size: 9px; margin-top: 3px; line-height: 1.2;">${t.analytics.agglomerationIncludes}: ${other_parts}...</div>` : ''}
            <div style="font-size: 9px; color: #475569; margin-top: 4px;">${t.analytics.clickToInspectCity}</div>
          </div>`
        },
        trigger: 'item',
      },
      xAxis: {
        axisLabel: {
          color: '#94a3b8',
          fontSize: 9,
          formatter: (arg0_v: number) => {
            if (arg0_v >= 1000000)
              return `${(arg0_v / 1000000).toFixed(0)}M`
            if (arg0_v >= 1000)
              return `${Math.round(arg0_v / 1000)}k`
            return String(arg0_v)
          },
        },
        axisLine: { lineStyle: { color: '#334155' } },
        splitLine: { lineStyle: { color: '#1e293b' } },
        type: 'value',
      },
      yAxis: {
        axisLabel: {
          color: '#f8fafc',
          ellipsis: '...',
          fontSize: 10,
          overflow: 'truncate',
          width: 95,
        },
        axisLine: { lineStyle: { color: '#334155' } },
        axisTick: { show: false },
        data: y_names,
        type: 'category',
      },
    }
  }, [cities_list, t])

  //Return statement
  return (
    <div className="flex flex-col space-y-2 text-xs select-none">
      {/* Top Controls: Ranking limits & summary */}
      <div className="flex items-center justify-between border-b border-border/60 pb-1.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <Icon name="leaderboard" className="text-white text-xs" />
          <span className="font-bold text-foreground text-xs uppercase tracking-wider">
            {t.analytics.largestCitiesTitle}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground font-mono ml-1 border border-border/50">
            {UfDate.formatYear(current_year)}
          </span>
        </div>

        {/* Limit Chips */}
        <div className="flex items-center gap-1">
          {[10, 15, 25, 50].map((arg0_n) => (
            <button
              key={arg0_n}
              type="button"
              onClick={() => set_limit(arg0_n)}
              className={`px-1.5 py-0.5 text-[10px] rounded-none border transition-colors cursor-pointer ${
                limit === arg0_n
                  ? 'bg-primary text-primary-foreground border-primary font-bold'
                  : 'bg-background hover:bg-muted text-muted-foreground border-border'
              }`}
            >
              {format(t.analytics.topN, arg0_n)}
            </button>
          ))}
        </div>
      </div>

      {/* Snapshot metric summary cards */}
      <div className="grid grid-cols-3 gap-1.5 shrink-0">
        <div className="bg-muted/30 border border-border/50 p-1.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{t.analytics.top1City}</div>
          <div
            className="text-xs font-bold text-foreground truncate mt-0.5"
            title={largest_city ? getPrimaryCityName(largest_city.name) : '–'}
          >
            {largest_city ? getPrimaryCityName(largest_city.name) : '–'}
          </div>
          <div className="text-[10px] font-mono text-foreground font-semibold truncate">
            {largest_city ? Math.round(largest_city.population).toLocaleString('de-DE') : '–'}
          </div>
        </div>

        <div className="bg-muted/30 border border-border/50 p-1.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{format(t.analytics.topNTotal, limit)}</div>
          <div className="text-xs font-bold font-mono text-foreground truncate mt-0.5">
            {total_top_population.toLocaleString('de-DE')}
          </div>
          <div className="text-[9px] text-muted-foreground truncate">{t.analytics.inhabitants}</div>
        </div>

        <div className="bg-muted/30 border border-border/50 p-1.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{t.analytics.leadingRegion}</div>
          <div className="text-xs font-bold text-foreground capitalize truncate mt-0.5">
            {dominant_region}
          </div>
          <div className="text-[9px] text-muted-foreground truncate">{t.analytics.mostRepresented}</div>
        </div>
      </div>

      {/* Ranked Bar Chart Container */}
      <div
        className="relative border border-border/40 bg-card/30 shrink-0 w-full"
        style={{ height: `${chart_height}px` }}
      >
        {is_loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-xs text-xs text-muted-foreground animate-pulse">
            {format(t.analytics.rankingUrbanSettlements, UfDate.formatYear(current_year))}
          </div>
        )}

        {cities_list.length > 0 ? (
          <ReactECharts
            option={echart_option}
            style={{ height: '100%', width: '100%' }}
            notMerge={true}
            onEvents={{
              click: function (arg0_params: any) {
                let city_key = arg0_params?.data?.cityData?.key
                if (city_key && on_select_city)
                  on_select_city(city_key)
              },
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
            {format(t.analytics.noSettlementsRecorded, UfDate.formatYear(current_year))}
          </div>
        )}
      </div>
    </div>
  )
}

export default LargestCitiesChart
