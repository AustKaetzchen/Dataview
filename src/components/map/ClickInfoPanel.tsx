import React, { useEffect, useRef } from 'react'
import { InspectionData } from '@/lib/geopng/types'
import { ParsedDataLayer } from '@/server/layerParser'

export interface ClickInfoPanelProps {
  activeLayer?: ParsedDataLayer | null
  activeVariableSelectors?: Record<string, string | string[]>
  info: InspectionData | null
  pos: { x: number; y: number } | null
}

/**
 * Floating tooltip panel displaying inspected pixel coordinates and values.
 *
 * @param {ClickInfoPanelProps} arg0_props
 * @returns {React.ReactElement|null}
 */
export const ClickInfoPanel: React.FC<ClickInfoPanelProps> = function (arg0_props: ClickInfoPanelProps) {
  //Convert from parameters
  let props = (arg0_props) ? arg0_props : ({} as ClickInfoPanelProps)

  //Declare local instance variables
  let active_layer = props.activeLayer
  let active_selectors = props.activeVariableSelectors || {}
  let age_label: string
  let formatted_lat: string
  let formatted_lng: string
  let formatted_val: string
  let gender_label: string
  let info = props.info
  let is_age_sex = Boolean(
    active_layer?.type === 'raster.age_sex' ||
    active_layer?.id === 'age_sex'
  )
  let is_profession = Boolean(
    active_layer?.type === 'raster.category_profession' ||
    active_layer?.id?.includes('profession')
  )
  let panel_ref = useRef<HTMLDivElement>(null)
  let pos = props.pos
  let profession_label: string

  //Function body
  useEffect(() => {
    if (panel_ref.current && pos)
      panel_ref.current.style.transform = `translate3d(${pos.x + 14}px, ${pos.y - 70}px, 0)`
  }, [pos])

  //Guard clauses
  if (!info || !pos)
    return null

  let is_percentage_unit = Boolean(
    active_layer?.unit && (
      active_layer.unit === '%' ||
      active_layer.unit.includes('%') ||
      active_layer.unit.toLowerCase().includes('percent')
    )
  )

  if (info.value !== null && Number.isFinite(info.value)) {
    if (is_percentage_unit) {
      let pct_num = Math.abs(info.value) <= 1.0 ? info.value*100 : info.value
      formatted_val = `${pct_num.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
    } else {
      formatted_val = info.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
  } else {
    formatted_val = 'NA'
  }
  formatted_lat = info.lat.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })
  formatted_lng = info.lng.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })

  let raw_gender = active_selectors.gender
  let gender_val = Array.isArray(raw_gender) ? raw_gender.join(', ') : raw_gender
  gender_label = gender_val === 'm' ? 'Male' : gender_val === 'f' ? 'Female' : gender_val || 'All Genders'

  let raw_age = active_selectors.age
  if (Array.isArray(raw_age)) {
    age_label = `${raw_age.length} Cohorts (${raw_age.join(', ')})`
  } else if (raw_age) {
    age_label = active_layer?.variable_selectors?.age?.options?.[raw_age]?.name || `${raw_age}yo`
  } else {
    age_label = 'All Ages'
  }

  let raw_prof = active_selectors.profession
  if (Array.isArray(raw_prof)) {
    profession_label = raw_prof.map((arg0_p) => arg0_p.replace(/_/g, ' ')).join(', ')
  } else if (raw_prof) {
    profession_label = active_layer?.variable_selectors?.profession?.options?.[raw_prof]?.name || raw_prof.replace(/_/g, ' ')
  } else {
    profession_label = 'Agriculture'
  }

  //Return statement
  return (
    <div
      ref={panel_ref}
      className="absolute top-0 left-0 pointer-events-none z-50 rounded-none border border-border bg-popover/95 p-[var(--padding)] shadow-md font-sans text-[var(--body-font-size)] text-popover-foreground will-change-transform whitespace-nowrap"
      style={{
        transform: `translate3d(${pos.x + 14}px, ${pos.y - 70}px, 0)`,
        minWidth: '200px',
        width: 'max-content',
        transition: 'none',
      }}
    >
      <div className="font-bold text-white mb-1 flex items-baseline gap-1.5 whitespace-nowrap leading-snug">
        <span>X: {info.pixelX.toLocaleString()},</span>
        <span>Y: {info.pixelY.toLocaleString()}</span>
      </div>
      <div className="space-y-0.1 text-[var(--body-font-size)] font-light">
        <div className="flex items-baseline gap-1.5 whitespace-nowrap leading-snug">
          <span className="text-muted-foreground font-bold shrink-0">Value:</span>
          <span className="font-bold text-foreground">{formatted_val}</span>
          {active_layer?.unit && !is_percentage_unit && (
            <span className="text-[10px] text-muted-foreground font-mono ml-0.5">({active_layer.unit})</span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5 whitespace-nowrap leading-snug">
          <span className="text-muted-foreground font-bold shrink-0">Latlng:</span>
          <span className="text-muted-foreground">
            {formatted_lat}, {formatted_lng}
          </span>
        </div>
        {info.countryName && (
          <div className="flex items-baseline gap-1.5 whitespace-nowrap leading-snug">
            <span className="text-muted-foreground font-bold shrink-0">Country:</span>
            <span className="font-bold text-primary">{info.countryName}</span>
          </div>
        )}

        {is_age_sex && (
          <div className="flex items-baseline gap-1.5 whitespace-nowrap leading-snug pt-1 border-t border-border/40">
            <span className="text-muted-foreground font-bold shrink-0">Cohort:</span>
            <span className={`font-bold ${active_selectors.gender === 'm' ? 'text-blue-400' : 'text-rose-400'}`}>
              {gender_label} ({age_label})
            </span>
          </div>
        )}

        {is_profession && (
          <div className="flex items-baseline gap-1.5 whitespace-nowrap leading-snug pt-1 border-t border-border/40">
            <span className="text-muted-foreground font-bold shrink-0">Sector:</span>
            <span className="font-bold text-primary">
              {profession_label}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default ClickInfoPanel
