import React, { useEffect, useRef } from 'react'
import { InspectionData } from '@/lib/geopng/types'

export interface ClickInfoPanelProps {
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
  let formatted_lat: string
  let formatted_lng: string
  let formatted_val: string
  let info = props.info
  let panel_ref = useRef<HTMLDivElement>(null)
  let pos = props.pos

  //Function body
  useEffect(() => {
    if (panel_ref.current && pos)
      panel_ref.current.style.transform = `translate3d(${pos.x + 14}px, ${pos.y - 70}px, 0)`
  }, [pos])

  //Guard clauses
  if (!info || !pos)
    return null

  formatted_val = (info.value !== null && Number.isFinite(info.value))
    ? info.value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
    : 'NA'
  formatted_lat = info.lat.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })
  formatted_lng = info.lng.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })

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
      </div>
    </div>
  )
}

export default ClickInfoPanel
