import React, { useMemo, useState, useRef, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { DecodedRaster } from '@/lib/geopng/types'
import { CountryFeature, CountryStats } from '@/lib/geopng/polygonBinning'
import { Icon } from '@/components/ui/icon'

export interface CategoryBreakdownChartProps {
  activeVariableSelectors?: Record<string, string>
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
  raster: DecodedRaster | null
  selectedCountries?: CountryFeature[]
  selectedCountry?: CountryFeature | null
}

export interface SectorItem {
  color: string
  id: string
  label: string
}

export const PROFESSION_SECTORS: SectorItem[] = [
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
export const CategoryBreakdownChart: React.FC<CategoryBreakdownChartProps> = function (arg0_props) {
  //Convert from parameters
  let props = arg0_props
  let {
    activeVariableSelectors: active_variable_selectors = {},
    countryStats: country_stats,
    currentYear: current_year,
    inspectData: inspect_data,
    layerId: layer_id = 'professions_percentage',
    raster,
    selectedCountries: selected_countries = [],
    selectedCountry: selected_country = null,
  } = props

  //Declare local instance variables
  let by_country_data: Record<string, Record<string, number>>
  let container_ref = useRef<HTMLDivElement>(null)
  let echart_ref = useRef<any>(null)
  let effective_countries: CountryFeature[]
  let global_sector_data: Record<string, number>
  let has_countries: boolean
  let is_loading: boolean
  let is_percentage_mode = !layer_id.includes('total')
  let option: any
  let set_by_country_data: React.Dispatch<React.SetStateAction<Record<string, Record<string, number>>>>
  let set_global_sector_data: React.Dispatch<React.SetStateAction<Record<string, number>>>
  let set_is_loading: React.Dispatch<React.SetStateAction<boolean>>

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
  ;[is_loading, set_is_loading] = useState<boolean>(false)

  //Fetch breakdown from backend API for requested countries or global view
  useEffect(() => {
    let cancelled = false
    set_is_loading(true)

    let country_names = effective_countries.map((arg0_c) => arg0_c.properties.name).filter(Boolean)
    let url = `/api/raster/breakdown?layer=${layer_id}&year=${Math.round(current_year)}`

    if (country_names.length > 0) {
      url += `&countries=${encodeURIComponent(country_names.join(','))}`
    } else if (inspect_data && Number.isFinite(inspect_data.pixelX) && Number.isFinite(inspect_data.pixelY)) {
      url += `&x=${inspect_data.pixelX}&y=${inspect_data.pixelY}`
    }

    fetch(url)
      .then((arg0_res) => {
        if (arg0_res.ok)
          return arg0_res.json()
        return null
      })
      .then((arg0_json) => {
        if (cancelled)
          return
        if (arg0_json) {
          if (arg0_json.global)
            set_global_sector_data(arg0_json.global)
          else if (arg0_json.sectors)
            set_global_sector_data(arg0_json.sectors)

          if (arg0_json.by_country)
            set_by_country_data(arg0_json.by_country)
        }
        set_is_loading(false)
      })
      .catch(() => {
        if (!cancelled)
          set_is_loading(false)
      })

    return () => {
      cancelled = true
    }
  }, [current_year, effective_countries, layer_id, inspect_data?.pixelX, inspect_data?.pixelY])

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
    let country_names = effective_countries.map((arg0_c) => arg0_c.properties.name)
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
        barWidth: Math.max(16, Math.min(32, Math.floor(140/Math.max(1, entity_labels.length)))),
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
            {active_variable_selectors.profession?.replace(/_/g, ' ') || 'Agriculture'}
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {is_loading && (
          <div className="absolute inset-0 z-10 bg-background/40 flex items-center justify-center">
            <Icon name="sync" className="animate-spin text-primary text-sm" />
          </div>
        )}
        <ReactECharts
          ref={echart_ref}
          option={option}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
          notMerge={true}
        />
      </div>
    </div>
  )
}

export default CategoryBreakdownChart
