import React from 'react'
import { InspectionData } from '@/lib/geopng/types'

interface ClickInfoPanelProps {
  info: InspectionData | null
  pos: { x: number; y: number } | null
}

export const ClickInfoPanel: React.FC<ClickInfoPanelProps> = ({ info, pos }) => {
  if (!info || !pos) return null

  const formattedVal =
    info.value !== null && Number.isFinite(info.value)
      ? info.value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
      : 'NA'

  const formattedLat = info.lat.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })
  const formattedLng = info.lng.toLocaleString(undefined, { minimumFractionDigits: 5, maximumFractionDigits: 5 })

  return (
    <div
      className="absolute pointer-events-none z-50 rounded-none border border-border bg-popover/95 p-[var(--padding)] shadow-md font-sans text-[var(--body-font-size)] text-popover-foreground transition-all duration-75"
      style={{
        left: `${pos.x + 14}px`,
        top: `${pos.y - 70}px`,
        minWidth: '200px',
      }}
    >
      <div className="font-bold text-white mb-1">
        X: {info.pixelX.toLocaleString()}, Y: {info.pixelY.toLocaleString()}
      </div>
      <div className="space-y-0.5 text-[var(--body-font-size)] font-light">
        <div>
          <span className="text-muted-foreground font-bold">Value: </span>
          <span className="font-bold font-mono text-foreground">{formattedVal}</span>
        </div>
        <div>
          <span className="text-muted-foreground font-bold">Latlng: </span>
          <span className="text-muted-foreground font-mono">
            {formattedLat}, {formattedLng}
          </span>
        </div>
        {info.countryName && (
          <div>
            <span className="text-muted-foreground font-bold">Country: </span>
            <span className="font-bold text-foreground text-primary">{info.countryName}</span>
          </div>
        )}
      </div>
    </div>
  )
}
