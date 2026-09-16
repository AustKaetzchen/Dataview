import React, { useMemo, useState, useRef, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { DecodedRaster } from '@framework/geopng/types.ts'
import { CountryFeature, CountryStats, getFeatureEntityName } from '@framework/geopng/polygon_binning.ts'
import { Icon } from '@ui/components/icon'
import { computeSyntheticSectorBreakdown } from '@framework/raster/synthetic_demographics'

export interface CategoryBreakdownChartProps {
  activeVariableSelectors?: Record<string, string | string[]>
  countryStats?: CountryStats | null
  currentYear: number
  inspectData?: {
    countryName?: string
    lat: number
    lng: number
    pixelX: number
    pixelY: number
    value: number | null
  } | null
  layerId?: string
  onTogglePlaceholder?: (arg0_val: boolean) => void
  raster: DecodedRaster | null
  selectedCountries?: CountryFeature[]
  selectedCountry?: CountryFeature | null
  syntheticByDefault?: boolean
  usePlaceholder?: boolean
}

export interface SectorItem {
  color: string
  id: string
  label: string
}

export let PROFESSION_SECTORS: SectorItem[] = [
  { color: '#8c510a', id: 'agriculture', label: 'Agriculture' },
  { color: '#457b9d', id: 'informal_labour', label: 'Informal Labour' },
  { color: '#2a9d8f', id: 'manufacturing', label: 'Manufacturing' },
  { color: '#e76f51', id: 'services', label: 'Services' },
]

/**
 * CategoryBreakdownChart renders a split bar share per country when countries are selected,
 * and a single split bar of the global total when no countries are selected.
 *
 * @param {CategoryBreakdownChartProps} arg0_props
 *
 * @returns {React.ReactElement}
 */
export let CategoryBreakdownChart: React.FC<CategoryBreakdownChartProps> = function (arg0_props) {
  //Convert from parameters
  let props = arg0_props
  let {
    activeVariableSelectors: active_variable_selectors = {},
    countryStats: country_stats,
    currentYear: current_year,
    inspectData: inspect_data,
    layerId: layer_id = 'professions_percentage',
    onTogglePlaceholder: on_toggle_placeholder,
    raster,
    selectedCountries: selected_countries = [],
    selectedCountry: selected_country = null,
    syntheticByDefault: synthetic_by_default = true,
    usePlaceholder: controlled_use_placeholder,
  } = props

  //Declare local instance variables
  let by_country_data: Record<string, Record<string, number>>
  let container_ref = useRef<HTMLDivElement>(null)
  let echart_ref = useRef<any>(null)
  let effective_countries: CountryFeature[]
  let effective_use_placeholder: boolean
  let global_sector_data: Record<string, number>
  let handle_toggle_placeholder: (arg0_val: boolean) => void
  let has_countries: boolean
  let is_loading: boolean
  let is_percentage_mode = !layer_id.includes('total')
  let is_refining: boolean
  let is_use_placeholder: boolean
  let option: any
  let refine_duration_estimate_ref = useRef<number>(3.0)
  let refine_start_time_ref = useRef<number>(0)
  let refining_pct: number
  let refining_time_remaining: number
  let set_by_country_data: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>
  let set_global_sector_data: React.Dispatch<React.SetStateAction<Record<string, number>>>
  let set_internal_use_placeholder: React.Dispatch<React.SetStateAction<boolean>>
  let set_is_loading: React.Dispatch<React.SetStateAction<boolean>>
  let set_is_refining: React.Dispatch<React.SetStateAction<boolean>>
  let set_refining_pct: React.Dispatch<React.SetStateAction<number>>
  let set_refining_time_remaining: React.Dispatch<React.SetStateAction<number>>

  //Function body
  effective_countries = useMemo(() => {
    if (selected_countries && selected_countries.length > 0)
      return selected_countries
    if (selected_country)
      return [selected_country]
    return []
  }, [selected_countries, selected_country])

  has_countries = effective_countries.length > 0

    ;[global_sector_data, set_global_sector_data] = useState<Record<string, number>>({
      agriculture: 25.0,
      informal_labour: 15.0,
      manufacturing: 35.0,
      services: 25.0,
    })
    ;[by_country_data, set_by_country_data] = useState<Record<string, Record<string, number>>>({})
    ;[is_use_placeholder, set_internal_use_placeholder] = useState<boolean>(
      controlled_use_placeholder !== undefined ? controlled_use_placeholder : synthetic_by_default
    )
    ;[is_loading, set_is_loading] = useState<boolean>(false)
    ;[is_refining, set_is_refining] = useState<boolean>(false)
    ;[refining_pct, set_refining_pct] = useState<number>(0)
    ;[refining_time_remaining, set_refining_time_remaining] = useState<number>(3.0)

  effective_use_placeholder = controlled_use_placeholder !== undefined ? controlled_use_placeholder : is_use_placeholder

  handle_toggle_placeholder = function (arg0_val: boolean) {
    if (on_toggle_placeholder)
      on_toggle_placeholder(arg0_val)
    set_internal_use_placeholder(arg0_val)
  }

  //Fetch breakdown from backend API with instantaneous synthetic responsiveness
  useEffect(() => {
    let cancelled = false
    let current_yr = Math.round(current_year)
    let interval: NodeJS.Timeout | null = null

    let country_names = effective_countries.map((arg0_c) => getFeatureEntityName(arg0_c)).filter(Boolean)

    //1. Instantaneous synthetic responsiveness: initialize immediately with synthetic sector model
    let synthetic = computeSyntheticSectorBreakdown(country_names, current_yr)
    set_global_sector_data(synthetic.global)
    if (country_names.length > 0)
      set_by_country_data(synthetic.byCountry)

    //If placeholder is enabled, do not query the backend API
    if (effective_use_placeholder) {
      set_is_loading(false)
      set_is_refining(false)
      return () => {
        cancelled = true
      }
    }

    //2. Indicate that authentic calculations are being refined
    set_is_loading(true)
    set_is_refining(true)
    refine_start_time_ref.current = performance.now()
    set_refining_pct(15)
    set_refining_time_remaining(Math.max(0.3, Math.round(refine_duration_estimate_ref.current * 10) / 10))

    interval = setInterval(() => {
      let elapsed_sec = (performance.now() - refine_start_time_ref.current) / 1000
      let est_total = Math.max(1.0, refine_duration_estimate_ref.current)
      let pct = Math.min(96, Math.round((1 - Math.exp(-elapsed_sec / (est_total * 0.65))) * 100))
      let rem = Math.max(0.1, Math.round((est_total - elapsed_sec) * 10) / 10)

      set_refining_pct(Math.max(15, pct))
      set_refining_time_remaining(rem)
    }, 80)

    let geometries = effective_countries
      .filter((arg0_c) => arg0_c.geometry && getFeatureEntityName(arg0_c))
      .map((arg0_c) => ({ geometry: arg0_c.geometry, name: getFeatureEntityName(arg0_c) }))

    let fetch_promise: Promise<Response>
    if (geometries.length > 0) {
      fetch_promise = fetch('/api/raster/breakdown', {
        body: JSON.stringify({
          countries: country_names,
          geometries,
          layer: layer_id,
          year: current_yr,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
    } else {
      let url = `/api/raster/breakdown?layer=${layer_id}&year=${current_yr}`
      if (country_names.length > 0) {
        url += `&countries=${encodeURIComponent(country_names.join(','))}`
      } else if (inspect_data && Number.isFinite(inspect_data.pixelX) && Number.isFinite(inspect_data.pixelY)) {
        url += `&x=${inspect_data.pixelX}&y=${inspect_data.pixelY}`
      }
      fetch_promise = fetch(url)
    }

    fetch_promise
      .then((arg0_res) => {
        if (arg0_res.ok)
          return arg0_res.json()
        return null
      })
      .then((arg0_json) => {
        if (cancelled)
          return
        if (interval)
          clearInterval(interval)

        let actual_sec = (performance.now() - refine_start_time_ref.current) / 1000
        if (actual_sec > 0.3)
          refine_duration_estimate_ref.current = Math.min(10.0, Math.max(0.8, refine_duration_estimate_ref.current * 0.6 + actual_sec * 0.4))

        if (arg0_json) {
          if (arg0_json.global)
            set_global_sector_data(arg0_json.global)
          else if (arg0_json.sectors)
            set_global_sector_data(arg0_json.sectors)

          if (arg0_json.by_country)
            set_by_country_data(arg0_json.by_country)
        }
        set_refining_pct(100)
        set_refining_time_remaining(0)
        set_is_refining(false)
        set_is_loading(false)
      })
      .catch(() => {
        if (!cancelled) {
          if (interval)
            clearInterval(interval)
          set_is_refining(false)
          set_is_loading(false)
        }
      })

    return () => {
      cancelled = true
      if (interval)
        clearInterval(interval)
    }
  }, [current_year, effective_countries, effective_use_placeholder, inspect_data?.pixelX, inspect_data?.pixelY, layer_id])

  //Resize observer for responsive panel updates
  useEffect(() => {
    let container = container_ref.current
    if (!container)
      return

    let trigger_resize = function () {
      if (echart_ref.current) {
        let instance = echart_ref.current.getEchartsInstance?.()
        if (instance && !instance.isDisposed?.())
          instance.resize()
      }
    }

    let observer = new ResizeObserver(() => {
      requestAnimationFrame(trigger_resize)
    })
    observer.observe(container)

    trigger_resize()
    let t1 = setTimeout(trigger_resize, 100)
    let t2 = setTimeout(trigger_resize, 300)

    window.addEventListener('resize', trigger_resize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', trigger_resize)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  //Build ECharts 100% split-bar configuration
  option = useMemo(() => {
    let active_prof = active_variable_selectors.profession || 'agriculture'
    let country_names = effective_countries.map((arg0_c) => getFeatureEntityName(arg0_c))
    let entity_labels: string[]
    let series_list: any[]

    if (has_countries) {
      //Split bar share per country
      entity_labels = country_names
    } else {
      //Single split bar representing global share
      entity_labels = ['Global']
    }

    series_list = PROFESSION_SECTORS.map((arg0_sector) => {
      let is_active_prof = arg0_sector.id === active_prof
      let sector_data_points: number[]

      if (has_countries) {
        sector_data_points = country_names.map((arg0_name) => {
          let c_dict = by_country_data[arg0_name]
          if (!c_dict) {
            let found_k = Object.keys(by_country_data).find(
              (arg0_k) => arg0_k.toLowerCase().trim() === arg0_name.toLowerCase().trim()
            )
            if (found_k)
              c_dict = by_country_data[found_k]
          }
          if (c_dict && c_dict[arg0_sector.id] !== undefined)
            return c_dict[arg0_sector.id]
          return global_sector_data[arg0_sector.id] ?? 25.0
        })
      } else {
        sector_data_points = [global_sector_data[arg0_sector.id] ?? 25.0]
      }

      return {
        barWidth: Math.max(16, Math.min(32, Math.floor(140 / Math.max(1, entity_labels.length)))),
        data: sector_data_points,
        emphasis: {
          focus: 'series',
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 2,
            shadowBlur: 6,
            shadowColor: 'rgba(255,255,255,0.4)',
          },
        },
        itemStyle: {
          borderColor: is_active_prof ? '#ffffff' : '#18181b',
          borderWidth: is_active_prof ? 2 : 0.5,
          color: arg0_sector.color,
        },
        label: {
          color: '#ffffff',
          fontSize: 10,
          formatter: (arg0_param: any) => {
            let v = arg0_param.value
            return v >= 8 ? `${v.toFixed(0)}%` : ''
          },
          position: 'inside',
          show: true,
        },
        name: arg0_sector.label,
        stack: 'total', //Split bar stacked share
        type: 'bar',
      }
    })

    return {
      animationDuration: 300,
      backgroundColor: 'transparent',
      grid: {
        bottom: '8%',
        containLabel: true,
        left: '4%',
        right: '6%',
        top: has_countries ? '32px' : '28px',
      },
      legend: {
        itemGap: 10,
        itemHeight: 9,
        itemWidth: 12,
        right: '4%',
        textStyle: { color: '#a1a1aa', fontSize: 10 },
        top: '2px',
      },
      series: series_list,
      tooltip: {
        backgroundColor: 'rgba(20, 20, 25, 0.95)',
        borderColor: '#3f3f46',
        borderWidth: 1,
        formatter: (arg0_param: any) => {
          let c_name = arg0_param.name
          let pct = arg0_param.value
          let s_name = arg0_param.seriesName
          let s_obj = PROFESSION_SECTORS.find((arg0_s) => arg0_s.label === s_name)
          let color = s_obj ? s_obj.color : '#ffffff'

          return `
            <div style="font-family: sans-serif; font-size: 11px; line-height: 1.4;">
              <div style="font-weight: bold; border-bottom: 1px solid #3f3f46; padding-bottom: 3px; margin-bottom: 4px; color: #f4f4f5;">
                ${c_name} <span style="font-weight: normal; color: #a1a1aa;">(${current_year < 0 ? `${Math.abs(current_year)}BC` : `${current_year}AD`})</span>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; color: ${color};">
                <span><b>${s_name}:</b></span>
                <b style="font-size: 12px;">${pct.toFixed(1)}%</b>
              </div>
            </div>
          `
        },
        padding: [6, 10],
        textStyle: { color: '#ffffff', fontSize: 11 },
        trigger: 'item',
      },
      xAxis: {
        axisLabel: {
          color: '#71717a',
          fontSize: 9,
          formatter: '{value}%',
        },
        axisLine: { lineStyle: { color: '#27272a' } },
        max: 100,
        min: 0,
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        type: 'value',
      },
      yAxis: {
        axisLabel: {
          color: '#d4d4d8',
          fontSize: 11,
          fontWeight: 'bold',
        },
        axisLine: { lineStyle: { color: '#3f3f46' } },
        axisTick: { show: false },
        data: entity_labels,
        inverse: true,
        type: 'category',
      },
    }
  }, [
    active_variable_selectors.profession,
    by_country_data,
    current_year,
    effective_countries,
    global_sector_data,
    has_countries,
  ])

  //Return statement
  return (
    <div ref={container_ref} className="h-full w-full flex flex-col min-h-0 select-none">
      <div className="flex items-center justify-between px-2 pt-1 pb-1 border-b border-border/40 text-[11px] bg-muted/20">
        <div className="flex items-center gap-2 truncate">
          <span className="font-bold text-foreground flex items-center gap-1">
            <Icon name="briefcase" className="text-primary text-xs" />
            <span>
              {has_countries
                ? `Category Split Bar Share (${effective_countries.length} Selected)`
                : 'Global Category Split Bar Share'}
            </span>
          </span>
          <span className="text-muted-foreground font-mono">
            ({current_year < 0 ? `${Math.abs(current_year)}BC` : `${current_year}AD`})
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground shrink-0">
          <span>Active:</span>
          <span className="text-primary font-bold capitalize">
            {Array.isArray(active_variable_selectors.profession)
              ? active_variable_selectors.profession.map((arg0_p) => arg0_p.replace(/_/g, ' ')).join(', ') || 'Agriculture'
              : active_variable_selectors.profession?.replace(/_/g, ' ') || 'Agriculture'}
          </span>
        </div>
      </div>

      {/* Secondary Controls Bar */}
      <div className="flex items-center justify-between px-2 py-1 bg-muted/35 border-b border-border/40 text-[10px] font-mono shrink-0">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-foreground/80 hover:text-foreground">
            <input
              type="checkbox"
              checked={effective_use_placeholder}
              onChange={(arg0_e) => handle_toggle_placeholder(arg0_e.target.checked)}
              className="h-3 w-3 rounded border-border text-primary accent-primary cursor-pointer"
            />
            <span>Use Placeholder</span>
          </label>
          {effective_use_placeholder ? (
            <span
              className="px-1.5 py-0.2 text-[9px] text-muted-foreground bg-muted/50 border border-border/50 rounded cursor-help"
              title="Showing instantaneous synthetic sector proxy. Uncheck 'Use Placeholder' to compute from authentic rasters."
            >
              Synthetic Proxy
            </span>
          ) : (
            <span className="px-1.5 py-0.2 text-[9px] font-semibold bg-primary/20 text-primary border border-primary/30 rounded">
              Exact
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <ReactECharts
          ref={echart_ref}
          option={option}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
          notMerge={true}
        />

        {/* Faint centered refining calculation indicator overlay */}
        {is_refining && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none select-none">
            <div className="flex flex-col items-center gap-1.5 px-3 py-1.5 bg-background/55 backdrop-blur-[2px] border border-border/40 text-foreground/80 text-xs font-mono shadow-sm">
              <div className="flex items-center gap-2">
                <Icon name="sync" className="text-amber-400 text-xs animate-spin" />
                <span className="font-semibold text-amber-400/90">
                  Refining Calculations: {refining_pct}% (~{refining_time_remaining.toFixed(1)}s)
                </span>
              </div>
              <div className="w-32 h-1 bg-muted/60 border border-border/60 overflow-hidden">
                <div
                  className="h-full bg-amber-400/80 transition-all duration-100 ease-out"
                  style={{ width: `${refining_pct}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CategoryBreakdownChart
