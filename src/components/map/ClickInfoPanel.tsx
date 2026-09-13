import React, { useEffect, useRef } from 'react'
import { InspectionData } from '@/lib/geopng/types'

interface ClickInfoPanelProps {
  info: InspectionData | null
  pos: { x: number; y: number } | null
}

export const ClickInfoPanel: React.FC<ClickInfoPanelProps> = ({ info, pos }) => {
  const panelRef = useRef<HTMLDivElement>(null)

  // Direct GPU transform update on pointer coordinate change without any CSS animation lag
  useEffect(() => {
    if (panelRef.current && pos) {
      panelRef.current.style.transform = `translate3d(${pos.x + 14}px, ${pos.y - 70}px, 0)`
    }
  }, [pos])

  if (!info || !pos) return null

  const formattedVal =
    info.value !== null && Number.isFinite(info.value)
      ? info.value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
      : 'NA'

  const formattedLat = info.lat.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })
  const formattedLng = info.lng.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })

  return (
    <div
      ref={panelRef}
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
          <span className="font-bold text-foreground">{formattedVal}</span>
        </div>
        <div className="flex items-baseline gap-1.5 whitespace-nowrap leading-snug">
          <span className="text-muted-foreground font-bold shrink-0">Latlng:</span>
          <span className="text-muted-foreground">
            {formattedLat}, {formattedLng}
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
