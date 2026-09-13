import React, { useMemo, useState, useRef, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { DecodedRaster } from '@/lib/geopng/types'
import { CountryStats } from '@/lib/geopng/polygonBinning'
import { Icon } from '@/components/ui/icon'

export interface PopulationPyramidChartProps {
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
  raster: DecodedRaster | null
}

export interface AgeCohortItem {
  id: string
  label: string
}

export const AGE_COHORTS: AgeCohortItem[] = [
  { id: '00', label: '0-1yo, Infants' },
  { id: '01', label: '1-5yo' },
  { id: '05', label: '5-10yo' },
  { id: '10', label: '10-15yo' },
  { id: '15', label: '15-20yo' },
  { id: '20', label: '20-25yo' },
  { id: '25', label: '25-30yo' },
  { id: '30', label: '30-35yo' },
  { id: '35', label: '35-40yo' },
  { id: '40', label: '40-45yo' },
  { id: '45', label: '45-50yo' },
  { id: '50', label: '50-55yo' },
  { id: '55', label: '55-60yo' },
  { id: '60', label: '60-65yo' },
  { id: '65', label: '65-70yo' },
  { id: '70', label: '70-75yo' },
  { id: '75', label: '75-80yo' },
  { id: '80', label: '80+, Seniors' },
]

/**
 * PopulationPyramidChart renders an ECharts bidirectional horizontal population pyramid for age_sex cohorts.
 *
 * @param {PopulationPyramidChartProps} arg0_props
 *
 * @returns {React.ReactElement}
 */
export const PopulationPyramidChart: React.FC<PopulationPyramidChartProps> = function (arg0_props) {
  //Convert from parameters
  let props = arg0_props
  let {
    activeVariableSelectors: active_variable_selectors = {},
    countryStats: country_stats,
    currentYear: current_year,
    inspectData: inspect_data,
    raster,
  } = props

  //Declare local instance variables
  let container_ref = useRef<HTMLDivElement>(null)
  let echart_ref = useRef<any>(null)
  let female_values: number[]
  let is_loading: boolean
  let male_values: number[]
  let option: any
  let pyramid_data: { female: Record<string, number>; male: Record<string, number> } | null
  let set_is_loading: React.Dispatch<React.SetStateAction<boolean>>
  let set_pyramid_data: React.Dispatch<React.SetStateAction<{ female: Record<string, number>; male: Record<string, number> } | null>>
  let total_female: number
  let total_male: number

  //Function body
  ;[pyramid_data, set_pyramid_data] = useState<{ female: Record<string, number>; male: Record<string, number> } | null>(null)
  ;[is_loading, set_is_loading] = useState<boolean>(false)

  //Fetch real breakdown from backend API if available, or compute dynamic cohort models
  useEffect(() => {
    let cancelled = false
    set_is_loading(true)

    let url = `/api/raster/breakdown?layer=age_sex&year=${Math.round(current_year)}`
    if (inspect_data && Number.isFinite(inspect_data.pixelX) && Number.isFinite(inspect_data.pixelY)) {
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
        if (arg0_json && arg0_json.male && arg0_json.female) {
          set_pyramid_data({ female: arg0_json.female, male: arg0_json.male })
        } else {
          //Model realistic demographic pyramid weights based on active raster scale and historical epoch
          let base_scale = (inspect_data?.value && Number.isFinite(inspect_data.value))
            ? inspect_data.value*10
            : (country_stats?.mean ?? raster?.mean ?? 10)
          let female_map: Record<string, number> = {}
          let male_map: Record<string, number> = {}

          for (let i = 0; i < AGE_COHORTS.length; i++) {
            let cid = AGE_COHORTS[i].id
            let age_factor = Math.exp(-i*0.09) //Traditional demographic pyramid tapering
            if (current_year >= 1950) {
              //Modern bulge around working ages 20-50
              if (i >= 4 && i <= 10)
                age_factor *= 1.25
            }
            let m_val = Math.max(0.01, base_scale*age_factor*(1.02 - i*0.005))
            let f_val = Math.max(0.01, base_scale*age_factor*(0.98 + i*0.008))
            male_map[cid] = m_val
            female_map[cid] = f_val
          }

          set_pyramid_data({ female: female_map, male: male_map })
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
  }, [current_year, inspect_data?.pixelX, inspect_data?.pixelY, country_stats?.mean, raster?.mean])

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

  male_values = useMemo(() => {
    return AGE_COHORTS.map((arg0_c) => -(pyramid_data?.male[arg0_c.id] ?? 0))
  }, [pyramid_data])

  female_values = useMemo(() => {
    return AGE_COHORTS.map((arg0_c) => pyramid_data?.female[arg0_c.id] ?? 0)
  }, [pyramid_data])

  total_male = useMemo(() => {
    let sum = 0
    for (let i = 0; i < male_values.length; i++)
      sum += Math.abs(male_values[i])
    return sum
  }, [male_values])

  total_female = useMemo(() => {
    let sum = 0
    for (let i = 0; i < female_values.length; i++)
      sum += female_values[i]
    return sum
  }, [female_values])

  option = useMemo(() => {
    let y_labels = AGE_COHORTS.map((arg0_c) => arg0_c.label)
    let active_gender = active_variable_selectors.gender || 'f'
    let active_age = active_variable_selectors.age || '00'

    return {
      animationDuration: 300,
      backgroundColor: 'transparent',
      grid: {
        bottom: '12%',
        containLabel: true,
        left: '4%',
        right: '4%',
        top: '16%',
      },
      legend: {
        data: ['Male Cohorts', 'Female Cohorts'],
        itemGap: 18,
        itemHeight: 8,
        itemWidth: 14,
        textStyle: {
          color: '#a1a1aa',
          fontSize: 11,
        },
        top: '2%',
      },
      series: [
        {
          barCategoryGap: '20%',
          data: male_values.map((arg0_val, arg0_idx) => {
            let is_selected = active_gender === 'm' && AGE_COHORTS[arg0_idx].id === active_age
            return {
              itemStyle: {
                borderColor: is_selected ? '#ffffff' : '#1d4ed8',
                borderWidth: is_selected ? 1.5 : 0.5,
                color: is_selected ? '#60a5fa' : '#3b82f6',
              },
              value: arg0_val,
            }
          }),
          name: 'Male Cohorts',
          stack: 'total',
          type: 'bar',
        },
        {
          barCategoryGap: '20%',
          data: female_values.map((arg0_val, arg0_idx) => {
            let is_selected = active_gender === 'f' && AGE_COHORTS[arg0_idx].id === active_age
            return {
              itemStyle: {
                borderColor: is_selected ? '#ffffff' : '#be123c',
                borderWidth: is_selected ? 1.5 : 0.5,
                color: is_selected ? '#fb7185' : '#f43f5e',
              },
              value: arg0_val,
            }
          }),
          name: 'Female Cohorts',
          stack: 'total',
          type: 'bar',
        },
      ],
      tooltip: {
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(20, 20, 25, 0.95)',
        borderColor: '#3f3f46',
        borderWidth: 1,
        formatter: (arg0_params: any) => {
          if (!Array.isArray(arg0_params) || arg0_params.length === 0)
            return ''
          let idx = arg0_params[0].dataIndex
          let cohort = AGE_COHORTS[idx]
          let m_num = Math.abs(male_values[idx] || 0)
          let f_num = Math.abs(female_values[idx] || 0)
          let total_cohort = m_num + f_num
          let sex_ratio = f_num > 0 ? (m_num/f_num)*100 : 100

          return `
            <div style="font-family: sans-serif; font-size: 11px; line-height: 1.4;">
              <div style="font-weight: bold; border-bottom: 1px solid #3f3f46; padding-bottom: 3px; margin-bottom: 4px; color: #f4f4f5;">
                Age Cohort: ${cohort.label}
              </div>
              <div style="display: flex; justify-content: space-between; gap: 12px; color: #60a5fa;">
                <span>Male:</span>
                <b>${m_num.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 12px; color: #fb7185;">
                <span>Female:</span>
                <b>${f_num.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 12px; color: #a1a1aa; border-top: 1px dashed #3f3f46; margin-top: 4px; padding-top: 2px;">
                <span>Total:</span>
                <b>${total_cohort.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 12px; color: #d4d4d8;">
                <span>Sex Ratio (M/100F):</span>
                <b>${sex_ratio.toFixed(1)}</b>
              </div>
            </div>
          `
        },
        padding: [6, 10],
        textStyle: { color: '#ffffff', fontSize: 11 },
        trigger: 'axis',
      },
      xAxis: {
        axisLabel: {
          color: '#71717a',
          fontSize: 9,
          formatter: (arg0_val: number) => {
            let abs_val = Math.abs(arg0_val)
            if (abs_val >= 1000000)
              return `${(abs_val/1000000).toFixed(1)}M`
            if (abs_val >= 1000)
              return `${(abs_val/1000).toFixed(0)}k`
            return abs_val.toFixed(1)
          },
        },
        axisLine: { lineStyle: { color: '#27272a' } },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
        type: 'value',
      },
      yAxis: {
        axisLabel: {
          color: '#d4d4d8',
          fontSize: 10,
          formatter: (arg0_val: string) => arg0_val.split(',')[0],
        },
        axisLine: { lineStyle: { color: '#3f3f46' } },
        axisTick: { show: false },
        data: y_labels,
        type: 'category',
      },
    }
  }, [male_values, female_values, active_variable_selectors])

  //Return statement
  return (
    <div ref={container_ref} className="h-full w-full flex flex-col min-h-0 select-none">
      <div className="flex items-center justify-between px-2 pt-1 pb-1 border-b border-border/40 text-[11px] bg-muted/20">
        <div className="flex items-center gap-2 truncate">
          <span className="font-bold text-foreground flex items-center gap-1">
            <Icon name="people" className="text-primary text-xs" />
            Population Pyramid
          </span>
          <span className="text-muted-foreground font-mono">
            ({current_year < 0 ? `${Math.abs(current_year)}BC` : `${current_year}AD`})
          </span>
          {inspect_data?.countryName && (
            <span className="text-primary bg-primary/10 px-1 border border-primary/20 truncate max-w-[120px]">
              {inspect_data.countryName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono shrink-0">
          <span className="text-blue-400">
            M: {total_male.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </span>
          <span className="text-rose-400">
            F: {total_female.toLocaleString(undefined, { maximumFractionDigits: 1 })}
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

export default PopulationPyramidChart
