import React, { useMemo, useState, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { CityPoint } from '@/lib/geopng/types'
import { Icon } from '@/components/ui/icon'
import { UfDate } from '@/lib/ufDate'

export interface LargestCitiesChartProps {
  currentYear: number
  dataset?: 'stadester_1.1' | 'stadester_1.0'
  onSelectCity?: (arg0_key: string) => void
}

const REGION_COLOR_MAP: Record<string, string> = {
  africa: '#f97316',
  central_asia: '#a855f7',
  eastasia: '#ef4444',
  europe: '#6366f1',
  latin_america: '#10b981',
  middle_east: '#eab308',
  northern_america: '#0ea5e9',
  oceania: '#14b8a6',
  south_asia: '#ec4899',
  southeast_asia: '#8b5cf6',
}

/**
 * Special analytical chart displaying the ranked largest cities at the current timeline year.
 *
 * @param {LargestCitiesChartProps} arg0_props
 *
 * @returns {React.ReactElement}
 */
export const LargestCitiesChart: React.FC<LargestCitiesChartProps> = function (arg0_props) {
  //Convert from parameters
  let props = arg0_props
  let current_year = props.currentYear
  let dataset = props.dataset || 'stadester_1.1'
  let on_select_city = props.onSelectCity

  //Declare local instance variables
  let cities_list: CityPoint[]
  let dominant_region: string
  let echart_option: any
  let is_loading: boolean
  let largest_city: CityPoint | null
  let limit: number
  let set_cities_list: React.Dispatch<React.SetStateAction<CityPoint[]>>
  let set_is_loading: React.Dispatch<React.SetStateAction<boolean>>
  let set_limit: React.Dispatch<React.SetStateAction<number>>
  let total_top_population: number

  //Function body
  ;[cities_list, set_cities_list] = useState<CityPoint[]>([])
  ;[is_loading, set_is_loading] = useState<boolean>(false)
  ;[limit, set_limit] = useState<number>(15)

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
  }, [dataset, Math.round(current_year), limit])

  //Compute summary metrics
  total_top_population = useMemo(() => {
    let sum = 0
    for (let i = 0; i < cities_list.length; i++)
      sum += cities_list[i].population || 0
    return sum
  }, [cities_list])

  largest_city = cities_list.length > 0 ? cities_list[0] : null

  dominant_region = useMemo(() => {
    let counts: Record<string, number> = {}
    for (let i = 0; i < cities_list.length; i++) {
      let r = cities_list[i].region || 'other'
      counts[r] = (counts[r] || 0) + 1
    }
    let top_r = 'Unknown'
    let max_c = 0
    let keys = Object.keys(counts)
    for (let i = 0; i < keys.length; i++) {
      if (counts[keys[i]] > max_c) {
        max_c = counts[keys[i]]
        top_r = keys[i]
      }
    }
    return top_r.replace(/_/g, ' ')
  }, [cities_list])

  //Construct ECharts horizontal bar options (reversed so rank 1 is at top)
  echart_option = useMemo(() => {
    let sorted_for_chart = [...cities_list].reverse()
    let y_names = sorted_for_chart.map((arg0_c) => arg0_c.name)
    let pop_values = sorted_for_chart.map((arg0_c) => arg0_c.population)

    return {
      animationDuration: 250,
      grid: {
        bottom: 20,
        containLabel: true,
        left: 10,
        right: 35,
        top: 10,
      },
      series: [
        {
          data: sorted_for_chart.map((arg0_c, arg0_idx) => {
            let r_key = (arg0_c.region || '').toLowerCase()
            let bar_color = REGION_COLOR_MAP[r_key] || '#38bdf8'
            return {
              cityData: arg0_c,
              itemStyle: {
                borderRadius: [0, 2, 2, 0],
                color: bar_color,
              },
              value: arg0_c.population,
            }
          }),
          label: {
            color: '#f8fafc',
            formatter: (arg0_p: any) => {
              let v = arg0_p.value
              if (v >= 1000000)
                return `${(v / 1000000).toFixed(1)}M`
              if (v >= 1000)
                return `${Math.round(v / 1000)}k`
              return String(v)
            },
            fontSize: 10,
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
          let rank = cities_list.findIndex((arg0_item) => arg0_item.key === c.key) + 1
          let pop_formatted = Math.round(c.population).toLocaleString('de-DE')
          return `<div style="font-size: 11px;">
            <div style="font-weight: bold; color: #ffffff;">#${rank} ${c.name}</div>
            <div style="color: #94a3b8; font-size: 10px; margin-bottom: 3px;">
              ${[c.country, c.region].filter(Boolean).join(' • ')}
            </div>
            <div>Population: <b style="color: #38bdf8;">${pop_formatted}</b></div>
            ${c.area ? `<div style="color: #cbd5e1;">Area: ${Math.round(c.area).toLocaleString('de-DE')} km²</div>` : ''}
            ${c.density ? `<div style="color: #cbd5e1;">Density: ${Math.round(c.density).toLocaleString('de-DE')} /km²</div>` : ''}
            <div style="font-size: 9px; color: #64748b; margin-top: 4px;">Click to inspect city on map</div>
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
          fontSize: 10,
          width: 85,
        },
        axisLine: { lineStyle: { color: '#334155' } },
        axisTick: { show: false },
        data: y_names,
        type: 'category',
      },
    }
  }, [cities_list])

  //Return statement
  return (
    <div className="flex flex-col h-full space-y-2 text-xs select-none">
      {/* Top Controls: Ranking limits & summary */}
      <div className="flex items-center justify-between border-b border-border/60 pb-1.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <Icon name="leaderboard" className="text-primary text-xs" />
          <span className="font-bold text-foreground text-xs uppercase tracking-wider">
            Largest Urban Centers
          </span>
          <span className="text-[10px] px-1 py-0.2 bg-primary/20 text-primary font-mono ml-1">
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
              Top {arg0_n}
            </button>
          ))}
        </div>
      </div>

      {/* Snapshot metric summary cards */}
      <div className="grid grid-cols-3 gap-1.5 shrink-0">
        <div className="bg-muted/30 border border-border/50 p-1.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">#1 City</div>
          <div className="text-xs font-bold text-foreground truncate mt-0.5" title={largest_city?.name || '–'}>
            {largest_city?.name || '–'}
          </div>
          <div className="text-[10px] font-mono text-primary font-semibold truncate">
            {largest_city ? Math.round(largest_city.population).toLocaleString('de-DE') : '–'}
          </div>
        </div>

        <div className="bg-muted/30 border border-border/50 p-1.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Top {limit} Total</div>
          <div className="text-xs font-bold font-mono text-emerald-400 truncate mt-0.5">
            {total_top_population.toLocaleString('de-DE')}
          </div>
          <div className="text-[9px] text-muted-foreground truncate">Inhabitants</div>
        </div>

        <div className="bg-muted/30 border border-border/50 p-1.5">
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Leading Region</div>
          <div className="text-xs font-bold text-amber-400 capitalize truncate mt-0.5">
            {dominant_region}
          </div>
          <div className="text-[9px] text-muted-foreground truncate">Most represented</div>
        </div>
      </div>

      {/* Ranked Bar Chart Container */}
      <div className="flex-1 min-h-[260px] relative border border-border/40 bg-card/30">
        {is_loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-xs text-xs text-muted-foreground animate-pulse">
            Ranking urban settlements for {UfDate.formatYear(current_year)}...
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
            No settlements recorded above threshold in {UfDate.formatYear(current_year)}.
          </div>
        )}
      </div>
    </div>
  )
}
